// src/commands/buscar.js
// /buscar <nombre> <fuente> — busca un manga en TMO o Colorcito y muestra resultados

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const tmo       = require('../services/tmoScraper');
const colorcito = require('../services/colorcito');
const { COLORS, SOURCES } = require('../../config/config');

const data = new SlashCommandBuilder()
  .setName('buscar')
  .setDescription('Busca un manga/manhwa en las plataformas monitoreadas')
  .addStringOption(o =>
    o.setName('nombre').setDescription('Nombre del manga o manhwa').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('fuente')
      .setDescription('Plataforma donde buscar')
      .setRequired(true)
      .addChoices(
        { name: '📖 TuMangaOnline (TMO)', value: 'tmo' },
        { name: '🎨 Colorcito',           value: 'colorcito' },
        { name: '🔍 Ambas',               value: 'ambas' },
      )
  );

async function execute(interaction) {
  await interaction.deferReply();

  const query  = interaction.options.getString('nombre');
  const fuente = interaction.options.getString('fuente');

  let results = [];

  if (fuente === 'tmo' || fuente === 'ambas') {
    const tmoResults = await tmo.searchManga(query);
    results.push(...tmoResults.map(r => ({ ...r, source: 'tmo' })));
  }

  if (fuente === 'colorcito' || fuente === 'ambas') {
    const colorResults = await colorcito.searchManga(query);
    results.push(...colorResults.map(r => ({ ...r, source: 'colorcito' })));
  }

  if (!results.length) {
    return interaction.editReply({
      content: `🔍 No se encontraron resultados para **"${query}"** en ${fuente === 'ambas' ? 'ninguna plataforma' : fuente.toUpperCase()}.`,
    });
  }

  // Limitar a 10 resultados
  results = results.slice(0, 10);

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
