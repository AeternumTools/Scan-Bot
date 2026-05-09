// src/services/groqService.js
// Cliente de Groq API con tool-use loop, fallback de modelos y retry en 429.

const axios  = require('axios');
const logger = require('../utils/logger');

const GROQ_URL       = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_TOOL_ROUNDS = 6;

// Modelos disponibles:
// - 70b: mejor razonamiento y tool-use (1 000 req/día free)
// - 8b/gemma2: cuota alta (14 400/día) pero NO confiables para tool-use
const MODEL_TOOL  = 'llama-3.3-70b-versatile';  // único para cuando hay tools
const MODEL_CHAIN = [                             // cadena para conversación sin tools
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callModel(model, body, headers) {
  try {
    return await axios.post(GROQ_URL, { ...body, model }, { headers, timeout: 30_000 });
  } catch (err) {
    err.status = err.response?.status;
    err.detail = err.response?.data?.error?.message || err.message;
    throw err;
  }
}

// Detecta si el 429 es por tokens por día (TPD) — en ese caso no tiene sentido esperar,
// hay que saltar al siguiente modelo directamente.
function isTokensPerDay(err) {
  return err.status === 429 &&
    (err.detail?.includes('tokens per day') || err.detail?.includes('TPD'));
}

// Fallback entre modelos para CUALQUIER tipo de llamada.
// - TPD (tokens/día agotados): salta al siguiente modelo sin esperar.
// - RPM (requests/min): espera brevemente y reintenta el mismo modelo una vez.
async function callWithFallback(body, headers, models = MODEL_CHAIN) {
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const res = await callModel(model, body, headers);
      if (i > 0) logger.info('Groq', `Usando modelo de fallback: ${model}`);
      return res;
    } catch (err) {
      if (err.status === 429) {
        if (isTokensPerDay(err)) {
          // Cuota diaria agotada — pasar al siguiente sin esperar
          logger.warn('Groq', `TPD agotado en ${model} → probando siguiente`);
          continue;
        }
        // Rate limit por minuto — esperar un poco y reintentar una vez
        if (i < models.length - 1) {
          logger.warn('Groq', `429 RPM en ${model} → esperando 4s y probando siguiente`);
          await sleep(4000);
          continue;
        }
      }
      throw err;
    }
  }
  throw new Error('Todos los modelos alcanzaron su límite. Intenta en unos minutos.');
}

// Para tool use: misma lógica pero el 70b va primero por su mejor soporte.
async function callWithTools(body, headers) {
  return callWithFallback(body, headers, MODEL_CHAIN);
}

// Detecta tool calls escritas como texto por el modelo.
// Soporta: <function=name>{}</function>  y  <function=name>{}  (sin cierre)
function parseLeakedToolCalls(content) {
  const calls = [];
  // Captura: <function=NOMBRE> seguido de JSON hasta </function> o fin de string
  const regex = /<function=([a-zA-Z_]+)>([\s\S]*?)(?:<\/function>|$)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const name    = match[1];
    const rawArgs = match[2].trim();
    let args = {};
    try { args = JSON.parse(rawArgs || '{}'); } catch { /* args vacíos */ }
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
