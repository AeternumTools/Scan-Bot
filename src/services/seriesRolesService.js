// src/services/seriesRolesService.js
// Lógica de los roles de series por reacción (panel de roles en lectores).
// Fuente única: la usan tanto /rol como el agente IA.

const fs   = require('fs-extra');
const { Projects } = require('../utils/storage');

const ROLES_FILE       = './data/reaction_roles.json';
const ROLES_CHANNEL_ID = '1328526832328511488';
const TODAS_ROLE_ID    = '1480960597679149237';

// ── Storage ───────────────────────────────────────────────────────────────────
function loadRolesData() {
  try {
    if (fs.existsSync(ROLES_FILE)) return fs.readJsonSync(ROLES_FILE);
  } catch { /* archivo corrupto o inexistente */ }
  return { messageId: null, roles: [] };
  // roles: [{ projectId, projectName, roleId, emoji }]
}

function saveRolesData(data) {
  fs.ensureDirSync('./data');
  fs.writeJsonSync(ROLES_FILE, data, { spaces: 2 });
}

// Normaliza un emoji para comparar (custom <:n:id>/<a:n:id> o unicode)
function normalizeEmoji(e) {
  if (typeof e === 'string') return e;
  if (e.id) return `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;
  return e.name;
}

async function getReaderGuild(client) {
  const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
  if (!readerGuildId) return { error: 'DISCORD_READER_GUILD_ID no está configurado.' };
  const guild = await client.guilds.fetch(readerGuildId).catch(() => null);
  if (!guild) return { error: 'No pude acceder al servidor de lectores.' };
  return { guild };
}

// ── Crear rol de serie ─────────────────────────────────────────────────────────
async function crearRolSerie(client, projectId, emoji, { actor = 'Lumi' } = {}) {
  const project = Projects.get(projectId);
  if (!project) return { error: `Proyecto \`${projectId}\` no encontrado.` };

  const { guild, error } = await getReaderGuild(client);
  if (error) return { error };

  const rolesData = loadRolesData();
  const existing = rolesData.roles.find(r => r.projectId === projectId);
  if (existing) {
    return { error: `**${project.name}** ya tiene un rol vinculado (<@&${existing.roleId}>). Usa quitar primero si quieres recrearlo.` };
  }

  const newRole = await guild.roles.create({
    name: project.name,
    color: 0xFFFFFF,
    mentionable: true,
    reason: `Rol de serie creado por ${actor}`,
  });

  project.readerRoleId = newRole.id;
  Projects.save(project);

  rolesData.roles.push({ projectId, projectName: project.name, roleId: newRole.id, emoji: String(emoji).trim() });
  saveRolesData(rolesData);

  return {
    ok: true,
    roleId: newRole.id,
    mensaje: `Rol **${project.name}** creado en lectores y vinculado. Usa "publicar mensaje de roles" para actualizar el panel.`,
  };
}

// ── Publicar / actualizar el mensaje de roles ───────────────────────────────────
async function publicarMensajeRoles(client, { imagen = null, emojiTodas = null } = {}) {
  const rolesData = loadRolesData();
  if (!rolesData.roles.length) return { error: 'No hay roles de series creados todavía.' };

  const { guild, error } = await getReaderGuild(client);
  if (error) return { error };

  const channel = await guild.channels.fetch(ROLES_CHANNEL_ID).catch(() => null);
  if (!channel) return { error: `No encontré el canal de roles (${ROLES_CHANNEL_ID}).` };

  if (emojiTodas) {
    rolesData.emojiTodas = emojiTodas;
    saveRolesData(rolesData);
  }

  // ── Construir el contenido ────────────────────────────────────────────────
  const lines = [
    '@everyone', '',
    '## 🔔 ¡Elige tu Obra Favorita en Aeternum!', '',
    'En Aeternum cada lector tiene su obra. Para recibir notificaciones solo de lo que te interesa, activa el sistema de roles por serie.', '',
    '**📖 ¿Cómo funciona?**', '',
    'Reacciona con el emoji de la serie que quieres seguir. Es sencillo:',
    '• Recibirás mención cuando salga un nuevo capítulo',
    '• No recibirás notificaciones de series que no sigues',
    '• Puedes cambiar de opinión cuando quieras, solo quita tu reacción', '',
    'Elige bien.', '',
  ];
  for (const r of rolesData.roles) lines.push(`${r.emoji} — **${r.projectName}**`);
  if (rolesData.emojiTodas) lines.push(`${rolesData.emojiTodas} — **Todas las series**`);
  lines.push('', `⏳ Recuerda: Si quieres enterarte de absolutamente todo lo que pasa en el scan (eventos, reclutamiento, noticias generales), asegúrate de tener también el rol de <@&${TODAS_ROLE_ID}>`);
  const content = lines.join('\n');

  // ── Crear o editar el mensaje ─────────────────────────────────────────────
  let message = null;
  if (rolesData.messageId) {
    message = await channel.messages.fetch(rolesData.messageId).catch(() => null);
    if (message) await message.edit({ content });
  }
  if (!message) {
    message = await channel.send({ content });
    rolesData.messageId = message.id;
    saveRolesData(rolesData);
  }

  if (imagen) {
    try { await message.edit({ content: message.content, files: [{ attachment: imagen, name: 'imagen.jpg' }] }); }
    catch { /* no crítico */ }
  }

  // ── Sincronizar reacciones (sin perder quién reaccionó) ───────────────────
  const allReactions = [...rolesData.roles];
  if (rolesData.emojiTodas) {
    allReactions.push({ emoji: rolesData.emojiTodas, roleId: TODAS_ROLE_ID, projectName: 'Todas las series', projectId: '__todas__' });
  }

  const emojisDeseados = allReactions.map(r => r.emoji);
  const reaccionesActuales = message.reactions.cache;
  const emojisActuales = [];
  reaccionesActuales.forEach(r => { if (r.me) emojisActuales.push(normalizeEmoji(r.emoji)); });

  for (const reaction of reaccionesActuales.values()) {
    if (!reaction.me) continue;
    if (!emojisDeseados.includes(normalizeEmoji(reaction.emoji))) {
      await reaction.users.remove(message.client.user.id).catch(() => {});
      await new Promise(res => setTimeout(res, 300));
    }
  }

  const warnings = [];
  for (const r of allReactions) {
    if (!emojisActuales.includes(r.emoji)) {
      try { await message.react(r.emoji); await new Promise(res => setTimeout(res, 500)); }
      catch (err) { warnings.push(`No pude reaccionar con ${r.emoji}: ${err.message}`); }
    }
  }

  return { ok: true, mensaje: 'Mensaje de roles publicado/actualizado.', messageId: message.id, warnings };
}

// ── Quitar un rol de serie del mensaje ──────────────────────────────────────────
async function quitarRolSerie(projectId) {
  const rolesData = loadRolesData();
  const idx = rolesData.roles.findIndex(r => r.projectId === projectId);
  if (idx === -1) return { error: `No hay rol vinculado al proyecto \`${projectId}\`.` };
  rolesData.roles.splice(idx, 1);
  saveRolesData(rolesData);
  return { ok: true, mensaje: `Vínculo de rol de \`${projectId}\` eliminado. Republica el mensaje para reflejar el cambio.` };
}

module.exports = {
  crearRolSerie, publicarMensajeRoles, quitarRolSerie,
  loadRolesData, saveRolesData,
  ROLES_CHANNEL_ID, TODAS_ROLE_ID,
};
