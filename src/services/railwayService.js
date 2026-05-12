// src/services/railwayService.js
// Gestión de variables de configuración del bot.
// Las variables se leen de process.env y los overrides se guardan en data/config.json.
// Los cambios aplican inmediatamente sin reiniciar Railway.

const path    = require('path');
const fs      = require('fs-extra');
const logger  = require('../utils/logger');
const monitor = require('./monitor');

const CONFIG_FILE = path.join('data', 'config.json');

// ── Diccionario: variable → nombre legible + aliases ─────────────────────────
// type: 'channel' → <#id>, 'role' → <@&id>, 'roles' → múltiples <@&id>, 'text' → sin formato
const VAR_CONFIG = {
  ANNOUNCEMENT_CHANNEL_ID: {
    label:   'Canal de anuncios de capítulos',
    type:    'channel',
    aliases: ['canal de anuncios', 'anuncios', 'canal anuncios', 'announcement'],
  },
  RECORDS_CHANNEL_ID: {
    label:   'Canal de registros / logs del bot',
    type:    'channel',
    aliases: ['registros', 'logs', 'canal de logs', 'canal de registros'],
  },
  STAFF_NOTICE_ID: {
    label:   'Canal de avisos internos del staff',
    type:    'channel',
    aliases: ['avisos del staff', 'staff notice', 'avisos staff', 'canal staff'],
  },
  NOTICE_CHANNEL_ID: {
    label:   'Canal de avisos generales (lectores)',
    type:    'channel',
    aliases: ['avisos', 'avisos generales', 'canal de avisos', 'notice'],
  },
  COVERS_CHANNEL_ID: {
    label:   'Canal de portadas',
    type:    'channel',
    aliases: ['portadas', 'covers', 'canal de portadas'],
  },
  RAWS_CHANNEL_ID: {
    label:   'Canal de raws',
    type:    'channel',
    aliases: ['raws', 'canal de raws', 'canal raws'],
  },
  MOD_ROLE_ID: {
    label:   'Rol de moderación',
    type:    'role',
    aliases: ['rol de mod', 'rol moderacion', 'moderacion', 'mod role'],
  },
  ANNOUNCER_ROLE_ID: {
    label:   'Rol de anunciador',
    type:    'role',
    aliases: ['anunciador', 'announcer', 'rol anunciador'],
  },
  LUMI_AI_STAFF_ROLE_IDS: {
    label:   'Roles que pueden hablarle a la IA',
    type:    'roles',
    aliases: ['roles staff ia', 'roles lumi', 'staff roles', 'roles de staff'],
  },
  CHECK_INTERVAL_MINUTES: {
    label:   'Intervalo de verificación (minutos)',
    type:    'text',
    aliases: ['intervalo', 'frecuencia', 'intervalo de verificacion', 'cada cuanto revisa'],
  },
  TIMEZONE: {
    label:   'Zona horaria',
    type:    'text',
    aliases: ['zona horaria', 'timezone', 'huso horario'],
  },
  COLORCITO_BASE_URL: {
    label:   'URL base de Colorcito',
    type:    'text',
    aliases: ['url colorcito', 'colorcito url', 'colorcito'],
  },
  WEBHOOK_PORT: {
    label:   'Puerto del servidor webhook',
    type:    'text',
    aliases: ['puerto webhook', 'webhook port', 'puerto'],
  },
};

const EDITABLE_VARS = new Set(Object.keys(VAR_CONFIG));

// Mapa inverso: alias → nombre de variable
const ALIAS_MAP = new Map();
for (const [varName, cfg] of Object.entries(VAR_CONFIG)) {
  ALIAS_MAP.set(varName.toLowerCase(), varName);
  for (const alias of cfg.aliases) {
    ALIAS_MAP.set(alias.toLowerCase(), varName);
  }
}

// ── Leer overrides guardados ──────────────────────────────────────────────────
function loadOverrides() {
  try {
    return fs.existsSync(CONFIG_FILE) ? fs.readJSONSync(CONFIG_FILE) : {};
  } catch {
    return {};
  }
}

// Formatea un valor según el tipo de variable para Discord
function formatValue(raw, type) {
  if (!raw || raw === '(no configurada)') return '(no configurada)';
  switch (type) {
    case 'channel': return `<#${raw}>`;
    case 'role':    return `<@&${raw}>`;
    case 'roles':   return raw.split(',').map(id => `<@&${id.trim()}>`).join(' y ');
    default:        return raw;
  }
}

// ── Leer todas las variables ──────────────────────────────────────────────────
function getVariables() {
  const overrides = loadOverrides();
  const config = [];

  for (const [varName, cfg] of Object.entries(VAR_CONFIG)) {
    const raw    = overrides[varName] ?? process.env[varName] ?? null;
    const fuente = overrides[varName] ? '✏️' : '⚙️';
    config.push({
      nombre: cfg.label,
      valor:  raw ? formatValue(raw, cfg.type) : '(no configurada)',
      fuente,
    });
  }

  return { configuracion: config };
}

// ── Editar una variable ───────────────────────────────────────────────────────
function setVariable(nameOrAlias, value) {
  const resolved = ALIAS_MAP.get(nameOrAlias.toLowerCase()) || nameOrAlias;

  if (!EDITABLE_VARS.has(resolved)) {
    const lista = Object.entries(VAR_CONFIG)
      .map(([k, v]) => `• ${v.label}`)
      .join('\n');
    throw new Error(`"${nameOrAlias}" no corresponde a ninguna variable editable.\n\nDisponibles:\n${lista}`);
  }

  // Guardar en el archivo de overrides
  const overrides = loadOverrides();
  overrides[resolved] = String(value);
  fs.ensureDirSync(path.dirname(CONFIG_FILE));
  fs.outputJSONSync(CONFIG_FILE, overrides, { spaces: 2 });

  // Aplicar inmediatamente en el proceso actual
  process.env[resolved] = String(value);

  const label = VAR_CONFIG[resolved].label;
  logger.info('Config', `Variable actualizada: ${resolved} = ${value}`);

  // Reiniciar el monitor si cambia el intervalo o la zona horaria
  if (resolved === 'CHECK_INTERVAL_MINUTES' || resolved === 'TIMEZONE') {
    monitor.restart();
    logger.info('Config', 'Monitor reiniciado con nuevo intervalo/timezone.');
  }

  return { variable: resolved, label, valor: value };
}

module.exports = { getVariables, setVariable, EDITABLE_VARS };
