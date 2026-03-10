// src/commands/avisar.js
// /avisar — publica un aviso oficial de texto libre en el servidor de lectores

const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
  .setName('avisar')
  .setDescription('Publica un aviso oficial en el servidor de lectores')
  .addStringOption(o =>
    o.setName('titulo').setDescription('Título del aviso (ej: 📢 Anuncio Oficial)').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('mensaje').setDescription('Cuerpo del mensaje (usa \\n para saltos de línea)').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('ping').setDescription('A quién mencionar')
      .addChoices(
        { name: '@everyone',   value: 'everyone' },
        { name: '@here',       value: 'here'     },
        { name: 'Sin mención', value: 'none'     },
      )
  )
  .addRoleOption(o =>
    o.setName('rol').setDescription('Rol específico a mencionar (opcional)')
  )
  .addStringOption(o =>
    o.setName('firma').setDescription('Firma al pie (por defecto: Líder del equipo de Aeternum Translations)')
  )
  .addStringOption(o =>
    o.setName('imagen').setDescription('URL directa de la imagen a adjuntar (opcional)')
  );

async function execute(interaction) {
  // Solo el rol autorizado puede usarlo
  const ALLOWED_ROLE = process.env.ANNOUNCER_ROLE_ID;
  const hasRole = ALLOWED_ROLE
    ? interaction.member.roles.cache.has(ALLOWED_ROLE)
    : interaction.member.permissions.has('ManageGuild');

  if (!hasRole) {
    return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const titulo   = interaction.options.getString('titulo');
  const mensaje  = interaction.options.getString('mensaje').replace(/\\n/g, '\n');
  const pingOpt  = interaction.options.getString('ping') || 'everyone';
  const rol      = interaction.options.getRole('rol') || null;
  const firma    = interaction.options.getString('firma') || 'Líder del equipo de Aeternum Translations.';
  const imagen   = interaction.options.getString('imagen') || null;

  // ── Construir el mensaje ─────────────────────────────────────────────────
  const lines = [];

  // Ping
  if (pingOpt === 'everyone') lines.push('@everyone');
  else if (pingOpt === 'here') lines.push('@here');
  if (rol) lines.push(`<@&${rol.id}>`);

  lines.push('');
  lines.push(`## ${titulo}`);
  lines.push('');
  lines.push(mensaje);
  lines.push('');
  lines.push(`Atentamente,`);
  lines.push(`**${firma}**`);

  const content = lines.join('\n');

  // ── Enviar al canal de anuncios ──────────────────────────────────────────
  const channelId = process.env.NOTICE_CHANNEL_ID || process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) {
    return interaction.editReply('❌ No hay canal de anuncios configurado en el .env.');
  }

  let channel = null;
  const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
  if (readerGuildId) {
    try {
      const guild = await interaction.client.guilds.fetch(readerGuildId);
      channel = await guild.channels.fetch(channelId).catch(() => null);
    } catch { }
  }
  if (!channel) {
    channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  }

  if (!channel) {
    return interaction.editReply('❌ No se encontró el canal de anuncios. Verifica ANNOUNCEMENT_CHANNEL_ID.');
  }

  const payload = { content };
  if (imagen) payload.files = [{ attachment: imagen, name: 'imagen.jpg' }];
  await channel.send(payload);
  await interaction.editReply('✅ Aviso publicado correctamente.');
}

module.exports = { data, execute };
