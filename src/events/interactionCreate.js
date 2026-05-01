// src/events/interactionCreate.js
const { Events } = require('discord.js');
const logger     = require('../utils/logger');

// ── Constantes y utilidades para los botones ─────────────────────────────────
const MOD_ROLE_ID = process.env.MOD_ROLE_ID || '1368818622750789633';

const ROLES_RECLU = { traductor: 'Traductor', cleaner: 'Cleaner / Redibujador', typesetter: 'Typer' };

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const K = {
  feliz:    () => pick(['(◕‿◕✿)','(ﾉ◕ヮ◕)ﾉ','(✿◠‿◠)','(*´▽`*)','(ﾉ´ヮ`)ﾉ*: ･ﾟ']),
  timida:   () => pick(['(〃>_<;〃)','(//>/<//)', '(〃ω〃)','(*ノωノ)','(//∇//)']),
  triste:   () => pick(['(;ω;)','(´；ω；`)','( ´•̥̥̥ω•̥̥̥` )','(╥_╥)']),
  tranqui:  () => pick(['(˘ω˘)','(っ˘ω˘ς)','( ´ ▽ ` )','(。◕‿◕。)','(￣▽￣)']),
};

// ── Funciones de botones (migradas desde suaAgent.js) ────────────────────────

/**
 * Maneja los botones de reclutamiento (staff)
 */
async function handleReclutamientoButton(interaction) {
  const { Reclutamiento } = require('../utils/storage');
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const id = interaction.customId;
  if (!id.startsWith('reclu_leido_') && !id.startsWith('reclu_cancelar_') &&
      !id.startsWith('reclu_aceptar_') && !id.startsWith('reclu_rechazar_')) return false;

  const solicitudId = id.replace('reclu_leido_', '').replace('reclu_cancelar_', '')
                       .replace('reclu_aceptar_', '').replace('reclu_rechazar_', '');
  const solicitud   = Reclutamiento.get(solicitudId);

  if (!solicitud || solicitud.estado !== 'pendiente') {
    await interaction.reply({ content: `Esa postulación ya no está pendiente ${K.timida()}`, ephemeral: true });
    return true;
  }

  if (id.startsWith('reclu_aceptar_') || id.startsWith('reclu_rechazar_')) {
    const resultado = id.startsWith('reclu_aceptar_') ? 'aceptado' : 'rechazado';
    const resultadoLabel = resultado === 'aceptado' ? 'aceptada' : 'rechazada';

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reclu_confirmar_${resultado}_${solicitudId}`)
        .setLabel(`Sí, ${resultadoLabel}`)
        .setStyle(resultado === 'aceptado' ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`reclu_no_${resultado}_${solicitudId}`)
        .setLabel('No, cancelar')
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({
      content: `¿Estás seguro de marcar esta postulación como **${resultado}**? ${K.timida()} Esto le enviará un DM al usuario.`,
      components: [row],
      ephemeral: true,
    });
    return true;
  }

  if (id.startsWith('reclu_confirmar_aceptar_') || id.startsWith('reclu_confirmar_rechazar_')) {
    const resultado = id.includes('aceptar') ? 'aceptado' : 'rechazado';
    const resultadoLabel = resultado === 'aceptado' ? 'aceptada' : 'rechazada';
    Reclutamiento.cerrar(solicitudId, interaction.user.id, resultado);

    const dmMsg = resultado === 'aceptado'
      ? `¡Hola **${solicitud.usuarioName}**! ${K.feliz()} Tu postulación para **${ROLES_RECLU[solicitud.rolInteres]}** fue **aceptada**. ¡Bienvenido/a al equipo de Aeternum Translations! El staff se comunicará contigo pronto.`
      : `Hola **${solicitud.usuarioName}** ${K.tranqui()} Gracias por tu interés en Aeternum. Por ahora tu postulación para **${ROLES_RECLU[solicitud.rolInteres]}** no pudo continuar. ¡No te desanimes!`;

    try {
      const u = await interaction.client.users.fetch(solicitud.usuarioId);
      if (u) await u.send(dmMsg).catch(() => {});
    } catch { /* ok */ }

    // Cerrar canal temporal
    const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
    if (solicitud.channelId && readerGuildId) {
      try {
        const readerGuild = await interaction.client.guilds.fetch(readerGuildId);
        const c = await readerGuild.channels.fetch(solicitud.channelId);
        if (c) {
          await c.send(`🔒 La postulación fue ${resultadoLabel} por el staff. Este canal se cerrará en 15 segundos.`);
          setTimeout(() => c.delete(`Postulación ${resultadoLabel}`).catch(() => {}), 15_000);
        }
      } catch (err) {
        logger.error('Reclutamiento', `Error cerrando canal del candidato: ${err.message}`);
      }
    }

    // Editar el mensaje original del canal de alertas
    try {
      const emoji = resultado === 'aceptado' ? '🎉' : '❌';
      await interaction.message.edit({ content: interaction.message.content + `\n\n${emoji} **${resultadoLabel}** por <@${interaction.user.id}>`, components: [] });
    } catch { /* ok */ }

    await interaction.reply({ content: `Postulación de **${solicitud.usuarioName}** ${resultadoLabel} ${K.feliz()} El usuario fue notificado.`, ephemeral: true });
    return true;
  }

  if (id.startsWith('reclu_no_aceptar_') || id.startsWith('reclu_no_rechazar_')) {
    await interaction.reply({ content: `De acuerdo, la postulación sigue pendiente ${K.tranqui()}`, ephemeral: true });
    return true;
  }

  if (id.startsWith('reclu_cancelar_')) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reclu_confirmar_cancelar_${solicitudId}`)
        .setLabel('Sí, cancelar postulación')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`reclu_no_cancelar_${solicitudId}`)
        .setLabel('No, dejar pendiente')
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({
      content: pick([
        `¿Estás seguro de que quieres cancelar la postulación de **${solicitud.usuarioName}**? ${K.timida()} Esto le enviará un DM notificándole.`,
        `E-eh... ¿cancelamos la postulación de **${solicitud.usuarioName}**? ${K.tranqui()} Confirma por favor.`,
      ]),
      components: [row],
      ephemeral: true,
    });
    return true;
  }

  if (id.startsWith('reclu_confirmar_cancelar_')) {
    Reclutamiento.cerrar(solicitudId, interaction.user.id, 'cerrado');
    try {
      const u = await interaction.client.users.fetch(solicitud.usuarioId);
      if (u) await u.send(`Hola **${solicitud.usuarioName}** ${K.tranqui()} Tu solicitud de postulación fue cancelada. Si tienes dudas, puedes volver a escribir en el canal de reclutamiento.`).catch(() => {});
    } catch { /* ok */ }

    const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
    if (solicitud.channelId && readerGuildId) {
      try {
        const readerGuild = await interaction.client.guilds.fetch(readerGuildId);
        const c = await readerGuild.channels.fetch(solicitud.channelId);
        if (c) {
          await c.send(`🔒 La postulación fue cancelada por el staff. Este canal se cerrará en 15 segundos.`);
          setTimeout(() => c.delete('Postulación cancelada').catch(() => {}), 15_000);
        }
      } catch (err) {
        logger.error('Reclutamiento', `Error cerrando canal del candidato: ${err.message}`);
      }
    }

    try {
      await interaction.message.edit({ content: interaction.message.content + `\n\n❌ **Cancelada** por <@${interaction.user.id}>`, components: [] });
    } catch { /* ok */ }

    await interaction.reply({ content: `Postulación de **${solicitud.usuarioName}** cancelada ${K.tranqui()} El usuario fue notificado.`, ephemeral: true });
    return true;
  }

  if (id.startsWith('reclu_no_cancelar_')) {
    await interaction.reply({ content: `De acuerdo, la postulación sigue pendiente ${K.tranqui()}`, ephemeral: true });
    return true;
  }

  if (id.startsWith('reclu_leido_')) {
    try {
      await interaction.message.edit({
        content: interaction.message.content + `\n\n✅ **Revisado** por <@${interaction.user.id}>`,
        components: [],
      });
    } catch { /* ok */ }

    const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
    if (solicitud.channelId && readerGuildId) {
      try {
        const readerGuild = await interaction.client.guilds.fetch(readerGuildId);
        const c = await readerGuild.channels.fetch(solicitud.channelId);
        if (c) {
          await c.send(pick([
            `¡Hola **${solicitud.usuarioName}**! ${K.feliz()} Alguien del equipo ya revisó tu postulación y se pondrá en contacto contigo muy pronto. ¡Ten paciencia!`,
            `¡Buenas noticias **${solicitud.usuarioName}**! ${K.tranqui()} Un miembro del staff ya vio tu solicitud y estará contigo en breve.`,
          ]));
        }
      } catch (err) {
        logger.error('Reclutamiento', `Error enviando mensaje al canal del candidato: ${err.message}`);
      }
    }

    await interaction.reply({
      content: pick([
        `Avisé al candidato que alguien ya lo revisó ${K.feliz()} El canal de postulación está en el servidor de lectores.`,
        `Listo ${K.tranqui()} Le informé a **${solicitud.usuarioName}** que alguien del staff lo atenderá pronto.`,
      ]),
      ephemeral: true,
    });
    return true;
  }

  return false;
}

/**
 * Inicia el flujo de creación de ticket
 */
async function startTicketButtonFlow(interaction) {
  const { ChannelType, PermissionFlagsBits } = require('discord.js');

  await interaction.deferReply({ ephemeral: true });

  const readerGuildId = process.env.DISCORD_READER_GUILD_ID || interaction.guildId;
  let readerGuild;
  try { readerGuild = await interaction.client.guilds.fetch(readerGuildId); }
  catch { return interaction.editReply(`No pude acceder al servidor ${K.triste()}`); }

  let canal;
  try {
    const nombreUsuario = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20);
    canal = await readerGuild.channels.create({
      name: `ticket-${nombreUsuario}`,
      type: ChannelType.GuildText,
      topic: `Ticket de error de ${interaction.user.username}`,
      permissionOverwrites: [
        { id: readerGuild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: MOD_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });
  } catch (err) {
    return interaction.editReply(`No pude crear tu canal. ${err.message}`);
  }

  await interaction.editReply(`✅ Creado: <#${canal.id}> ${K.feliz()}`);

  // Nota: setSession ya no está disponible sin suaAgent
  // Las sesiones se manejarán de forma diferente o se eliminan
  await canal.send(`¡Hola <@${interaction.user.id}>! ${K.feliz()} Vamos a crear tu ticket. ¿En qué proyecto encontraste el error?\n\n` +
    `**Proyectos disponibles:**\n• Colorcito\n• Otros`);
}

/**
 * Inicia el flujo de reclutamiento
 */
async function startReclutamientoButtonFlow(interaction) {
  const { ChannelType, PermissionFlagsBits } = require('discord.js');

  await interaction.deferReply({ ephemeral: true });

  const readerGuildId = process.env.DISCORD_READER_GUILD_ID || interaction.guildId;
  let readerGuild;
  try { readerGuild = await interaction.client.guilds.fetch(readerGuildId); }
  catch { return interaction.editReply(`No pude acceder al server ${K.triste()}`); }

  let canal;
  try {
    const nombreUsuario = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20);
    canal = await readerGuild.channels.create({
      name: `r-${nombreUsuario}`,
      type: ChannelType.GuildText,
      topic: `Postulación de ${interaction.user.username}`,
      permissionOverwrites: [
        { id: readerGuild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });
  } catch (err) {
    return interaction.editReply(`No pude crear tu canal. ${err.message}`);
  }

  await interaction.editReply(`✅ Creado: <#${canal.id}> ${K.feliz()}`);

  await canal.send(pick([
    `¡Hola <@${interaction.user.id}>! ${K.feliz()} Qué bueno que quieras unirte al equipo. ¿En qué rol te interesa colaborar?\n\`traductor\` · \`cleaner\` · \`typesetter\``,
  ]));
}

// ────────────────────────────────────────────────────────────────────────────

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    // ── Botones ────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      // Botones de inicio de flujos conversacionales
      if (interaction.customId === 'btn_crear_ticket') {
        try { return await startTicketButtonFlow(interaction); }
        catch (err) { logger.error('Button', `Error ticket flow: ${err.message}`); }
      }

      if (interaction.customId === 'btn_crear_reclutamiento') {
        try { return await startReclutamientoButtonFlow(interaction); }
        catch (err) { logger.error('Button', `Error reclu flow: ${err.message}`); }
      }

      // Botones de reclutamiento (staff)
      if (
        interaction.customId.startsWith('reclu_leido_') ||
        interaction.customId.startsWith('reclu_cancelar_') ||
        interaction.customId.startsWith('reclu_confirmar_') ||
        interaction.customId.startsWith('reclu_no_cancelar_') ||
        interaction.customId.startsWith('reclu_aceptar_') ||
        interaction.customId.startsWith('reclu_rechazar_') ||
        interaction.customId.startsWith('reclu_no_aceptar_') ||
        interaction.customId.startsWith('reclu_no_rechazar_')
      ) {
        try {
          await handleReclutamientoButton(interaction);
        } catch (err) {
          logger.error('Button', `Error en botón de reclutamiento: ${err.message}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'A-ay... algo salió mal con ese botón (;ω;)', ephemeral: true }).catch(() => {});
          }
        }
        return;
      }
    }

    // ── Slash commands ─────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (err) {
        logger.error('Interaction', `Error en /${interaction.commandName}: ${err.message}`);
        const msg = { content: 'A-ay... algo salió mal al ejecutar ese comando (;ω;) ¿Podrías intentarlo de nuevo?', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      }
    }

    // ── Autocomplete ───────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        logger.error('Autocomplete', `Error en /${interaction.commandName}: ${err.message}`);
      }
    }
  },
};
