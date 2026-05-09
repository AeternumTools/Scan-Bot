// src/services/railwayService.js
// Gestión de variables de entorno en Railway vía API GraphQL.
// Lumi puede leer y editar variables operativas sin tocar las credenciales.

const axios  = require('axios');
const logger = require('../utils/logger');

const RAILWAY_API = 'https://backboard.railway.app/graphql/v2';

const PROJECT_ID     = 'af8affe6-7166-4bef-92c3-6c763de90d55';
const SERVICE_ID     = '9c3be517-6076-4d6c-b2f4-dd00718b3d86';
const ENVIRONMENT_ID = 'f9e053d0-7016-4f6c-bfc5-7bcbfea60ccd';

// ── Diccionario: variable → nombre legible + aliases ─────────────────────────
const VAR_CONFIG = {
  ANNOUNCEMENT_CHANNEL_ID: {
    label:   'Canal de anuncios de capítulos',
    aliases: ['canal de anuncios', 'anuncios', 'canal anuncios', 'announcement'],
  },
  RECORDS_CHANNEL_ID: {
    label:   'Canal de registros / logs del bot',
    aliases: ['registros', 'logs', 'canal de logs', 'canal de registros'],
  },
  STAFF_NOTICE_ID: {
    label:   'Canal de avisos internos del staff',
    aliases: ['avisos del staff', 'staff notice', 'avisos staff', 'canal staff'],
  },
  NOTICE_CHANNEL_ID: {
    label:   'Canal de avisos generales (lectores)',
    aliases: ['avisos', 'avisos generales', 'canal de avisos', 'notice'],
  },
  COVERS_CHANNEL_ID: {
    label:   'Canal de portadas',
    aliases: ['portadas', 'covers', 'canal de portadas'],
  },
  RAWS_CHANNEL_ID: {
    label:   'Canal de raws',
    aliases: ['raws', 'canal de raws', 'canal raws'],
  },
  MOD_ROLE_ID: {
    label:   'Rol de moderación',
    aliases: ['rol de mod', 'rol moderacion', 'moderacion', 'mod role'],
  },
  ANNOUNCER_ROLE_ID: {
    label:   'Rol de anunciador',
    aliases: ['anunciador', 'announcer', 'rol anunciador'],
  },
  LUMI_AI_STAFF_ROLE_IDS: {
    label:   'Roles que pueden hablarle a la IA (separados por coma)',
    aliases: ['roles staff ia', 'roles lumi', 'staff roles', 'roles de staff'],
  },
  CHECK_INTERVAL_MINUTES: {
    label:   'Intervalo de verificación de capítulos (minutos)',
    aliases: ['intervalo', 'frecuencia', 'intervalo de verificacion', 'cada cuanto revisa'],
  },
  TIMEZONE: {
    label:   'Zona horaria del bot',
    aliases: ['zona horaria', 'timezone', 'huso horario'],
  },
  COLORCITO_BASE_URL: {
    label:   'URL base de Colorcito',
    aliases: ['url colorcito', 'colorcito url', 'colorcito'],
  },
  WEBHOOK_PORT: {
    label:   'Puerto del servidor webhook',
    aliases: ['puerto webhook', 'webhook port', 'puerto'],
  },
};

// Set de variables editables (derivado del diccionario)
const EDITABLE_VARS = new Set(Object.keys(VAR_CONFIG));

// Mapa inverso: alias → nombre de variable
const ALIAS_MAP = new Map();
for (const [varName, cfg] of Object.entries(VAR_CONFIG)) {
  ALIAS_MAP.set(varName.toLowerCase(), varName);
  for (const alias of cfg.aliases) {
    ALIAS_MAP.set(alias.toLowerCase(), varName);
  }
}

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

// ── Caché en memoria para no abusar de la API de Railway ─────────────────────
const cache = { vars: null, at: 0 };
const CACHE_TTL = 2 * 60 * 1000; // 2 minutos

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
  // Servir desde caché si es reciente
  if (cache.vars && Date.now() - cache.at < CACHE_TTL) {
    return cache.vars;
  }

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
  const editables = [];

  for (const [varName, cfg] of Object.entries(VAR_CONFIG)) {
    editables.push({
      variable: varName,
      nombre:   cfg.label,
      valor:    MASKED_VARS.has(varName) ? '••••••••' : (raw[varName] ?? '(no configurada)'),
    });
  }

  const result = { configuracion: editables };
  cache.vars = result;
  cache.at   = Date.now();
  return result;
}

// ── Editar una variable ───────────────────────────────────────────────────────
// Acepta el nombre exacto de la variable O cualquier alias en español/inglés.
async function setVariable(nameOrAlias, value) {
  const resolved = ALIAS_MAP.get(nameOrAlias.toLowerCase()) || nameOrAlias;

  if (!EDITABLE_VARS.has(resolved)) {
    const sugerencias = Object.entries(VAR_CONFIG)
      .map(([k, v]) => `• ${v.label} → ${k}`)
      .join('\n');
    throw new Error(
      `"${nameOrAlias}" no corresponde a ninguna variable editable.\n\nVariables disponibles:\n${sugerencias}`,
    );
  }

  await query(`
    mutation {
      variableUpsert(input: {
        projectId:     "${PROJECT_ID}"
        environmentId: "${ENVIRONMENT_ID}"
        serviceId:     "${SERVICE_ID}"
        name:          ${JSON.stringify(resolved)}
        value:         ${JSON.stringify(String(value))}
      })
    }
  `);

  const label = VAR_CONFIG[resolved].label;
  logger.info('Railway', `Variable actualizada: ${resolved} = ${value}`);
  cache.vars = null; // invalidar caché
  return { variable: resolved, label, valor: value };
}

module.exports = { getVariables, setVariable, EDITABLE_VARS };
