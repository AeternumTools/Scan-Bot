// src/events/ready.js
const { Events } = require('discord.js');
const monitor    = require('../services/monitor');
const logger     = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    logger.success('Bot', `Conectado como ${client.user.tag}`);
    logger.info('Bot', `Sirviendo en ${client.guilds.cache.size} servidor(es)`);

    // Actividad del bot
    client.user.setPresence({
      activities: [{ name: '📖 Monitoreando scans...', type: 3 }], // type 3 = Watching
      status: 'online',
    });

    // Iniciar el monitor de capítulos
    monitor.start(client);

    await logger.discord(client, 'success', 'Bot', `Bot iniciado correctamente: \`${client.user.tag}\``);
  },
};
