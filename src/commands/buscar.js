// src/commands/buscar.js
// /buscar <nombre> — busca un manga en Colorcito y muestra resultados

const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

const colorcito = require('../services/colorcito');
const { COLORS, SOURCES } = require('../../config/config');

const data = new SlashCommandBuilder()
  .setName('buscar')
  .setDescription('Busca un manga/manhwa en Colorcito')
  .addStringOption(o =>
    o.setName('nombre').setDescription('Nombre del manga o manhwa').setRequired(true)
  );

async function execute(interaction) {
  await interaction.deferReply();

  const query = interaction.options.getString('nombre');

  const colorResults = await colorcito.searchManga(query);
  const results = colorResults.slice(0, 10).map(r => ({ ...r, source: 'colorcito' }));

  if (!results.length) {
    return interaction.editReply({
      content: `🔍 No se encontraron resultados para **"${query}"** en Colorcito.`,
    });
  }

  const lines = results.map((r, i) => {
    const sourceInfo = SOURCES[r.source];
    return `**${i + 1}.** [${r.name}](${r.url}) ${sourceInfo?.emoji || ''} \`${r.source.toUpperCase()}\`${r.type ? ` · ${r.type}` : ''}`;
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`🔍 Resultados para "${query}"`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Usa /proyecto add para añadir uno de estos proyectos al bot` })
    .setTimestamp();

  if (results[0]?.thumbnail) embed.setThumbnail(results[0].thumbnail);

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
