// src/services/announcer.js
// Anuncios en texto plano estilo Discord (sin embeds)

const { REACTIONS, SOURCES, ANNOUNCEMENT_FOOTER } = require('../../config/config');
const logger = require('../utils/logger');

async function getAnnouncementChannel(client, channelId) {
  if (!channelId) return null;
  const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
  if (readerGuildId) {
    try {
      const guild = await client.guilds.fetch(readerGuildId);
      const ch = await guild.channels.fetch(channelId).catch(() => null);
      if (ch) return ch;
    } catch { }
  }
  return client.channels.fetch(channelId).catch(() => null);
}

/**
 * Construye el mensaje de texto plano del anuncio.
 *
 * Estructura:
 *   @Rol (ping)
 *   mensaje personalizado
 *
 *   **Título del proyecto**
 *   Capítulo X
 *
 *   🔗 TMO: <url>
 *   🔗 COLORCITO: <url>
 *
 *   🕊️ Staff celestial: @Persona1 @Persona2
 *
 *   💬 Comparte tu bendición...
 *   ⚠️ Si no es TMO o COLORCITO...
 */
function buildAnnouncementText(project, chapData, options = {}) {
  const { customMessage, credits = [], extraRoles = [] } = options;
  const lines = [];

  // ── Pings ──────────────────────────────────────────────────────────────────
  // Siempre @everyone + opcionalmente el rol de la serie y roles extra
  const pings = ['@everyone'];
  const baseRole = project.readerRoleId || project.roleId;
  if (baseRole) pings.push(`<@&${baseRole}>`);
  extraRoles.forEach(r => pings.push(`<@&${r}>`));
  lines.push(pings.join(' '));

  // ── Mensaje personalizado ──────────────────────────────────────────────────
  if (customMessage) {
    lines.push('');
    lines.push(customMessage);
  }

  // ── Título y capítulo ─────────────────────────────────────────────────────
  lines.push('');
  lines.push(`# ${project.name}`);
  lines.push(`Capítulo ${chapData.chapterNum}${chapData.chapterTitle ? `: ${chapData.chapterTitle}` : ''}`);

  // ── Links de plataformas ──────────────────────────────────────────────────
  const linkLines = [];
  // <url> suprime la integración/preview en Discord
  if (project.sources?.tmo && chapData.urlTmo) {
    linkLines.push(`🔗 ${SOURCES.tmo.label}: <${chapData.urlTmo}>`);
  } else if (project.sources?.tmo) {
    linkLines.push(`🔗 ${SOURCES.tmo.label}: <${project.sources.tmo}>`);
  }
  if (project.sources?.colorcito && chapData.urlColorcito) {
    linkLines.push(`🔗 ${SOURCES.colorcito.label}: <${chapData.urlColorcito}>`);
  } else if (project.sources?.colorcito) {
    linkLines.push(`🔗 ${SOURCES.colorcito.label}: <${project.sources.colorcito}>`);
  }

  if (linkLines.length) {
    lines.push('');
    linkLines.forEach(l => lines.push(l));
  }

  // ── Créditos / Staff ──────────────────────────────────────────────────────
  const allCredits = [...credits];
  if (!allCredits.length && project.defaultCredits) {
    allCredits.push(project.defaultCredits);
  }

  if (allCredits.length) {
    lines.push('');
    lines.push('🕊️ Staff celestial:');
    allCredits.forEach(c => lines.push(c));
  }

  // ── Pie fijo ──────────────────────────────────────────────────────────────
  if (ANNOUNCEMENT_FOOTER?.length) {
    lines.push('');
    ANNOUNCEMENT_FOOTER.forEach(l => lines.push(l));
  }

  return lines.join('\n');
}

/**
 * Envía el anuncio automático cuando el monitor detecta un nuevo capítulo.
 */
async function sendAnnouncement(client, project, chapData, source) {
  if (!client?.isReady()) return;

  const channelId = project.announcementChannel || process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) {
    logger.warn('Announcer', `Sin canal de anuncio para ${project.name}`);
    return;
  }

  const channel = await getAnnouncementChannel(client, channelId);
  if (!channel) {
    logger.error('Announcer', `Canal ${channelId} no encontrado`);
    return;
  }

  // Para anuncios automáticos, obtener ambas URLs si el proyecto las tiene
  const chapDataFull = {
    ...chapData,
    urlTmo:       source === 'tmo'       ? chapData.chapterUrl : null,
    urlColorcito: source === 'colorcito' ? chapData.chapterUrl : null,
  };

  const text = buildAnnouncementText(project, chapDataFull);
  const message = await channel.send({ content: text });

  await addReactions(message, project.reactions || REACTIONS.newChapter);

  logger.success('Announcer', `Anuncio enviado: ${project.name} cap. ${chapData.chapterNum}`);
  return message;
}

/**
 * Envía un anuncio manual con todas las opciones (desde /anunciar).
 */
async function sendManualAnnouncement(client, project, chapData, options = {}) {
  if (!client?.isReady()) return null;

  const channelId = project.announcementChannel || process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) return null;

  const channel = await getAnnouncementChannel(client, channelId);
  if (!channel) return null;

  const text = buildAnnouncementText(project, chapData, options);

  // Si hay portada, enviarla como imagen adjunta al mismo mensaje
  const messagePayload = { content: text };
  if (options.imageUrl) {
    messagePayload.files = [{ attachment: options.imageUrl, name: 'portada.jpg' }];
  }

  const message = await channel.send(messagePayload);
  await addReactions(message, project.reactions || REACTIONS.newChapter);

  return message;
}

async function addReactions(message, reactions) {
  for (const emoji of reactions) {
    try {
      await message.react(emoji);
      await sleep(400); // pausa entre reacciones para no saturar la API
    } catch (err) {
      logger.warn('Announcer', `No se pudo reaccionar con ${emoji}: ${err.message}`);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { sendAnnouncement, sendManualAnnouncement, buildAnnouncementText };
