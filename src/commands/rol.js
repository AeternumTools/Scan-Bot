// src/commands/rol.js
// /rol crear  — crea un rol para una serie en el servidor de lectores
// /rol mensaje — publica/actualiza el mensaje de reacción para obtener roles
// La lógica vive en services/seriesRolesService.js (compartida con el agente IA).

const { SlashCommandBuilder } = require('discord.js');
const { Projects } = require('../utils/storage');
const LUMI = require('../utils/lumi');
const seriesRoles = require('../services/seriesRolesService');

const data = new SlashCommandBuilder()
  .setName('rol')
  .setDescription('Gestión de roles de series')
  .addSubcommand(sub =>
    sub.setName('crear')
      .setDescription('Crea un rol para una serie y lo vincula al proyecto')
      .addStringOption(o =>
        o.setName('proyecto').setDescription('Proyecto al que vincular el rol').setRequired(true).setAutocomplete(true)
      )
      .addStringOption(o =>
        o.setName('emoji').setDescription('Emoji para el mensaje de roles (ej: 🔥 o ID de emoji custom)').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('mensaje')
      .setDescription('Publica o actualiza el mensaje de reacción para obtener roles de series')
      .addStringOption(o =>
        o.setName('imagen').setDescription('URL de imagen a adjuntar al mensaje (opcional)')
      )
      .addStringOption(o =>
        o.setName('emoji_todas').setDescription('Emoji para el rol "Todas las series" (opcional, se guarda para siempre)')
      )
  )
  .addSubcommand(sub =>
    sub.setName('quitar')
      .setDescription('Quita un rol de series del mensaje de reacción')
      .addStringOption(o =>
        o.setName('proyecto').setDescription('Proyecto a quitar').setRequired(true).setAutocomplete(true)
      )
  );

async function autocomplete(interaction) {
  try {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = Projects.list()
      .filter(p => p.name.toLowerCase().includes(focused) || p.id.includes(focused))
      .slice(0, 25)
      .map(p => ({ name: p.name, value: p.id }));
    await interaction.respond(choices);
  } catch { /* ignorar si la interacción ya expiró */ }
}

async function execute(interaction) {
  const ALLOWED_ROLE = process.env.ANNOUNCER_ROLE_ID;
  const hasRole = ALLOWED_ROLE
    ? interaction.member.roles.cache.has(ALLOWED_ROLE)
    : interaction.member.permissions.has('ManageGuild');
  if (!hasRole) {
    return interaction.reply({ content: LUMI.sinPermisos, ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();
  if (sub === 'crear')   return handleCrear(interaction);
  if (sub === 'mensaje') return handleMensaje(interaction);
  if (sub === 'quitar')  return handleQuitar(interaction);
}

// ── /rol crear ────────────────────────────────────────────────────────────────
async function handleCrear(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const projectId = interaction.options.getString('proyecto');
  const emoji     = interaction.options.getString('emoji').trim();

  const result = await seriesRoles.crearRolSerie(interaction.client, projectId, emoji, { actor: interaction.user.tag });
  if (result.error) return interaction.editReply(`❌ ${result.error}`);
  await interaction.editReply(`✅ ${result.mensaje}`);
}

// ── /rol mensaje ──────────────────────────────────────────────────────────────
async function handleMensaje(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const imagen     = interaction.options.getString('imagen') || null;
  const emojiTodas = interaction.options.getString('emoji_todas') || null;

  const result = await seriesRoles.publicarMensajeRoles(interaction.client, { imagen, emojiTodas });
  if (result.error) return interaction.editReply(`❌ ${result.error}`);

  for (const w of result.warnings || []) {
    await interaction.followUp({ content: `⚠️ ${w}`, ephemeral: true }).catch(() => {});
  }
  await interaction.editReply(LUMI.rol.mensajeActualizado);
}

// ── /rol quitar ───────────────────────────────────────────────────────────────
async function handleQuitar(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const projectId = interaction.options.getString('proyecto');
  const result = await seriesRoles.quitarRolSerie(projectId);
  if (result.error) return interaction.editReply(LUMI.rol.noVinculado(projectId));
  await interaction.editReply(LUMI.rol.quitado(projectId));
}

module.exports = { data, execute, autocomplete };
module.exports.TODAS_ROLE_ID = seriesRoles.TODAS_ROLE_ID;
