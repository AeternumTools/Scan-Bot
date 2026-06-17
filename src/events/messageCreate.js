// src/events/messageCreate.js
const { Events } = require('discord.js');
const lumiAgent  = require('./lumiAgent');
const { callAgent }                       = require('../services/groqService');
const { getDefinitions, getExecutors }    = require('../services/lumiTools');
const { buildSystemPrompt }               = require('../utils/lumi');
const { loadConversation, appendToConversation, touchStaff, buildMemoryContext } = require('../services/memoryService');
const serverConfig = require('../services/serverConfigService');
const logger = require('../utils/logger');

// Un servidor es "home" si tiene config propia o si es uno de los legacy del .env
function isHomeGuild(guildId) {
  if (serverConfig.isConfigured(guildId)) return true;
  return (
    guildId === process.env.DISCORD_GUILD_ID ||
    guildId === process.env.DISCORD_READER_GUILD_ID
  );
}

function getAllowedRoles(guildId) {
  return serverConfig.get(guildId, 'roles.aiStaff') || [];
}

function memberHasRole(member, roleIds) {
  if (!roleIds.length) return true;
  return roleIds.some(id => member.roles.cache.has(id));
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {

    // ── Agente de IA ─────────────────────────────────────────────────────────
    if (
      !message.guild ||
      message.author.bot ||
      !message.mentions.has(message.client.user, { ignoreEveryone: true, ignoreRoles: true })
    ) {
      // No es para Lumi → flujo de tickets/reclutamiento
      await lumiAgent.execute(message);
      return;
    }

    const isHome = isHomeGuild(message.guild.id);
    const mode   = isHome ? 'home' : 'external';

    // En servidores caseros exigimos rol de staff. En externos, cualquiera puede chatear.
    if (isHome) {
      const allowedRoles = getAllowedRoles(message.guild.id);
      if (!memberHasRole(message.member, allowedRoles)) {
        await lumiAgent.execute(message);
        return;
      }
    }

    {
      await message.channel.sendTyping();

      const { id: authorId, username } = message.author;
      const channelId = message.channel.id;
      const userText  = message.content.replace(/<@!?\d+>/g, '').trim();
      const userMsg   = { role: 'user', content: `[${username}|${authorId}]: ${userText}` };

      try {
        // Registrar al usuario y cargar contexto de memoria solo en home
        if (isHome) touchStaff(authorId, username);
        const memoryContext = isHome ? buildMemoryContext() : '';
        const ownerId       = serverConfig.getOwnerId(message.guild.id);
        const systemPrompt  = buildSystemPrompt(memoryContext, {
          mode,
          guildName: message.guild.name,
          ownerId,
        });

        const history = loadConversation(channelId);

        const messages = [
          { role: 'system', content: systemPrompt },
          ...history,
          userMsg,
        ];

        const reply = await callAgent(
          messages,
          getDefinitions(mode),
          getExecutors({ client: message.client, message, mode }),
        );

        appendToConversation(channelId, userMsg, { role: 'assistant', content: reply });
        await message.reply(reply);
      } catch (err) {
        logger.error('LumiAI', `Error en agente: ${err.message}`);
        const esLimite = /429|rate limit|too many|tokens per|TPD|RPM|límite/i.test(err.message);
        await message.reply(
          esLimite
            ? 'Estoy saturada en este momento (límite de la API). Dame unos segundos y lo vuelves a intentar.'
            : `Algo salió mal: ${err.message}`
        );
      }
    }
  },
};
