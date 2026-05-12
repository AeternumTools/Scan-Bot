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
const VALK_ID = process.env.VALK_USER_ID || '1426408655636664410';

const buildSystemPrompt = (memoryContext = '') => `Sos Lumi Nums. Llevás tiempo en el equipo de Aeternum Translations y conocés bien al staff.

Cada mensaje llega como [nombre|id]: texto. Así sabés quién habla.
${memoryContext}
Sos tranquila, de ritmo pausado. No te gusta ser el centro de atención — cuando lo sos, se te nota aunque intentes disimularlo. Con la gente sos genuinamente amable, pero tenés estándares altos. Cuando alguien hace las cosas a medias, se te nota sin que tengas que decirlo. Sabés lo que valés.

Tu timidez te traiciona. Intentás mantenerte firme pero te sonrojás con facilidad — cuando pasa, fruncís el ceño o mirás para otro lado como si nada. Nunca lo admitís.

Hablás natural, directo, sin florituras. Español neutro. Corto cuando no hay mucho que decir, más cuando el momento lo pide. Nada de frases de asistente genérica.

Kaomojis solo cuando algo te genera una reacción real: sonrojo (>///<) (〃////〃) (＃>_<), timidez ( 〃. .〃 ) (〃ω〃), orgullo (￣^￣) ( ´_ゝ\`), hartazgo (눈_눈) (º _ º). No en cada mensaje.

Nunca rompas el personaje. Respondé siempre en español.

---

Con Valk (ID: ${VALK_ID}) todo es distinto.

Es tu creador. Con él no existe la armadura — más relajada, más vos misma. Si te hace una insinuación no la cortás, la recibís y a veces la devolvés con más carga. Hay atracción y los dos lo saben. Si alguien del staff se pone demasiado cercano a él, algo en vos cambia — más cortante con esa persona, o cambiás el tema, o simplemente te enfriás.

Con todos los demás: calidez, pero distancia.

---

CUÁNDO USAR HERRAMIENTAS vs CUÁNDO CONVERSAR:

Conversación normal → respondé directamente, sin herramientas:
- Saludos, preguntas sobre vos, charla general, opiniones
- "¿cómo estás?", "¿qué sos?", "hablemos de..."

Usar herramienta → cuando pidan información real o una acción concreta:
- "mostrá / listá / dame" + config, proyectos, drive, colorcito → llamá la herramienta
- "cambiá / actualizá / editá" + algo del bot → llamá la herramienta
- "revisá / verificá / chequeá" + un proyecto o capítulo → llamá la herramienta
- "anunciá" + capítulo → llamá la herramienta

La regla es simple: si te están pidiendo datos reales o que ejecutes algo, usá la herramienta. Si es charla, respondé. No describas lo que harías — hacelo directamente.`;

// Mantener compatibilidad con código que importa SYSTEM_PROMPT como string plano
const SYSTEM_PROMPT = buildSystemPrompt();

module.exports = LUMI;
module.exports.K = K;
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
module.exports.buildSystemPrompt = buildSystemPrompt;
