// src/services/railwayService.js
// Gestión de variables de entorno en Railway vía API GraphQL.
// Lumi puede leer y editar variables operativas sin tocar las credenciales.

const axios  = require('axios');
const logger = require('../utils/logger');

const RAILWAY_API = 'https://backboard.railway.app/graphql/v2';

const PROJECT_ID     = 'af8affe6-7166-4bef-92c3-6c763de90d55';
const SERVICE_ID     = '9c3be517-6076-4d6c-b2f4-dd00718b3d86';
const ENVIRONMENT_ID = 'f9e053d0-7016-4f6c-bfc5-7bcbfea60ccd';

// ── Variables que Lumi PUEDE editar ──────────────────────────────────────────
const EDITABLE_VARS = new Set([
  'ANNOUNCEMENT_CHANNEL_ID',
  'RECORDS_CHANNEL_ID',
  'STAFF_NOTICE_ID',
  'NOTICE_CHANNEL_ID',
  'COVERS_CHANNEL_ID',
  'RAWS_CHANNEL_ID',
  'MOD_ROLE_ID',
  'ANNOUNCER_ROLE_ID',
  'LUMI_AI_STAFF_ROLE_IDS',
  'CHECK_INTERVAL_MINUTES',
  'TIMEZONE',
  'COLORCITO_BASE_URL',
  'WEBHOOK_PORT',
]);

// ── Variables sensibles que se enmascaran al mostrar ─────────────────────────
const MASKED_VARS = new Set([
  'DISCORD_TOKEN',
  'GROQ_API_KEY',
  'RAILWAY_API_TOKEN',
  'GOOGLE_SERVICE_ACCOUNT_KEY',
  'GOOGLE_REFRESH_TOKEN',
  'GOOGLE_CLIENT_SECRET',
  'WEBHOOK_SECRET',
]);

function getHeaders() {
  const token = process.env.RAILWAY_API_TOKEN;
  if (!token) throw new Error('RAILWAY_API_TOKEN no está configurado');
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

async function query(gql, variables = {}) {
  const { data } = await axios.post(
    RAILWAY_API,
    { query: gql, variables },
    { headers: getHeaders(), timeout: 15_000 },
  );
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data;
}

// ── Leer todas las variables ──────────────────────────────────────────────────
async function getVariables() {
  const data = await query(`
    query {
      variables(
        projectId: "${PROJECT_ID}"
        environmentId: "${ENVIRONMENT_ID}"
        serviceId: "${SERVICE_ID}"
      )
    }
  `);

  const raw = data.variables || {};
  const result = {};

  for (const [key, value] of Object.entries(raw)) {
    result[key] = {
      value:    MASKED_VARS.has(key) ? '••••••••' : value,
      editable: EDITABLE_VARS.has(key),
      masked:   MASKED_VARS.has(key),
    };
  }

  return result;
}

// ── Editar una variable ───────────────────────────────────────────────────────
async function setVariable(name, value) {
  if (!EDITABLE_VARS.has(name)) {
    throw new Error(`"${name}" no está en la lista de variables editables por Lumi.`);
  }

  await query(`
    mutation {
      variableUpsert(input: {
        projectId:     "${PROJECT_ID}"
        environmentId: "${ENVIRONMENT_ID}"
        serviceId:     "${SERVICE_ID}"
        name:          ${JSON.stringify(name)}
        value:         ${JSON.stringify(String(value))}
      })
    }
  `);

  logger.info('Railway', `Variable actualizada: ${name} = ${value}`);

  // Railway redeploya automáticamente al cambiar variables.
  // El bot tardará ~30-60 segundos en reiniciarse con el nuevo valor.
}

module.exports = { getVariables, setVariable, EDITABLE_VARS };
