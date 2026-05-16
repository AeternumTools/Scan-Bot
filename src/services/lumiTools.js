// src/services/lumiTools.js
// Herramientas disponibles para el agente de Lumi (formato OpenAI/Groq tool-use)

const drive     = require('./driveService');
const colorcito = require('./colorcito');
const announcer = require('./announcer');
const railway   = require('./railwayService');
const mod       = require('./modService');
const { Projects } = require('../utils/storage');
const logger    = require('../utils/logger');

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
      description: 'Muestra las variables de entorno del bot en Railway. Las credenciales sensibles aparecen enmascaradas. Indica cuáles pueden editarse.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editar_variable',
      description: 'Edita una variable de configuración del bot en Railway. Acepta el nombre de la variable en lenguaje natural (ej: "canal de anuncios", "intervalo", "rol de mod") o el nombre técnico exacto. NO puede tocar tokens, API keys ni credenciales. Cambiar una variable reinicia el bot en ~30-60 segundos.',
      parameters: {
        type: 'object',
        properties: {
          nombre: {
            type: 'string',
            description: 'Nombre de la variable en lenguaje natural o nombre técnico. Ejemplos: "canal de anuncios", "ANNOUNCEMENT_CHANNEL_ID", "intervalo", "zona horaria", "canal de raws".',
          },
          valor: {
            type: 'string',
            description: 'Nuevo valor para la variable (ID de canal, ID de rol, número de minutos, etc.).',
          },
        },
        required: ['nombre', 'valor'],
      },
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
  const homeTools = DEFINITIONS.map(d => withScope('home', d));
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

    editar_variable: async ({ nombre, valor }) => {
      try {
        const result = railway.setVariable(nombre, valor);
        return {
          ok: true,
          mensaje: `"${result.label}" actualizada a "${valor}". El cambio aplica de inmediato.`,
        };
      } catch (err) {
        logger.error('LumiTools', `editar_variable: ${err.message}`);
        return { error: err.message };
      }
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
