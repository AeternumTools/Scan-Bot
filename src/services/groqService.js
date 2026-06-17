// src/services/groqService.js
// Cliente de Groq API con tool-use loop, fallback de modelos y retry en 429.

const axios  = require('axios');
const logger = require('../utils/logger');

const GROQ_URL       = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_TOOL_ROUNDS = 6;

// Modelos disponibles:
// - 70b: mejor razonamiento y tool-use (1 000 req/día free)
// - 8b/gemma2: cuota alta (14 400/día) pero NO confiables para tool-use
const MODEL_CHAIN = [
  'llama-3.3-70b-versatile',                    // 100K TPD — mejor razonamiento y tool-use
  'meta-llama/llama-4-scout-17b-16e-instruct',  // 500K TPD — Llama 4, buen tool-use
  'qwen/qwen3-32b',                             // 500K TPD — 32B params, buen razonamiento
  'llama-3.1-8b-instant',                       // 500K TPD — más rápido, último recurso
];

async function callModel(model, body, headers) {
  try {
    return await axios.post(GROQ_URL, { ...body, model }, { headers, timeout: 30_000 });
  } catch (err) {
    err.status = err.response?.status;
    err.detail = err.response?.data?.error?.message || err.message;
    throw err;
  }
}

// Detecta si el 429 es por tokens por día (TPD) — en ese caso no tiene sentido
// reintentar ese modelo: se marca como agotado y se salta hasta que resetee.
function isTokensPerDay(err) {
  return err.status === 429 &&
    (err.detail?.includes('tokens per day') || err.detail?.includes('TPD'));
}

// ── Memoria de modelos agotados por TPD ──────────────────────────────────────
// Cuando un modelo agota sus tokens del día, lo dejamos fuera de la rotación y
// lo re-probamos pasado un tiempo (por si su cuota ya reseteó).
const TPD_COOLDOWN_MS = 30 * 60 * 1000; // re-probar cada 30 min
const exhausted = new Map(); // model → timestamp hasta el que se considera agotado

function isExhausted(model) {
  const until = exhausted.get(model);
  if (!until) return false;
  if (Date.now() >= until) { exhausted.delete(model); return false; }
  return true;
}

function markExhausted(model) {
  exhausted.set(model, Date.now() + TPD_COOLDOWN_MS);
}

// ── Rotación round-robin ─────────────────────────────────────────────────────
// Para repartir el consumo entre TODOS los modelos (y no quemar siempre el
// primero), cada llamada arranca en un modelo distinto, saltando los agotados.
let rotationIndex = 0;

function buildAttemptOrder(models) {
  const disponibles = models.filter(m => !isExhausted(m));
  const pool  = disponibles.length ? disponibles : models; // si todos agotados, intenta igual
  const start = rotationIndex % pool.length;
  rotationIndex = (rotationIndex + 1) % pool.length;
  return [...pool.slice(start), ...pool.slice(0, start)];
}

// Fallback entre modelos para CUALQUIER tipo de llamada.
// Arranca en un modelo distinto cada vez (rotación) y, si falla, prueba los
// demás. Los modelos con TPD agotado se marcan y se saltan.
async function callWithFallback(body, headers, models = MODEL_CHAIN) {
  const order = buildAttemptOrder(models);
  let lastErr;

  for (let i = 0; i < order.length; i++) {
    const model = order[i];
    try {
      const res = await callModel(model, body, headers);
      logger.info('Groq', `Modelo: ${model}${i > 0 ? ' (fallback)' : ''}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (err.status === 429 && isTokensPerDay(err)) {
        markExhausted(model);
        logger.warn('Groq', `TPD agotado en ${model} → fuera de rotación 30 min`);
        continue;
      }
      // RPM u otro fallo transitorio → probar el siguiente modelo (es distinto)
      logger.warn('Groq', `Fallo en ${model} (${err.status || '?'}) → probando siguiente`);
      continue;
    }
  }

  throw lastErr || new Error('Todos los modelos alcanzaron su límite. Intenta en unos minutos.');
}

// Para tool use: misma rotación. Gracias al parser de tool-calls filtradas,
// los modelos más pequeños también sirven aunque a veces escriban la llamada
// como texto.
async function callWithTools(body, headers) {
  return callWithFallback(body, headers, MODEL_CHAIN);
}

// Detecta tool calls escritas como texto por el modelo.
// Soporta varios formatos que filtran los modelos:
//   <function=name>{json}</function>      (args en el cuerpo)
//   <function=name>{json}                 (sin cierre)
//   <function=name({json})>               (args entre paréntesis)
//   <function=name({json})></function>
function parseLeakedToolCalls(content) {
  const calls = [];
  // Grupo 1: nombre · Grupo 2: args entre paréntesis (opc) · Grupo 3: args en el cuerpo (opc)
  const regex = /<function=([a-zA-Z0-9_]+)\s*(?:\(([\s\S]*?)\))?\s*>([\s\S]*?)(?:<\/function>|$)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const name    = match[1];
    const rawArgs = (match[2] != null ? match[2] : (match[3] || '')).trim();
    let args = {};
    try { args = JSON.parse(rawArgs || '{}'); } catch { /* args vacíos o no-JSON */ }
    calls.push({ name, args });
  }
  return calls;
}

/**
 * Llama al agente de Groq con soporte de tool-use.
 * @param {Array}  messages   - Historial de mensajes [{ role, content }]
 * @param {Array}  tools      - Definiciones de herramientas (formato OpenAI)
 * @param {Object} executors  - Mapa { nombre_tool: async (args) => resultado }
 * @returns {string}          - Respuesta final del modelo
 */
async function callAgent(messages, tools = [], executors = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY no está configurada');
  }

  const msgs    = [...messages];
  const headers = {
    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    'Content-Type': 'application/json',
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const body = {
      messages: msgs,
      max_tokens: 1024,
      ...(tools.length && { tools, tool_choice: 'auto' }),
    };

    let data;
    try {
      const fn = tools.length ? callWithTools : callWithFallback;
      ({ data } = await fn(body, headers));
    } catch (err) {
      logger.error('Groq', `Error en ronda ${round + 1}: ${err.detail || err.message}`);
      throw new Error(err.detail || err.message);
    }

    const choice = data.choices[0];
    const msg    = choice.message;

    // Algunos modelos escriben las tool calls como texto plano en content
    // en vez del campo tool_calls estructurado. Las detectamos, ejecutamos,
    // e inyectamos el resultado como mensaje de usuario para que el modelo responda.
    if (msg.content && !msg.tool_calls?.length) {
      const leaked = parseLeakedToolCalls(msg.content);
      if (leaked.length) {
        logger.warn('Groq', `Tool calls en content (${leaked.length}), ejecutando...`);
        const results = [];
        for (const { name, args } of leaked) {
          const fn = executors[name];
          let result;
          if (fn) {
            try {
              result = await fn(args);
              logger.info('Groq', `Tool (leaked): ${name}`);
            } catch (err) {
              result = { error: err.message };
            }
          } else {
            result = { error: `Herramienta '${name}' no registrada` };
          }
          results.push(`[${name}]: ${JSON.stringify(result)}`);
        }
        // Inyectar resultados como contexto sin romper el formato del historial
        msgs.push({ role: 'assistant', content: '' });
        msgs.push({
          role:    'user',
          content: `Resultados de herramientas:\n${results.join('\n')}\n\nResponde al usuario con esta información.`,
        });
        continue;
      }
    }

    msgs.push(msg);

    if (choice.finish_reason === 'tool_calls' && msg.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        const fn = executors[tc.function.name];
        let result;

        if (fn) {
          try {
            result = await fn(JSON.parse(tc.function.arguments));
            logger.info('Groq', `Tool: ${tc.function.name}`);
          } catch (err) {
            logger.warn('Groq', `Error en tool ${tc.function.name}: ${err.message}`);
            result = { error: err.message };
          }
        } else {
          result = { error: `Herramienta '${tc.function.name}' no registrada` };
        }

        msgs.push({
          role:         'tool',
          tool_call_id: tc.id,
          content:      JSON.stringify(result),
        });
      }
    } else {
      return msg.content;
    }
  }

  return 'Llegué al límite de rondas. Intenta una consulta más específica.';
}

module.exports = { callAgent };
