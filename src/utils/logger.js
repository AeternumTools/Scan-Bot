// src/utils/logger.js — Logger con timestamps y niveles
const { COLORS } = require('../../config/config');

const LEVELS = { info: '🔵', warn: '🟡', error: '🔴', success: '🟢', debug: '⚪' };

function timestamp() {
  return new Date().toLocaleString('es-CO', {
    timeZone: process.env.TIMEZONE || 'America/Bogota',
    hour12: false,
  });
}

function log(level, module, message, extra = '') {
  const icon  = LEVELS[level] || '⚪';
  const extra_str = extra ? ` | ${typeof extra === 'object' ? JSON.stringify(extra) : extra}` : '';
  console.log(`${icon} [${timestamp()}] [${module}] ${message}${extra_str}`);
}

// Enviar log al canal de Discord si el cliente está listo
async function discordLog(client, level, module, message) {
  if (!process.env.LOG_CHANNEL_ID || !client?.isReady()) return;
  try {
    const channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);
    if (!channel) return;
    const icon = LEVELS[level] || '⚪';
    await channel.send(`${icon} \`[${module}]\` ${message}`);
  } catch { /* silencioso si falla */ }
}

module.exports = {
  info:    (mod, msg, extra) => log('info',    mod, msg, extra),
  warn:    (mod, msg, extra) => log('warn',    mod, msg, extra),
  error:   (mod, msg, extra) => log('error',   mod, msg, extra),
  success: (mod, msg, extra) => log('success', mod, msg, extra),
  debug:   (mod, msg, extra) => log('debug',   mod, msg, extra),
  discord: discordLog,
};
