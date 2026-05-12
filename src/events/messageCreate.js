// src/events/messageCreate.js
const { Events } = require('discord.js');
const lumiAgent  = require('./lumiAgent');
const { callAgent }                       = require('../services/groqService');
const { DEFINITIONS, getExecutors }       = require('../services/lumiTools');
const { buildSystemPrompt }               = require('../utils/lumi');
const { loadConversation, appendToConversation, touchStaff, buildMemoryContext } = require('../services/memoryService');
const logger = require('../utils/logger');

function isAllowedGuild(guildId) {
  return (
    guildId === process.env.DISCORD_GUILD_ID ||
    guildId === process.env.DISCORD_READER_GUILD_ID
  );
}

function getAllowedRoles() {
  return (process.env.LUMI_AI_STAFF_ROLE_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
}

function memberHasRole(member, roleIds) {
  if (!roleIds.length) return true;
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
      message.mentions.has(message.client.user, { ignoreEveryone: true, ignoreRoles: true }) &&
      memberHasRole(message.member, allowedRoles)
    ) {
      await message.channel.sendTyping();

      const { id: authorId, username } = message.author;
      const channelId = message.channel.id;
      const userText  = message.content.replace(/<@!?\d+>/g, '').trim();
      const userMsg   = { role: 'user', content: `[${username}|${authorId}]: ${userText}` };

      try {
        // Registrar al usuario y cargar contexto de memoria
        touchStaff(authorId, username);
        const memoryContext = buildMemoryContext();
        const systemPrompt  = buildSystemPrompt(memoryContext);

        // Historial persistente del canal (sobrevive reinicios y cambios de modelo)
        const history = loadConversation(channelId);

        const messages = [
          { role: 'system', content: systemPrompt },
          ...history,
          userMsg,
        ];

        const reply = await callAgent(
          messages,
          DEFINITIONS,
          getExecutors({ client: message.client }),
        );

        // Guardar el intercambio en disco
        appendToConversation(channelId, userMsg, { role: 'assistant', content: reply });

        await message.reply(reply);
      } catch (err) {
        logger.error('LumiAI', `Error en agente: ${err.message}`);
        await message.reply('Algo salió mal. Intenta de nuevo.');
      }
      return;
    }

    // ── Flujo existente: tickets y reclutamiento ──────────────────────────────
    await lumiAgent.execute(message);
  },
};
