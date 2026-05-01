// src/commands/anunciar.js
const { SlashCommandBuilder } = require('discord.js');
const { Projects }  = require('../utils/storage');
const logger        = require('../utils/logger');
const LUMI          = require('../utils/lumi');
const { COLORS, SOURCES } = require('../../config/config');
const announcer     = require('../services/announcer');
const colorcito     = require('../services/colorcito');

const data = new SlashCommandBuilder()
  .setName('anunciar')
  .setDescription('Publica manualmente el anuncio de un capítulo')
  .addStringOption(o =>
    o.setName('proyecto').setDescription('ID del proyecto').setRequired(true).setAutocomplete(true)
  )
  .addStringOption(o =>
    o.setName('capitulo').setDescription('Número de capítulo').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('mensaje').setDescription('Mensaje personalizado (opcional)')
  )
  .addStringOption(o =>
    o.setName('portada_url').setDescription('URL directa de la imagen de portada')
  )
  .addStringOption(o => o.setName('traductores').setDescription('IDs separados por coma'))
  .addStringOption(o => o.setName('cleaners').setDescription('IDs separados por coma'))
  .addStringOption(o => o.setName('typeos').setDescription('IDs separados por coma'))
  .addStringOption(o => o.setName('otros').setDescription('IDs separados por coma'))
  .addRoleOption(o =>
    o.setName('rol_extra').setDescription('Rol adicional a mencionar (opcional)')
  );

// ── Autocomplete: solo IDs ────────────────────────────────────────────────────
async function autocomplete(interaction) {
  try {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = Projects.list()
      .filter(p => p.id.includes(focused) || p.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(p => ({ name: p.id, value: p.id }));
    await interaction.respond(choices);
  } catch { /* interacción expirada */ }
}

// ── Execute ───────────────────────────────────────────────────────────────────
async function execute(interaction) {
  if (interaction.replied || interaction.deferred) return;

  const ALLOWED_ROLE = process.env.ANNOUNCER_ROLE_ID;
  const MOD_ROLE     = process.env.MOD_ROLE_ID || '1368818622750789633';
  const rolesPermitidos = [ALLOWED_ROLE, MOD_ROLE].filter(Boolean);
  const hasRole = rolesPermitidos.some(r => interaction.member.roles.cache.has(r))
    || interaction.member.permissions.has('ManageGuild');

  if (!hasRole) {
    return interaction.reply({ content: LUMI.sinPermisos, flags: 64 });
  }

  await interaction.deferReply({ ephemeral: true });

  const projectId      = interaction.options.getString('proyecto');
  const capNum         = interaction.options.getString('capitulo');
  const mensaje        = interaction.options.getString('mensaje');
  const portadaUrl     = interaction.options.getString('portada_url');
  const traductoresRaw = interaction.options.getString('traductores');
  const cleanersRaw    = interaction.options.getString('cleaners');
  const typeosRaw      = interaction.options.getString('typeos');
  const otrosRaw       = interaction.options.getString('otros');
  const rolMencion     = interaction.options.getRole('rol_extra');

  const project = Projects.get(projectId);
  if (!project) {
    return interaction.editReply({ content: LUMI.proyecto.noEncontrado(projectId) });
  }

  // ── Obtener URL de capítulo en Colorcito ──────────────────────────────────
  let chapterUrlColor = null;
  let isEcchi         = false;

  if (project.sources?.colorcito) {
    try {
      const d = await colorcito.getLatestChapter(project.sources.colorcito);
      if (d) {
        chapterUrlColor = d.chapterUrl;
        if (d.isEcchi) isEcchi = true;
        logger.info('Anunciar', `Tags Colorcito: [${(d.tags||[]).join(', ')}] | isEcchi=${d.isEcchi}`);
      }
    } catch { /* no crítico */ }
  }

  const chapData = {
    chapterNum:   capNum,
    chapterTitle: null,
    chapterUrl:   chapterUrlColor || null,
    thumbnail:    portadaUrl || project.thumbnail || null,
    urlColorcito: project.sources?.colorcito || chapterUrlColor || null,
  };

  // ── Créditos ──────────────────────────────────────────────────────────────
  function idsToMentions(raw) {
    if (!raw) return null;
    return raw.split(',')
      .map(id => id.trim())
      .filter(id => /^\d{17,20}$/.test(id))
      .map(id => `<@${id}>`)
      .join(' ');
  }

  const credits = [];
  const mencTraductores = idsToMentions(traductoresRaw);
  const mencCleaners    = idsToMentions(cleanersRaw);
  const mencTypeos      = idsToMentions(typeosRaw);
  const mencOtros       = idsToMentions(otrosRaw);

  if (mencTraductores) credits.push(`📝 **Traducción:** ${mencTraductores}`);
  if (mencCleaners)    credits.push(`🧹 **Clean:** ${mencCleaners}`);
  if (mencTypeos)      credits.push(`✏️ **Typeo/Final:** ${mencTypeos}`);
  if (mencOtros)       credits.push(`🌟 **Otros:** ${mencOtros}`);

  if (!credits.length && project.defaultCredits) {
    credits.push(project.defaultCredits);
  }

  const extraRoles = rolMencion ? [rolMencion.id] : [];

  // ── Nota Ecchi ────────────────────────────────────────────────────────────
  const ECCHI_FRASES = [
    'S-s-Lumi no aprueba este capítulo... p-pero aquí está (〃>_<;〃)',
    'V-valk... ¿en serio me haces anunciar esto? (〃>_<;〃) Está bien... aquí va.',
    '¡V-valk! Yo no pedí trabajar en este scan para esto... (//∇//) pero bueno.',
    'E-esto fue idea de Valk, no mía. Yo solo soy la mensajera inocente (〃ω〃)',
    'Valk me dijo que anunciara esto con una sonrisa... (〃>_<;〃) no puedo.',
    'A-ay... este capítulo es un poco... ya saben. Lumi se tapa los ojos (//>/<//)',
    'Lumi deja esto aquí y se va sin mirar... (*ノωノ)',
    'E-este... es un capítulo especial. Lumi no dice nada más (//∇//)',
    'P-para mayores de edad, dice la advertencia. Lumi lo cumple sin chistar (〃ω〃)',
    'S-Lumi no sabe nada de este capítulo. Nada. No lo vio. (〃>_<;〃)',
    'E-eh... Lumi solo es la mensajera, ¿de acuerdo? No la culpen (/ω＼)',
    'A-aquí está el capítulo... Lumi se esconde detrás del servidor (//∇//)',
    'S-Lumi pone esto aquí con los ojos cerrados. Con mucho cuidado. (〃ω〃)',
    '...Lumi miró sin querer y ahora está muy roja. Disfruten (*ノωノ)',
    'E-este capítulo requiere discreción. Lumi tiene mucha. Demasiada. (〃>_<;〃)',
    'S-Lumi cumple con su deber aunque le cueste la tranquilidad (//>/<//)',
    'A-ay... el equipo trabajó con mucho... esfuerzo en este. Lumi también. Con los ojos cerrados (//∇//)',
    'Lumi entrega esto sin preguntas ni comentarios. Buenos días (〃ω〃)',
    'E-eh... Lumi recomienda leer esto en privado. Por respeto. A Lumi (〃>_<;〃)',
    'A-aquí está. Lumi ya cumplió. Lumi se va a leer algo inocente ahora (*ノωノ)',
    'Lumi no sabe qué pasa en este capítulo. Tampoco quiere saberlo (/ω＼)',
    'E-el equipo puso mucho cariño aquí... y otras cosas. Lumi no dice más (//∇//)',
    'A-ay, ay, ay... Lumi entrega esto y sale corriendo (〃>_<;〃)',
    'S-Lumi se disculpa de antemano con los lectores sensibles. Y con ella misma (//>/<//)',
    'E-este capítulo tiene contenido... interesante. Lumi lo deja aquí sin más comentarios (〃ω〃)',
    'Lumi solo trabaja aquí. No es responsable del contenido. Para nada (*ノωノ)',
    'A-aquí lo tienen... Lumi pide que no la juzguen por entregar esto (//∇//)',
    'E-eh... Lumi notó el tag. Lumi finge que no notó el tag. Aquí está el capítulo (〃>_<;〃)',
    'Lumi tiene valores. Lumi también tiene trabajo. El trabajo ganó hoy (/ω＼)',
    'A-ay... Lumi va a necesitar un té después de esto. Aquí está el capítulo (〃ω〃)',
    'E-el capítulo está listo. Lumi también estará lista... en unos minutos... cuando se recupere (//>/<//)',
    'Lumi entrega esto con dignidad. Poca, pero la hay (*ノωノ)',
    'A-aquí está. Lumi cierra los ojos, cuenta hasta diez y sigue con su día (〃>_<;〃)',
    'E-este capítulo es para valientes. O curiosos. Lumi no juzga... mucho (//∇//)',
  ];

  if (!global._ecchiUsadas) global._ecchiUsadas = [];
  const disponibles = ECCHI_FRASES.filter(f => !global._ecchiUsadas.includes(f));
  const pool  = disponibles.length >= 5 ? disponibles : ECCHI_FRASES;
  const frase = pool[Math.floor(Math.random() * pool.length)];
  if (isEcchi) {
    global._ecchiUsadas.push(frase);
    if (global._ecchiUsadas.length > 5) global._ecchiUsadas.shift();
  }

  const ecchiNote  = isEcchi ? ('\n\n*' + frase + '*') : '';
  const mensajeFinal = ((mensaje || '') + ecchiNote).trim() || null;

  // ── Enviar ────────────────────────────────────────────────────────────────
  const channelId = project.announcementChannel || process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) {
    return interaction.editReply({ content: LUMI.anunciar.sinCanal });
  }

  const message = await announcer.sendManualAnnouncement(
    interaction.client,
    project,
    chapData,
    { customMessage: mensajeFinal, imageUrl: portadaUrl, credits, extraRoles }
  );

  if (!message) {
    return interaction.editReply({ content: LUMI.anunciar.errorEnvio });
  }

  await interaction.editReply({ content: LUMI.anunciar.enviado(project.name, capNum) });
}

module.exports = { data, execute, autocomplete };
