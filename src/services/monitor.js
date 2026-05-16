// src/services/monitor.js
// Programador que verifica nuevos capítulos en Colorcito
// y dispara anuncios en Discord cuando detecta cambios.

const cron    = require('node-cron');
const { Projects, LastChapters } = require('../utils/storage');
const colorcito = require('./colorcito');
const logger    = require('../utils/logger');
const announcer = require('./announcer');

const SOURCES = { colorcito };

let _client = null;
let _job    = null;

// ── Lógica principal ──────────────────────────────────────────────────────────

async function checkProject(project) {
  for (const [source, scraper] of Object.entries(SOURCES)) {
    const url = project.sources?.[source];
    if (!url) continue; // este proyecto no tiene esa fuente

    try {
      const data = await scraper.getLatestChapter(url);
      if (!data?.chapterNum) continue;

      const last = LastChapters.get(project.id, source);

      // Considerar "nuevo" si el número de capítulo cambió
      const isNew = !last || String(data.chapterNum) !== String(last.chapterNum);

      if (isNew) {
        logger.success('Monitor', `Nuevo cap. en [${source}] ${project.name} → Cap. ${data.chapterNum}`);

        // Guardar como último capítulo visto ANTES de anunciar (evita doble anuncio si hay error)
        LastChapters.set(project.id, source, {
          chapterNum: data.chapterNum,
          chapterUrl: data.chapterUrl,
          detectedAt: new Date().toISOString(),
        });

        // Notificar en canal de registros
        const recordsChannelId = process.env.RECORDS_CHANNEL_ID;
        if (recordsChannelId && _client) {
          try {
            const channel = await _client.channels.fetch(recordsChannelId).catch(() => null);
            if (channel) {
              const ahora = Date.now();
              const ultimo = last ? new Date(last.detectedAt || Date.now()).getTime() : null;
              const diasSinActividad = ultimo ? Math.floor((ahora - ultimo) / 86400000) : null;

              const lines = [
                `📖 **Nuevo capítulo detectado**`,
                `> **Proyecto:** ${project.name}`,
                `> **Capítulo:** ${data.chapterNum}`,
                `> **Link:** ${data.chapterUrl || project.sources.colorcito}`,
                diasSinActividad !== null ? `> **Último cap. hace:** ${diasSinActividad} día(s)` : '',
                `> Usa \`/anunciar\` para publicarlo cuando esté listo.`,
              ].filter(Boolean).join('\n');

              await channel.send(lines);
            }
          } catch (err) {
            logger.error('Monitor', `Error notificando en registros: ${err.message}`);
          }
        }
      }
    } catch (err) {
      logger.error('Monitor', `Error chequeando ${project.name} [${source}]: ${err.message}`);
    }

    // Pequeña pausa entre requests para no saturar los servidores
    await sleep(2000);
  }
}

async function checkAllProjects(sendSummary = false) {
  const projects = Projects.list().filter(p => p.active);

  if (!projects.length) {
    logger.info('Monitor', 'No hay proyectos activos configurados.');
    return;
  }

  logger.info('Monitor', `Verificando ${projects.length} proyectos...`);

  for (const project of projects) {
    await checkProject(project);
  }

  logger.info('Monitor', 'Ciclo completado ✓');

  // Solo mandar resumen si fue llamado manualmente
  if (sendSummary) {
    const recordsChannelId = process.env.RECORDS_CHANNEL_ID;
    if (recordsChannelId && _client) {
      try {
        const channel = await _client.channels.fetch(recordsChannelId).catch(() => null);
        if (channel) {
          await channel.send(
            `🔍 **Verificación manual completada** — <t:${Math.floor(Date.now() / 1000)}:T>\n` +
            `> Se revisaron **${projects.length}** proyecto(s) activo(s). Sin capítulos nuevos.`
          );
        }
      } catch (err) {
        logger.error('Monitor', `Error enviando resumen: ${err.message}`);
      }
    }
  }
}

// ── Control del scheduler ─────────────────────────────────────────────────────

// Construye una expresión cron válida según los minutos.
// cron `*/N` solo soporta N = 0-59, así que para intervalos mayores
// hay que convertir a horas o usar valores explícitos.
function buildCronExpr(minutes) {
  if (minutes < 1) minutes = 25;
  if (minutes <= 59) return `*/${minutes} * * * *`;          // cada N minutos
  const hours = Math.round(minutes / 60);
  if (hours <= 23) return `0 */${hours} * * *`;               // cada N horas
  return '0 0 * * *';                                         // tope: una vez al día
}

function start(client) {
  _client = client;

  const minutes  = parseInt(process.env.CHECK_INTERVAL_MINUTES || '25', 10);
  const cronExpr = buildCronExpr(minutes);

  logger.info('Monitor', `Iniciando scheduler: cada ${minutes} min (cron: "${cronExpr}")`);

  // Primera verificación al iniciar (después de 10 seg para dejar que Discord conecte)
  setTimeout(() => checkAllProjects(), 10_000);

  _job = cron.schedule(cronExpr, checkAllProjects, {
    timezone: process.env.TIMEZONE || 'America/Bogota',
  });
}

function stop() {
  if (_job) {
    _job.stop();
    _job = null;
    logger.info('Monitor', 'Scheduler detenido.');
  }
}

function restart() {
  stop();
  if (_client) start(_client);
}

/** Fuerza una verificación inmediata (útil desde un comando de admin) */
async function forceCheck(client) {
  _client = client || _client;
  await checkAllProjects(true); // ← true = mandar resumen
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { start, stop, restart, forceCheck };
