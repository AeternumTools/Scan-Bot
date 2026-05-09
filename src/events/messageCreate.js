// src/events/messageCreate.js
// Escucha mensajes: agente IA si mencionan a Lumi en canal staff, tickets/reclutamiento en el resto
const { Events } = require('discord.js');
const lumiAgent  = require('./lumiAgent');
const { callAgent }                 = require('../services/groqService');
const { DEFINITIONS, getExecutors } = require('../services/lumiTools');
const { SYSTEM_PROMPT }             = require('../utils/lumi');
const logger                        = require('../utils/logger');

const MAX_HISTORY = 8;

// Servidores donde el agente está activo (los dos ya definidos en .env)
function isAllowedGuild(guildId) {
  return (
    guildId === process.env.DISCORD_GUILD_ID ||
    guildId === process.env.DISCORD_READER_GUILD_ID
  );
}

// Roles autorizados — LUMI_AI_STAFF_ROLE_IDS (comma-separated, opcional)
function getAllowedRoles() {
  return (process.env.LUMI_AI_STAFF_ROLE_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
}

function memberHasRole(member, roleIds) {
  if (!roleIds.length) return true; // sin restricción configurada → todos pueden
  return roleIds.some(id => member.roles.cache.has(id));
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {

    // ── Agente de IA ─────────────────────────────────────────────────────────
    const allowedRoles = getAllowedRoles();

    if (
      message.guild &&
      isAllowedGuild(message.guild.id) &&
      !message.author.bot &&
      message.mentions.has(message.client.user) &&
      memberHasRole(message.member, allowedRoles)
    ) {
      await message.channel.sendTyping();

      try {
        // Historial reciente del canal (sin el mensaje actual)
        const fetched = await message.channel.messages.fetch({ limit: MAX_HISTORY, before: message.id });
        const history = [...fetched.values()]
          .reverse()
          .map(m => ({
            role:    m.author.id === message.client.user.id ? 'assistant' : 'user',
            content: m.author.id === message.client.user.id
              ? m.content
              : `[${m.author.username}|${m.author.id}]: ${m.content}`,
          }));

        // Texto del mensaje sin los mentions
        const userText = message.content.replace(/<@!?\d+>/g, '').trim();

        const messages = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history,
          { role: 'user', content: `[${message.author.username}|${message.author.id}]: ${userText}` },
        ];

        const reply = await callAgent(
          messages,
          DEFINITIONS,
          getExecutors({ client: message.client }),
        );

        await message.reply(reply);
      } catch (err) {
        logger.error('LumiAI', `Error en agente: ${err.message}`);
        await message.reply('Algo salió mal procesando tu consulta. Inténtalo de nuevo.');
      }
      return;
    }

    // ── Flujo existente: tickets y reclutamiento ──────────────────────────────
    await lumiAgent.execute(message);
  },
};
