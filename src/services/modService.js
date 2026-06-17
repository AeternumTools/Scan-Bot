// src/services/modService.js
// Moderación básica de Discord usable desde cualquier servidor.
// Verifica que tanto el bot como el usuario que lo pide tengan permisos.

const { PermissionsBitField } = require('discord.js');
const logger = require('../utils/logger');

// Resuelve un usuario por ID o por mención (<@id>)
function parseUserId(input) {
  if (!input) return null;
  const m = String(input).match(/(\d{15,})/);
  return m ? m[1] : null;
}

// Verifica que el bot Y el solicitante tengan un permiso específico
async function ensurePermissions(message, permFlag, permName) {
  if (!message?.guild) throw new Error('Esta acción requiere estar en un servidor.');

  const me = message.guild.members.me;
  if (!me?.permissions.has(permFlag)) {
    throw new Error(`No tengo el permiso "${permName}" en este servidor.`);
  }

  if (!message.member?.permissions.has(permFlag)) {
    throw new Error(`Tú no tienes el permiso "${permName}" para usar esta acción.`);
  }
}

// Comprueba que el target sea moderable por el bot (jerarquía de roles)
async function fetchTarget(guild, userId) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) throw new Error(`No encontré al usuario con ID ${userId}.`);
  if (member.id === guild.ownerId) throw new Error('No puedo actuar sobre el dueño del servidor.');
  return member;
}

async function banUser({ message, usuario, razon = 'Sin razón especificada', dias_borrar = 0 }) {
  await ensurePermissions(message, PermissionsBitField.Flags.BanMembers, 'Banear miembros');
  const id = parseUserId(usuario);
  if (!id) throw new Error('Pásame un ID o mención de usuario válida.');

  const target = await fetchTarget(message.guild, id);
  if (!target.bannable) throw new Error(`No puedo banear a ${target.user.tag} — está por encima mío en la jerarquía.`);

  await target.ban({ reason: razon, deleteMessageDays: Math.min(7, Math.max(0, dias_borrar)) });
  logger.info('Mod', `Ban: ${target.user.tag} en ${message.guild.name} — ${razon}`);
  return { ok: true, mensaje: `${target.user.tag} fue baneado. Razón: ${razon}` };
}

async function kickUser({ message, usuario, razon = 'Sin razón especificada' }) {
  await ensurePermissions(message, PermissionsBitField.Flags.KickMembers, 'Expulsar miembros');
  const id = parseUserId(usuario);
  if (!id) throw new Error('Pásame un ID o mención de usuario válida.');

  const target = await fetchTarget(message.guild, id);
  if (!target.kickable) throw new Error(`No puedo expulsar a ${target.user.tag} — está por encima mío.`);

  await target.kick(razon);
  logger.info('Mod', `Kick: ${target.user.tag} en ${message.guild.name} — ${razon}`);
  return { ok: true, mensaje: `${target.user.tag} fue expulsado. Razón: ${razon}` };
}

async function timeoutUser({ message, usuario, minutos, razon = 'Sin razón especificada' }) {
  await ensurePermissions(message, PermissionsBitField.Flags.ModerateMembers, 'Aislar miembros');
  const id = parseUserId(usuario);
  if (!id) throw new Error('Pásame un ID o mención de usuario válida.');

  const mins = parseInt(minutos, 10);
  if (!Number.isFinite(mins) || mins < 1 || mins > 40320) {
    throw new Error('La duración debe ser entre 1 y 40320 minutos (28 días máx).');
  }

  const target = await fetchTarget(message.guild, id);
  if (!target.moderatable) throw new Error(`No puedo silenciar a ${target.user.tag} — está por encima mío.`);

  await target.timeout(mins * 60_000, razon);
  logger.info('Mod', `Timeout ${mins}min: ${target.user.tag} en ${message.guild.name} — ${razon}`);
  return { ok: true, mensaje: `${target.user.tag} fue silenciado por ${mins} minuto(s). Razón: ${razon}` };
}

async function untimeoutUser({ message, usuario }) {
  await ensurePermissions(message, PermissionsBitField.Flags.ModerateMembers, 'Aislar miembros');
  const id = parseUserId(usuario);
  if (!id) throw new Error('Pásame un ID o mención de usuario válida.');

  const target = await fetchTarget(message.guild, id);
  await target.timeout(null);
  logger.info('Mod', `Untimeout: ${target.user.tag} en ${message.guild.name}`);
  return { ok: true, mensaje: `Le quité el silencio a ${target.user.tag}.` };
}

// ── Roles de staff de Aeternum (clave → { id, name, extra:[ids] }) ───────────
// Fuente única; /moderar y el agente IA comparten este mapa.
const STAFF_ROLES = {
  profesor:    { id: '1450701377587122312', name: 'Profesor',    extra: [] },
  typesetter:  { id: '1368818361915408485', name: 'Typesetter',  extra: [] },
  cleaner:     { id: '1368818132948488294', name: 'Cleaner',     extra: [] },
  traductor:   { id: '1368817756870545510', name: 'Traductor',   extra: [] },
  editor:      { id: '1368817956657561650', name: 'Editor',      extra: ['1368818361915408485', '1368818280717877359', '1368818132948488294'] },
  qc:          { id: '1368818036437680128', name: 'QC',          extra: [] },
  redibujador: { id: '1368818280717877359', name: 'Redibujador', extra: ['1368818132948488294'] },
  staff:       { id: '1368818898677272597', name: 'Staff',       extra: [] },
  nuevo:       { id: '1368819324608974950', name: 'Nuevo',       extra: [] },
};

async function assignStaffRole({ message, usuario, rol }) {
  await ensurePermissions(message, PermissionsBitField.Flags.ManageRoles, 'Gestionar roles');
  const info = STAFF_ROLES[String(rol || '').toLowerCase()];
  if (!info) throw new Error(`Rol desconocido: "${rol}". Opciones: ${Object.keys(STAFF_ROLES).join(', ')}.`);
  const id = parseUserId(usuario);
  if (!id) throw new Error('Pásame un ID o mención de usuario válida.');
  const target = await message.guild.members.fetch(id).catch(() => null);
  if (!target) throw new Error(`No encontré al usuario con ID ${id} en este servidor.`);

  if (info === STAFF_ROLES.staff) await target.roles.remove(STAFF_ROLES.nuevo.id).catch(() => {});
  const added = [];
  for (const rId of [info.id, ...info.extra]) {
    const role = message.guild.roles.cache.get(rId);
    if (role) { await target.roles.add(role).catch(() => {}); added.push(role.name); }
  }
  logger.info('Mod', `Rol ${info.name} → ${target.user.tag}`);
  return { ok: true, mensaje: `Le di el rol ${info.name}${info.extra.length ? ` (+ extras)` : ''} a ${target.user.username}.`, roles: added };
}

async function removeStaffRole({ message, usuario, rol }) {
  await ensurePermissions(message, PermissionsBitField.Flags.ManageRoles, 'Gestionar roles');
  const info = STAFF_ROLES[String(rol || '').toLowerCase()];
  if (!info) throw new Error(`Rol desconocido: "${rol}". Opciones: ${Object.keys(STAFF_ROLES).join(', ')}.`);
  const id = parseUserId(usuario);
  if (!id) throw new Error('Pásame un ID o mención de usuario válida.');
  const target = await message.guild.members.fetch(id).catch(() => null);
  if (!target) throw new Error(`No encontré al usuario con ID ${id} en este servidor.`);

  const role = message.guild.roles.cache.get(info.id);
  if (role) await target.roles.remove(role).catch(() => {});
  logger.info('Mod', `Quitar rol ${info.name} → ${target.user.tag}`);
  return { ok: true, mensaje: `Le quité el rol ${info.name} a ${target.user.username}.` };
}

module.exports = {
  banUser, kickUser, timeoutUser, untimeoutUser,
  assignStaffRole, removeStaffRole, STAFF_ROLES,
};
