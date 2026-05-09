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

// Con tools: solo usa el 70b, reintenta hasta 3 veces en 429 con backoff.
async function callWithTools(body, headers) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callModel(MODEL_TOOL, body, headers);
    } catch (err) {
      if (err.status === 429 && attempt < 2) {
        const wait = (attempt + 1) * 5000;
        logger.warn('Groq', `429 en ${MODEL_TOOL} — reintentando en ${wait / 1000}s`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

// Sin tools: fallback entre modelos.
async function callWithFallback(body, headers) {
  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i];
    try {
      const res = await callModel(model, body, headers);
      if (i > 0) logger.info('Groq', `Fallback a: ${model}`);
      return res;
    } catch (err) {
      if (err.status === 429) {
        const wait = (i + 1) * 3000;
        logger.warn('Groq', `429 en ${model} — probando siguiente en ${wait / 1000}s`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Todos los modelos están en límite de uso. Intenta en unos minutos.');
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
          role:        'tool',
          tool_call_id: tc.id,
          content:     JSON.stringify(result),
        });
      }
    } else {
      return msg.content;
    }
  }

  return 'Llegué al límite de rondas. Intenta una consulta más específica.';
}

module.exports = { callAgent };
