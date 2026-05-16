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

module.exports = { banUser, kickUser, timeoutUser, untimeoutUser };
