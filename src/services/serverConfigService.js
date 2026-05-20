// src/services/serverConfigService.js
// Configuración per-servidor. Reemplaza la dependencia de variables de entorno.
//
// Estructura en disco:
//   data/servers/{guildId}/config.json
//
// Si una key no existe en el archivo del servidor, cae al .env como fallback
// durante la transición. Eso permite migrar gradualmente sin romper Aeternum.

const fs   = require('fs-extra');
const path = require('path');

const SERVERS_DIR = path.join('data', 'servers');

// ── Mapeo: clave interna → variable de entorno legacy (fallback) ─────────────
// Las claves usan notación dot para anidamiento.
const ENV_FALLBACK = {
  'channels.announcement':   'ANNOUNCEMENT_CHANNEL_ID',
  'channels.records':        'RECORDS_CHANNEL_ID',
  'channels.staffNotice':    'STAFF_NOTICE_ID',
  'channels.notice':         'NOTICE_CHANNEL_ID',
  'channels.covers':         'COVERS_CHANNEL_ID',
  'channels.raws':           'RAWS_CHANNEL_ID',
  'roles.mod':               'MOD_ROLE_ID',
  'roles.announcer':         'ANNOUNCER_ROLE_ID',
  'roles.aiStaff':           'LUMI_AI_STAFF_ROLE_IDS',
  'monitor.intervalMinutes': 'CHECK_INTERVAL_MINUTES',
  'timezone':                'TIMEZONE',
  'ownerId':                 'VALK_USER_ID',
};

// Tipos esperados para deserializar correctamente desde .env (que es siempre string)
const TYPE_HINTS = {
  'roles.aiStaff':           'array',  // CSV → array
  'monitor.intervalMinutes': 'number',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function configFile(guildId) {
  return path.join(SERVERS_DIR, guildId, 'config.json');
}

function getNested(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function setNested(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let curr = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof curr[keys[i]] !== 'object' || curr[keys[i]] === null) curr[keys[i]] = {};
    curr = curr[keys[i]];
  }
  curr[keys[keys.length - 1]] = value;
}

function parseEnvValue(raw, type) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (type === 'array')  return raw.split(',').map(s => s.trim()).filter(Boolean);
  if (type === 'number') return Number.isFinite(parseInt(raw, 10)) ? parseInt(raw, 10) : null;
  return raw;
}

// ── API pública ──────────────────────────────────────────────────────────────

function loadServerConfig(guildId) {
  if (!guildId) return {};
  const file = configFile(guildId);
  try {
    return fs.existsSync(file) ? fs.readJSONSync(file) : {};
  } catch { return {}; }
}

function saveServerConfig(guildId, config) {
  if (!guildId) return false;
  fs.ensureDirSync(path.dirname(configFile(guildId)));
  fs.outputJSONSync(configFile(guildId), config, { spaces: 2 });
  return true;
}

/**
 * Lee un valor de config. Prioridad:
 *   1. data/servers/{guildId}/config.json
 *   2. process.env (legacy fallback)
 */
function get(guildId, keyPath) {
  if (guildId) {
    const config = loadServerConfig(guildId);
    const val    = getNested(config, keyPath);
    if (val !== undefined && val !== null && val !== '') return val;
  }

  const envVar = ENV_FALLBACK[keyPath];
  if (!envVar) return null;
  return parseEnvValue(process.env[envVar], TYPE_HINTS[keyPath]);
}

/** Escribe un valor en el config de un servidor. */
function set(guildId, keyPath, value) {
  if (!guildId) throw new Error('set() requiere guildId');
  const config = loadServerConfig(guildId);
  setNested(config, keyPath, value);
  saveServerConfig(guildId, config);
  return value;
}

// ── Getters de conveniencia ──────────────────────────────────────────────────

const getChannel = (guildId, type) => get(guildId, `channels.${type}`);
const getRole    = (guildId, type) => get(guildId, `roles.${type}`);
const getOwnerId = (guildId)       => get(guildId, 'ownerId');
const isOwner    = (guildId, userId) => getOwnerId(guildId) === userId;

/** ¿El servidor tiene configuración propia (paso por /setup)? */
function isConfigured(guildId) {
  if (!guildId) return false;
  return fs.existsSync(configFile(guildId));
}

module.exports = {
  get, set,
  getChannel, getRole, getOwnerId, isOwner,
  isConfigured,
  loadServerConfig, saveServerConfig,
  ENV_FALLBACK,
};
