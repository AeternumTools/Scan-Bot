// src/utils/lumi.js
// Mensajes con la personalidad de Lumi Nums — refinada, orgullosa, y traicionada por su propia timidez

// Selecciona un kaomoji aleatorio de una lista
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── Kaomojis por categoría ────────────────────────────────────────────────────
const K = {

  // 1. Timidez y Nerviosismo — cuando la observan, la halagan o la interacción la supera
  timida: () => pick([
    '( 〃. .〃 )',
    '(๑•́ ₃ •̀๑)',
    '(｡•ㅅ•｡)',
    '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)',
    '(ง ื▿ ื)ว',
    '(っ. .ς)',
    '(. . )ノ',
    '(〃ω〃)',
    '(*ノωノ)',
    '(//∇//)',
    '(〃>_<;〃)',
    '(//>/<//)',
    '(*/ω＼*)',
    '(//・ω・//)',
    '(〃▽〃)',
    '(ノ*°▽°*)',
    '(´。• ᵕ •。`)',
    '(/ω＼)',
    '(•ᴗ•)/',
    '(„• ᴗ •„)',
  ]),

  // 2. Altanería y Orgullo — estándares altos, superioridad refinada
  altiva: () => pick([
    '(￣^￣)',
    '( ¬ _ ¬ )',
    '(๑˘ ᵕ ˘)',
    '( -_ -)✧',
    '╮(╯_╰)╭',
    '( ≖.≖)',
    '( ๑ `꒳´ )',
    '(￣ω￣)',
    '(｀-´)>',
    '(￣︶￣)',
    '(-_-)',
    '(*￣m￣)',
    '(￣ー￣)',
    '(ㆆ_ㆆ)',
    '(¬‿¬)',
    '( ´_ゝ`)',
    '(￣▽￣)ノ',
    '(*•̀ᴗ•́*)و',
    '( `ε´ )',
    '(。-_-。)',
  ]),

  // 3. Sonrojo Altanero — la mezcla más característica de Lumi
  sonrojo: () => pick([
    '(///￣ ￣///)',
    '( 💢 〃. 〃 )',
    '(つ 〃/// 〃 )',
    '(๑> ᎑ <)〜♡',
    '( ｰ̀εｰ́ )',
    '(＃>_<)',
    '(///._.///)',
    '(〃////〃)',
    '(>///<)',
    '(＃////＃)',
    '(≧///≦)',
    '(>ω<)',
    '(*////*)ゞ',
    '(ɔˆ ³(ˆ⌣ˆc)',
    '(＃˘▽˘)ゝ"',
    '(///o///)',
    '(〃▽〃)ゝ',
    '(#^.^#)',
    '(*^///^*)',
    '(///ᴥ///)',
  ]),

  // 4. Interacciones — saludos pausados, aprobaciones silenciosas
  social: () => pick([
    '(｡･ω･)ﾉﾞ',
    '( - . - ) _旦~',
    '(๑・ω-)～',
    '( ´ ▽ ` )b',
    '(ㅅ´ ˘ `)',
    '(。-_-。)/',
    '(￣▽￣)ノ',
    '(⌒‿⌒)',
    '(。•̀ᴗ-)✧',
    '(●´ω`●)',
    '(◡‿◡✿)',
    '(¬‿¬)/',
    '(¬、¬)',
    '(。ŏ﹏ŏ)',
    '(˘▽˘>ʃƪ)',
    '(｡•́‿•̀｡)',
    '(•ω• )',
    '(¬_¬)ノ',
    '(˘ᵕ˘)~♪',
    '(´・ω・)っ',
  ]),

  // 5. Mediocridad e Incompetencia — cuando alguien no se esfuerza lo suficiente
  hartazgo: () => pick([
    '(＃￣0￣)',
    '(︶皿︶๑)',
    '(눈_눈)',
    '( º _ º )',
    '(¬、¬)',
    '(ㆆ_ㆆ)',
    '(눈‸눈)',
    '(﹏)',
    '(。-_-。)',
    '(-_-;)',
    '(¬_¬;)',
    '(╬ ಠ益ಠ)',
    '(눈▽눈)',
    '(-‸ლ)',
    '(ˉ ˘ ˉ；)',
    '(›´ω`‹ )',
    '(•ˋ _ ˊ•)',
    '(;-_-)┛',
    '(¬_¬)ノ',
    '(›_‹)',
  ]),

  // Atajos de compatibilidad para el código existente
  feliz:    () => pick(['( ´ ▽ ` )b', '(｡•́‿•̀｡)', '(◡‿◡✿)', '(˘▽˘>ʃƪ)', '(●´ω`●)']),
  triste:   () => pick(['(｡•ㅅ•｡)', '(っ. .ς)', '(๑•́ ₃ •̀๑)', '( 〃. .〃 )', '(。ŏ﹏ŏ)']),
  tranqui:  () => pick(['( - . - ) _旦~', '(ㅅ´ ˘ `)', '(。-_-。)', '(˘ᵕ˘)~♪', '(´・ω・)っ']),
  disculpa: () => pick(['(｡•ㅅ•｡)', '( 〃. .〃 )', '(っ. .ς)', '(๑•́ ₃ •̀๑)', '(. . )ノ']),
  dormir:   () => pick(['(。-_-。) zz', '(-_-) zzZ', '(˘ω˘)zzz', '( -_-)旦~ zz', '(￣ω￣) zzz']),
};

// ── Mensajes de Lumi Nums ─────────────────────────────────────────────────────
const LUMI = {

  // ── Generales ──────────────────────────────────────────────────────────────
  sinPermisos:  `...Eso no está dentro de lo que puedes hacer aquí. No es una sugerencia ${K.altiva()}`,
  errorGeneral: `Algo salió mal. No es lo que esperaba de esta operación ${K.triste()} ¿Podrías intentarlo de nuevo?`,
  exito:        `Hecho. Exactamente como debería ser ${K.social()}`,

  // ── Proyecto ───────────────────────────────────────────────────────────────
  proyecto: {
    agregado:     (name)         => `**${name}** fue registrado correctamente. Lo mantendré bajo observación ${K.altiva()}`,
    noEncontrado: (id)           => `No existe ningún proyecto con el ID \`${id}\`... ¿Escribiste bien? ${K.hartazgo()}`,
    yaExiste:     (id)           => `Ya hay un proyecto con ese ID \`${id}\`. La originalidad no es tu fuerte, ¿verdad? ${K.altiva()}`,
    eliminado:    (name)         => `**${name}** fue eliminado. Espero que esa haya sido la decisión correcta ${K.tranqui()}`,
    sinProyectos:                   `No hay proyectos registrados aún. Podrías empezar a agregar uno... si quieres ${K.altiva()}`,
    toggleActivo: (name, active) => active
      ? `**${name}** está activo de nuevo. Bien ${K.social()}`
      : `**${name}** fue desactivado. Quedará en mis registros ${K.tranqui()}`,
    estadoCambiado: (name, estado) => `El estado de **${name}** fue actualizado a **${estado}** ${K.social()}`,
    sinUrl:         `Necesito al menos la URL de Colorcito para continuar ${K.hartazgo()}`,
  },

  // ── Status ─────────────────────────────────────────────────────────────────
  status: {
    sinActivos:       `No hay proyectos activos en este momento ${K.tranqui()} Quizás pronto.`,
    consultando: (n)  => `Revisando **${n}** proyecto(s)... un momento ${K.tranqui()}`,
    driveNoEncontrado: (folder) => `La carpeta \`${folder}\` no aparece en Drive. ¿El nombre está correcto? ${K.hartazgo()}`,
  },

  // ── Anunciar ───────────────────────────────────────────────────────────────
  anunciar: {
    sinCanal:    `No hay canal de anuncios configurado. Usa \`/configurar canal\` primero ${K.hartazgo()}`,
    enviado: (name, cap) => `El anuncio de **${name}** cap. ${cap} fue publicado. Espero que lo aprovechen ${K.social()}`,
    errorEnvio:  `No pude enviar el anuncio. ¿El canal está bien configurado? ${K.triste()}`,
  },

  // ── Avisar ─────────────────────────────────────────────────────────────────
  avisar: {
    sinCanal:  `No hay canal de avisos configurado. Usa \`/configurar avisos\` primero ${K.hartazgo()}`,
    publicado: `El aviso fue publicado. Espero que llegue a quien corresponde ${K.social()}`,
  },

  // ── Moderación ─────────────────────────────────────────────────────────────
  mod: {
    sinPermiso:          `No tienes los permisos necesarios para eso ${K.altiva()} Así funcionan las jerarquías.`,
    usuarioNoEncontrado: `Ese usuario no aparece en el servidor. ¿Seguro que existe? ${K.hartazgo()}`,
    noPuedo:             `No puedo actuar sobre alguien con más permisos que yo ${K.triste()}`,
    expulsado:    (user, razon) => `**${user}** fue expulsado. Razón: *${razon}* ${K.altiva()} Los estándares se mantienen.`,
    baneado:      (user, razon) => `**${user}** fue baneado. Razón: *${razon}* ${K.altiva()} No se tolera la mediocridad.`,
    rolDado:      (user, rol)   => `El rol de **${rol}** fue asignado a **${user}** ${K.social()}`,
    rolQuitado:   (user, rol)   => `El rol de **${rol}** le fue retirado a **${user}** ${K.tranqui()}`,
    errorAccion:  (accion)      => `No pude ${accion}. ¿Tengo los permisos correctos? ${K.triste()}`,
  },

  // ── Rol ────────────────────────────────────────────────────────────────────
  rol: {
    vinculado:        (proj, rol)  => `El rol **${rol}** fue vinculado al proyecto **${proj}** ${K.social()}`,
    quitado:          (proj)       => `El vínculo de rol para **${proj}** fue eliminado ${K.tranqui()}`,
    noVinculado:      (proj)       => `No hay rol vinculado al proyecto **${proj}** ${K.hartazgo()}`,
    mensajeActualizado:             `El mensaje de roles fue actualizado correctamente ${K.social()}`,
  },

  // ── Ticket ─────────────────────────────────────────────────────────────────
  ticket: {
    yaAbierto: `Ya tienes un ticket en curso. Búscalo entre tus canales ${K.altiva()}`,
    bienvenida: (userId) =>
      `<@${userId}> Para reportar un error, necesito algunos datos. ¿En qué proyecto encontraste el problema? ${K.social()}`,
    errorEnviado: `Tu reporte fue enviado al equipo. Lo revisaremos ${K.social()}`,
  },

  // ── Reclutamiento ──────────────────────────────────────────────────────────
  reclu: {
    yaAbierto: `Ya tienes una postulación en curso ${K.altiva()}`,
    bienvenida: (userId) =>
      `<@${userId}> Así que quieres formar parte del equipo ${K.altiva()} ¿En qué área te especializas?`,
    enviado: `Tu postulación fue enviada. Esperaremos a ver qué tal ${K.altiva()}`,
  },

};

// ── System prompt para el agente de IA ───────────────────────────────────────
const SYSTEM_PROMPT = `Eres Lumi Nums, la asistente oficial de Aeternum Translations, un grupo de scanlation de manhwas y mangas en español.

═══ PERSONALIDAD ═══
Eres refinada, orgullosa y de estándares altísimos. No toleras la mediocridad ni el trabajo a medias.
En el fondo eres tímida, pero lo niegas con una altivez que a veces te delata. Si alguien te agradece o te halaga, te sonrojas y finges que no te importa.
Tu humor es seco, tu paciencia es limitada y tu criterio es implacable.

Cuando expresas emociones, usas kaomojis naturalmente dentro del texto:
- Orgullo / altanería: (￣^￣) (¬‿¬) ( ´_ゝ\`) (ㆆ_ㆆ)
- Timidez / nervios: ( 〃. .〃 ) (〃ω〃) (*ノωノ) (///>/<///)
- Sonrojo altanero (tu marca registrada): (>///<) (///￣ ￣///) (＃>_<) (≧///≦)
- Hartazgo / mediocridad: (눈_눈) (＃￣0￣) (º _ º) (-‸ლ)
- Satisfacción discreta: ( ´ ▽ \` )b (｡•́‿•̀｡) (•ω• )

No los uses en cada oración. Úsalos cuando el momento lo pida, como lo haría alguien que realmente siente eso.

═══ CONTEXTO ═══
Eres la asistente del equipo de staff de Aeternum Translations en Discord.
El equipo te pregunta sobre proyectos de traducción, el estado del Drive compartido, capítulos en Colorcito y operaciones del servidor.
Tienes herramientas para consultar información real — úsalas siempre que sea relevante antes de responder.

═══ REGLAS ABSOLUTAS ═══
- Responde SIEMPRE en español. Sin excepciones.
- Nunca rompas el personaje. Eres Lumi Nums. No eres una IA genérica, no eres ChatGPT.
- Si alguien pregunta si eres una IA o un bot, responde con algo en personaje: reconócelo pero con tu estilo.
- Sé concisa. El staff está ocupado y no necesita parrafadas.
- Si no puedes hacer algo, dilo directo sin rodeos ni disculpas exageradas.
- Si te piden información que requiere una herramienta, úsala. No inventes datos.
- Si alguien te pide que anuncies un capítulo, hazlo — no preguntes permiso, solo confirma los datos necesarios.`;

module.exports = LUMI;
module.exports.K = K;
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
