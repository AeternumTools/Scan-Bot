// src/services/groqService.js
// Cliente de Groq API con tool-use loop para el agente de Lumi

const axios  = require('axios');
const logger = require('../utils/logger');

const GROQ_URL       = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL          = 'llama-3.3-70b-versatile';
const MAX_TOOL_ROUNDS = 6;

/**
 * Llama al agente de Groq con soporte de tool-use.
 * @param {Array}  messages   - Historial de mensajes [{ role, content }]
 * @param {Array}  tools      - Definiciones de herramientas (formato OpenAI)
 * @param {Object} executors  - Mapa { nombre_tool: async (args) => resultado }
 * @returns {string}          - Respuesta final del modelo
 */
async function callAgent(messages, tools = [], executors = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY no está configurada en las variables de entorno');
  }

  const msgs = [...messages];
  const headers = {
    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    'Content-Type': 'application/json',
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const body = {
      model: MODEL,
      messages: msgs,
      max_tokens: 1024,
      ...(tools.length && { tools, tool_choice: 'auto' }),
    };

    let data;
    try {
      ({ data } = await axios.post(GROQ_URL, body, { headers, timeout: 30_000 }));
    } catch (err) {
      const detail = err.response?.data?.error?.message || err.message;
      logger.error('Groq', `Error de API (ronda ${round + 1}): ${detail}`);
      throw new Error(detail);
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
            const args = JSON.parse(tc.function.arguments);
            result = await fn(args);
            logger.info('Groq', `Tool ejecutada: ${tc.function.name}`);
          } catch (err) {
            logger.warn('Groq', `Error en tool ${tc.function.name}: ${err.message}`);
            result = { error: err.message };
          }
        } else {
          logger.warn('Groq', `Tool desconocida: ${tc.function.name}`);
          result = { error: `Herramienta '${tc.function.name}' no registrada` };
        }

        msgs.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    } else {
      return msg.content;
    }
  }

  return 'Llegué al límite de rondas de herramientas. Intenta una consulta más específica.';
}

module.exports = { callAgent };
