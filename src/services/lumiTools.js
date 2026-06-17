// src/services/lumiTools.js
// Herramientas disponibles para el agente de Lumi (formato OpenAI/Groq tool-use)

const drive     = require('./driveService');
const colorcito = require('./colorcito');
const announcer = require('./announcer');
const railway   = require('./railwayService');
const mod       = require('./modService');
const monitor   = require('./monitor');
const { Projects, LastChapters } = require('../utils/storage');
const logger    = require('../utils/logger');

// Genera un ID slug a partir del nombre (igual criterio que /proyecto add)
function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Cada tool lleva un campo _scope:
//   'home' → solo en servidores caseros (Aeternum)
//   'all'  → en cualquier servidor donde esté Lumi
function withScope(scope, tool) {
  return { ...tool, _scope: scope };
}

// ── Definiciones de tools (schema para Groq) ──────────────────────────────────

const DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'listar_proyectos',
      description: 'Lista todos los proyectos registrados en el bot con su nombre, categoría y estado (activo/inactivo).',
      parameters: {
        type: 'object',
        properties: {
          solo_activos: {
            type: 'boolean',
            description: 'true para ver solo proyectos activos. Por defecto muestra todos.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_estado_proyecto',
      description: 'Consulta el estado de PRODUCCIÓN interno del proyecto en Google Drive: qué capítulos tiene el equipo procesados y en qué etapa están (Raw, Clean, Tradu, Final). Usar cuando pregunten por el avance del equipo, qué capítulos están en proceso, o el estado de trabajo interno. NO usar para saber cuál es el último capítulo publicado en el sitio web.',
      parameters: {
        type: 'object',
        properties: {
          nombre_proyecto: {
            type: 'string',
            description: 'Nombre del proyecto tal como aparece en Drive.',
          },
          categoria: {
            type: 'string',
            description: 'Categoría del proyecto (manhwas, mangas, novelas, joints). Opcional.',
            enum: ['manhwas', 'mangas', 'novelas', 'joints'],
          },
        },
        required: ['nombre_proyecto'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_colorcito',
      description: 'Consulta Colorcito.com para saber cuál es el ÚLTIMO CAPÍTULO PUBLICADO en el sitio web, disponible para los lectores. Usar cuando pregunten "en qué capítulo va", "cuál es el último cap", "revisar Colorcito", o cualquier pregunta sobre el capítulo publicado/disponible. También busca proyectos por nombre en el sitio. Acepta el nombre del proyecto en vez de la URL.',
      parameters: {
        type: 'object',
        properties: {
          nombre_proyecto: {
            type: 'string',
            description: 'Nombre del proyecto registrado en el bot. Se buscará su URL de Colorcito automáticamente.',
          },
          url_proyecto: {
            type: 'string',
            description: 'URL directa del proyecto en Colorcito. Usar si se conoce el URL exacto.',
          },
          query: {
            type: 'string',
            description: 'Texto libre para buscar un manga en Colorcito si no está registrado en el bot.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_storage_drive',
      description: 'Muestra el uso actual de almacenamiento en Google Drive.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_carpetas_drive',
      description: 'Crea las subcarpetas estándar (Raw, Clean, Tradu, Final) dentro de una carpeta de capítulo en Drive.',
      parameters: {
        type: 'object',
        properties: {
          carpeta_capitulo_id: {
            type: 'string',
            description: 'ID de la carpeta del capítulo en Google Drive.',
          },
        },
        required: ['carpeta_capitulo_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'anunciar_capitulo',
      description: 'Envía un anuncio de nuevo capítulo al canal de lectores. Requiere el ID o nombre del proyecto y el número de capítulo.',
      parameters: {
        type: 'object',
        properties: {
          id_proyecto: {
            type: 'string',
            description: 'ID del proyecto tal como está registrado en el bot.',
          },
          numero_capitulo: {
            type: 'string',
            description: 'Número del capítulo a anunciar (ej: "42" o "42.5").',
          },
          titulo_capitulo: {
            type: 'string',
            description: 'Título opcional del capítulo.',
          },
          url_colorcito: {
            type: 'string',
            description: 'URL del capítulo en Colorcito (opcional).',
          },
        },
        required: ['id_proyecto', 'numero_capitulo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_variables',
      description: 'Muestra la configuración actual del bot (canales, roles, intervalo, zona horaria). Las credenciales sensibles aparecen enmascaradas. Solo lectura.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// ── Tools administrativas / "secretaria" (solo servidores caseros) ───────────
// Acciones que normalmente haría el líder: gestión de proyectos, avisos,
// sincronización, diagnóstico, config por proyecto, roles y Drive.
const ADMIN_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'agregar_proyecto',
      description: 'Registra un nuevo proyecto (manga/manhwa) en el bot. ACCIÓN: pide confirmación antes de ejecutar. Marca el capítulo actual de Colorcito como "ya visto" para no anunciarlo de golpe.',
      parameters: {
        type: 'object',
        properties: {
          nombre:           { type: 'string', description: 'Nombre del manga/manhwa.' },
          drive_folder:     { type: 'string', description: 'Nombre EXACTO de la carpeta en Google Drive.' },
          categoria:        { type: 'string', description: 'Categoría.', enum: ['manhwas', 'mangas', 'novelas', 'joints'] },
          colorcito_url:    { type: 'string', description: 'URL del proyecto en Colorcito (opcional pero recomendada).' },
          creditos_default: { type: 'string', description: 'Créditos por defecto del equipo (opcional). Ej: "Trad: Ana | Clean: Bob".' },
          tags:             { type: 'string', description: 'Tags separados por coma (opcional). Ej: "romance,accion,color".' },
        },
        required: ['nombre', 'drive_folder', 'categoria'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'eliminar_proyecto',
      description: 'Elimina un proyecto del bot de forma permanente. ACCIÓN DESTRUCTIVA: confirma con el usuario antes de ejecutar.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'ID (slug) del proyecto a eliminar.' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'activar_pausar_proyecto',
      description: 'Activa o pausa el monitoreo automático de un proyecto (alterna su estado activo/pausado).',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'ID (slug) del proyecto.' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cambiar_estado_proyecto',
      description: 'Cambia el estado editorial de un proyecto: en curso, completado, hiatus o dropeado.',
      parameters: {
        type: 'object',
        properties: {
          id:     { type: 'string', description: 'ID (slug) del proyecto.' },
          estado: { type: 'string', description: 'Nuevo estado.', enum: ['ongoing', 'completed', 'hiatus', 'dropped'] },
        },
        required: ['id', 'estado'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sincronizar_cache',
      description: 'Refresca el caché de últimos capítulos consultando Colorcito, para que el monitor no reanuncie capítulos viejos. Puede tardar varios segundos por proyecto.',
      parameters: {
        type: 'object',
        properties: { proyecto: { type: 'string', description: 'ID del proyecto a sincronizar. Vacío = todos los activos.' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificar_ahora',
      description: 'Fuerza una verificación inmediata de nuevos capítulos en todos los proyectos activos (equivale a esperar el chequeo automático).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_status_todos',
      description: 'Resumen del estado de PRODUCCIÓN en Drive de todos los proyectos activos (cuántos capítulos y en qué etapa). Para un solo proyecto usa ver_estado_proyecto.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'diagnostico_sistema',
      description: 'Autodiagnóstico del bot: conexión a Discord, variables, Google Drive, proyectos y scraper de Colorcito. Úsalo cuando pregunten si algo falla o cómo está "de salud".',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// ── Tools de moderación (disponibles en TODOS los servidores) ────────────────
const MOD_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'banear_usuario',
      description: 'Banea a un usuario del servidor actual. Requiere que tanto el bot como quien lo pide tengan permiso de "Banear miembros".',
      parameters: {
        type: 'object',
        properties: {
          usuario: { type: 'string', description: 'ID del usuario o mención (<@id>).' },
          razon:   { type: 'string', description: 'Razón del baneo (opcional).' },
          dias_borrar: { type: 'integer', description: 'Días de mensajes a borrar (0-7, default 0).' },
        },
        required: ['usuario'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'expulsar_usuario',
      description: 'Expulsa (kick) a un usuario del servidor actual. Requiere que tanto el bot como quien lo pide tengan permiso de "Expulsar miembros".',
      parameters: {
        type: 'object',
        properties: {
          usuario: { type: 'string', description: 'ID del usuario o mención (<@id>).' },
          razon:   { type: 'string', description: 'Razón de la expulsión (opcional).' },
        },
        required: ['usuario'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'silenciar_usuario',
      description: 'Aplica timeout (silenciar temporalmente) a un usuario. Duración entre 1 y 40320 minutos (28 días máx).',
      parameters: {
        type: 'object',
        properties: {
          usuario: { type: 'string', description: 'ID o mención del usuario.' },
          minutos: { type: 'integer', description: 'Duración en minutos (1-40320).' },
          razon:   { type: 'string', description: 'Razón del silencio (opcional).' },
        },
        required: ['usuario', 'minutos'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'quitar_silencio',
      description: 'Quita el timeout activo a un usuario antes de que expire.',
      parameters: {
        type: 'object',
        properties: {
          usuario: { type: 'string', description: 'ID o mención del usuario.' },
        },
        required: ['usuario'],
      },
    },
  },
];

// Asigna scopes y devuelve definiciones según el modo del servidor
function getDefinitions(mode = 'home') {
  const homeTools = [...DEFINITIONS, ...ADMIN_DEFINITIONS].map(d => withScope('home', d));
  const allTools  = MOD_DEFINITIONS.map(d => withScope('all', d));
  if (mode === 'home') return [...homeTools, ...allTools];
  return allTools; // servidor externo → solo mod + conversación
}

// ── Executors ─────────────────────────────────────────────────────────────────
// context.client  → instancia del Discord Client
// context.message → mensaje original (necesario para mod tools)
// context.mode    → 'home' o 'external'

function getExecutors(context = {}) {
  return {

    listar_proyectos: async ({ solo_activos = false } = {}) => {
      const all = Projects.list();
      const list = solo_activos ? all.filter(p => p.active !== false) : all;
      if (!list.length) return { mensaje: 'No hay proyectos registrados.' };
      return {
        total: list.length,
        proyectos: list.map(p => ({
          id:        p.id,
          nombre:    p.name,
          categoria: p.category || 'sin categoría',
          activo:    p.active !== false,
          fuente:    p.sources?.colorcito ? 'Colorcito' : 'manual',
        })),
      };
    },

    ver_estado_proyecto: async ({ nombre_proyecto, categoria }) => {
      try {
        const status = await drive.getProjectStatus(nombre_proyecto, categoria || null);
        if (!status?.found) return { error: status?.error || `"${nombre_proyecto}" no encontrado en Drive.` };

        // Limitar capítulos a los últimos 10 para no saturar el contexto
        const capsRecientes = (status.chapters || []).slice(-10);
        return {
          nombre:      status.projectName,
          total_caps:  status.totalCaps,
          resumen:     status.summary,
          ultimo_cap:  status.lastCap,
          caps_recientes: capsRecientes,
          drive_url:   status.folderUrl,
        };
      } catch (err) {
        logger.error('LumiTools', `ver_estado_proyecto: ${err.message}`);
        return { error: err.message };
      }
    },

    buscar_colorcito: async ({ nombre_proyecto, url_proyecto, query } = {}) => {
      try {
        // Prioridad 1: URL directa
        if (url_proyecto) {
          const cap = await colorcito.getLatestChapter(url_proyecto);
          if (!cap) return { error: 'No se pudo obtener el capítulo desde esa URL.' };
          return { ultimo_capitulo: cap };
        }

        // Prioridad 2: nombre del proyecto → buscar en storage → usar su URL de Colorcito
        if (nombre_proyecto) {
          const proyecto = Projects.findByName(nombre_proyecto);
          if (proyecto?.sources?.colorcito) {
            const cap = await colorcito.getLatestChapter(proyecto.sources.colorcito);
            if (!cap) return { error: `No se pudo obtener el capítulo de "${proyecto.name}" desde Colorcito.` };
            return { proyecto: proyecto.name, ultimo_capitulo: cap };
          }
          if (proyecto && !proyecto.sources?.colorcito) {
            return { error: `"${proyecto.name}" no tiene URL de Colorcito configurada.` };
          }
          // No encontrado en storage → intentar con el nombre como slug
          const cap = await colorcito.getLatestChapter(`https://colorcitoscan.com/ver/${nombre_proyecto}`);
          if (cap) return { ultimo_capitulo: cap };
          return { error: `No se encontró "${nombre_proyecto}" en los proyectos registrados ni en Colorcito.` };
        }

        // Prioridad 3: búsqueda libre
        if (query) {
          const resultados = await colorcito.searchManga(query);
          if (!resultados?.length) return { mensaje: 'Sin resultados en Colorcito.' };
          return { resultados: resultados.slice(0, 10) };
        }

        return { error: 'Proporciona nombre_proyecto, url_proyecto o query.' };
      } catch (err) {
        logger.error('LumiTools', `buscar_colorcito: ${err.message}`);
        return { error: err.message };
      }
    },

    ver_storage_drive: async () => {
      try {
        return await drive.getStorageUsage();
      } catch (err) {
        logger.error('LumiTools', `ver_storage_drive: ${err.message}`);
        return { error: err.message };
      }
    },

    crear_carpetas_drive: async ({ carpeta_capitulo_id }) => {
      try {
        const result = await drive.ensureChapterFolders(carpeta_capitulo_id);
        return { mensaje: 'Carpetas creadas correctamente.', detalle: result };
      } catch (err) {
        logger.error('LumiTools', `crear_carpetas_drive: ${err.message}`);
        return { error: err.message };
      }
    },

    anunciar_capitulo: async ({ id_proyecto, numero_capitulo, titulo_capitulo, url_colorcito }) => {
      const { client } = context;
      if (!client?.isReady()) return { error: 'El cliente de Discord no está disponible.' };

      const project = Projects.get(id_proyecto);
      if (!project) return { error: `No existe el proyecto con ID "${id_proyecto}".` };

      const chapData = {
        chapterNum:   numero_capitulo,
        chapterTitle: titulo_capitulo || null,
        chapterUrl:   url_colorcito || null,
        urlColorcito: url_colorcito || null,
      };

      try {
        await announcer.sendManualAnnouncement(client, project, chapData);
        return { mensaje: `Anuncio del cap. ${numero_capitulo} de "${project.name}" enviado correctamente.` };
      } catch (err) {
        logger.error('LumiTools', `anunciar_capitulo: ${err.message}`);
        return { error: err.message };
      }
    },

    ver_variables: async () => {
      try {
        return railway.getVariables();
      } catch (err) {
        logger.error('LumiTools', `ver_variables: ${err.message}`);
        return { error: err.message };
      }
    },

    // ── Gestión de proyectos (secretaria) ───────────────────────────────────
    agregar_proyecto: async ({ nombre, drive_folder, categoria, colorcito_url, creditos_default, tags } = {}) => {
      try {
        if (!nombre || !drive_folder || !categoria) {
          return { error: 'Necesito al menos nombre, carpeta de Drive y categoría.' };
        }
        const id = slugify(nombre);
        if (!id) return { error: 'No pude generar un ID válido a partir de ese nombre.' };
        if (Projects.get(id)) return { error: `Ya existe un proyecto con el ID "${id}".` };

        const project = {
          id,
          name: nombre,
          category: categoria,
          sources: { colorcito: colorcito_url || null },
          driveFolder: drive_folder,
          announcementChannel: null,
          readerRoleId: null,
          roleId: null,
          reactions: null,
          defaultCredits: creditos_default || null,
          active: true,
          addedAt: new Date().toISOString(),
          tags: tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : [],
          status: 'ongoing',
          thumbnail: null,
          color: null,
        };

        // Marcar el capítulo actual como "ya visto" para no anunciarlo al añadir
        if (colorcito_url) {
          try {
            const chap = await colorcito.getLatestChapter(colorcito_url);
            if (chap?.thumbnail) project.thumbnail = chap.thumbnail;
            if (chap?.chapterNum) {
              LastChapters.set(id, 'colorcito', { chapterNum: chap.chapterNum, chapterUrl: chap.chapterUrl });
            }
          } catch { /* no crítico */ }
        }

        Projects.save(project);
        return { ok: true, mensaje: `Proyecto "${nombre}" agregado con ID "${id}".`, id, categoria };
      } catch (err) {
        logger.error('LumiTools', `agregar_proyecto: ${err.message}`);
        return { error: err.message };
      }
    },

    eliminar_proyecto: async ({ id } = {}) => {
      const project = Projects.get(id);
      if (!project) return { error: `No existe un proyecto con ID "${id}".` };
      Projects.delete(id);
      return { ok: true, mensaje: `Proyecto "${project.name}" (${id}) eliminado.` };
    },

    activar_pausar_proyecto: async ({ id } = {}) => {
      const project = Projects.get(id);
      if (!project) return { error: `No existe un proyecto con ID "${id}".` };
      project.active = !project.active;
      Projects.save(project);
      return { ok: true, activo: project.active, mensaje: `"${project.name}" ${project.active ? 'activado' : 'pausado'}.` };
    },

    cambiar_estado_proyecto: async ({ id, estado } = {}) => {
      const project = Projects.get(id);
      if (!project) return { error: `No existe un proyecto con ID "${id}".` };
      const validos = ['ongoing', 'completed', 'hiatus', 'dropped'];
      if (!validos.includes(estado)) return { error: `Estado inválido. Usa: ${validos.join(', ')}.` };
      project.status = estado;
      Projects.save(project);
      const labels = { ongoing: 'En curso', completed: 'Completado', hiatus: 'Hiatus', dropped: 'Dropeado' };
      return { ok: true, mensaje: `Estado de "${project.name}" cambiado a: ${labels[estado]}.` };
    },

    sincronizar_cache: async ({ proyecto } = {}) => {
      const lista = proyecto
        ? [Projects.get(proyecto)].filter(Boolean)
        : Projects.list().filter(p => p.active);
      if (!lista.length) return { error: 'No encontré proyectos para sincronizar.' };

      let actualizados = 0;
      for (const project of lista) {
        const url = project.sources?.colorcito;
        if (!url) continue;
        try {
          const data = await colorcito.getLatestChapter(url);
          if (!data?.chapterNum) continue;
          const cached  = LastChapters.get(project.id, 'colorcito');
          const liveN   = parseFloat(String(data.chapterNum).replace(',', '.'));
          const cachedN = cached ? parseFloat(String(cached.chapterNum).replace(',', '.')) : -1;
          if (liveN > cachedN) {
            LastChapters.set(project.id, 'colorcito', { chapterNum: data.chapterNum, chapterUrl: data.chapterUrl });
            actualizados++;
          }
        } catch { /* seguir */ }
      }
      return { ok: true, revisados: lista.length, actualizados,
        mensaje: actualizados ? `${lista.length} proyecto(s) revisados, ${actualizados} actualizado(s).` : `${lista.length} proyecto(s) revisados. Todo ya estaba al día.` };
    },

    verificar_ahora: async () => {
      const { client } = context;
      if (!client?.isReady()) return { error: 'El cliente de Discord no está disponible.' };
      try {
        await monitor.forceCheck(client);
        return { ok: true, mensaje: 'Verificación de capítulos completada. Si hubo novedades aparecen en el canal de registros.' };
      } catch (err) {
        logger.error('LumiTools', `verificar_ahora: ${err.message}`);
        return { error: err.message };
      }
    },

    ver_status_todos: async () => {
      const activos = Projects.list().filter(p => p.active);
      if (!activos.length) return { mensaje: 'No hay proyectos activos.' };
      const resultados = [];
      for (const p of activos) {
        try {
          const st = await drive.getProjectStatus(p.driveFolder, p.category);
          resultados.push(st?.found
            ? { proyecto: p.name, total_caps: st.totalCaps, ultimo_cap: st.lastCap, resumen: st.summary }
            : { proyecto: p.name, error: 'Carpeta no encontrada en Drive' });
        } catch (err) {
          resultados.push({ proyecto: p.name, error: err.message });
        }
      }
      return { total: activos.length, proyectos: resultados };
    },

    diagnostico_sistema: async () => {
      const { client } = context;
      const checks = {};

      const ping = client?.ws?.ping ?? -1;
      checks.discord = ping >= 0 && ping < 500 ? `OK (${ping}ms)` : `Lento/sin datos (${ping}ms)`;

      const reqVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID', 'GDRIVE_ROOT_FOLDER_ID'];
      const faltan = reqVars.filter(v => !process.env[v]);
      checks.variables = faltan.length ? `Faltan: ${faltan.join(', ')}` : 'OK';

      try {
        await drive.listFolder(process.env.GDRIVE_ROOT_FOLDER_ID);
        checks.google_drive = 'OK';
      } catch (err) {
        checks.google_drive = `Error: ${err.message}`;
      }

      const proyectos = Projects.list();
      checks.proyectos = `${proyectos.length} registrados, ${proyectos.filter(p => p.active).length} activos`;

      const conColor = proyectos.find(p => p.sources?.colorcito);
      if (conColor) {
        try {
          const r = await Promise.race([
            colorcito.getLatestChapter(conColor.sources.colorcito),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
          ]);
          checks.scraper_colorcito = r ? 'OK' : 'Sin datos (¿cambió el sitio?)';
        } catch (err) {
          checks.scraper_colorcito = `Error: ${err.message}`;
        }
      } else {
        checks.scraper_colorcito = 'Sin proyectos de Colorcito para probar';
      }

      const todoOk = !faltan.length && checks.google_drive === 'OK' && (ping >= 0 && ping < 500);
      return { todo_ok: todoOk, checks };
    },

    // ── Moderación (disponibles en cualquier servidor) ──────────────────────
    banear_usuario: async (args) => {
      try { return await mod.banUser({ message: context.message, ...args }); }
      catch (err) { return { error: err.message }; }
    },

    expulsar_usuario: async (args) => {
      try { return await mod.kickUser({ message: context.message, ...args }); }
      catch (err) { return { error: err.message }; }
    },

    silenciar_usuario: async (args) => {
      try { return await mod.timeoutUser({ message: context.message, ...args }); }
      catch (err) { return { error: err.message }; }
    },

    quitar_silencio: async (args) => {
      try { return await mod.untimeoutUser({ message: context.message, ...args }); }
      catch (err) { return { error: err.message }; }
    },

  };
}

module.exports = { DEFINITIONS, MOD_DEFINITIONS, getDefinitions, getExecutors };
