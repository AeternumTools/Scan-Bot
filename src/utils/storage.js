// src/utils/storage.js — Persistencia local en JSON
const fs   = require('fs-extra');
const path = require('path');
const { DATA_FILES } = require('../../config/config');

// Asegura que el directorio data/ exista
fs.ensureDirSync('./data');

// ── Helpers genéricos ────────────────────────────────────────────────────────

function readJSON(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readJSONSync(filePath);
    }
  } catch (e) {
    console.error(`[Storage] Error leyendo ${filePath}:`, e.message);
  }
  return defaultValue;
}

function writeJSON(filePath, data) {
  try {
    fs.outputJSONSync(filePath, data, { spaces: 2 });
    return true;
  } catch (e) {
    console.error(`[Storage] Error escribiendo ${filePath}:`, e.message);
    return false;
  }
}

// ── Proyectos ─────────────────────────────────────────────────────────────────
/*
  Estructura de un proyecto:
  {
    id: "slug-unico",
    name: "Nombre del manga",
    sources: {
      tmo:       "https://lectortmo.com/...",   // URL en TMO (null si no aplica)
      colorcito: "https://colorcito.com/...",   // URL en Colorcito (null si no aplica)
    },
    driveFolder: "NombreExactoEnDrive",  // nombre de la carpeta en Drive
    announcementChannel: null,           // override del canal (null = usa el default)
    roleId: null,                        // ID del rol de Discord para pings
    reactions: null,                     // override de reacciones (null = usa las default)
    active: true,
    addedAt: "ISO timestamp",
    tags: [],                            // e.g. ["manhwa", "romance", "color"]
    status: "ongoing",                   // ongoing | completed | hiatus | dropped
    thumbnail: null,                     // URL de la portada
  }
*/

const Projects = {
  getAll() {
    return readJSON(DATA_FILES.projects, {});
  },

  get(id) {
    const all = this.getAll();
    return all[id] || null;
  },

  save(project) {
    const all = this.getAll();
    all[project.id] = { ...all[project.id], ...project };
    return writeJSON(DATA_FILES.projects, all);
  },

  delete(id) {
    const all = this.getAll();
    if (!all[id]) return false;
    delete all[id];
    return writeJSON(DATA_FILES.projects, all);
  },

  list() {
    return Object.values(this.getAll());
  },

  findByName(name) {
    return this.list().find(
      p => p.name.toLowerCase().includes(name.toLowerCase())
    ) || null;
  },
};

// ── Últimos capítulos vistos ──────────────────────────────────────────────────
/*
  {
    "proyecto-id": {
      tmo:       { chapterNum: "12", chapterUrl: "...", seenAt: "ISO" },
      colorcito: { chapterNum: "12", chapterUrl: "...", seenAt: "ISO" },
    }
  }
*/

const LastChapters = {
  getAll() {
    return readJSON(DATA_FILES.lastChapters, {});
  },

  get(projectId, source) {
    const all = this.getAll();
    return all[projectId]?.[source] || null;
  },

  set(projectId, source, data) {
    const all = this.getAll();
    if (!all[projectId]) all[projectId] = {};
    all[projectId][source] = { ...data, seenAt: new Date().toISOString() };
    return writeJSON(DATA_FILES.lastChapters, all);
  },
};

// ── Caché de Drive ────────────────────────────────────────────────────────────

const DriveCache = {
  getAll() {
    return readJSON(DATA_FILES.driveCache, {});
  },

  get(projectId) {
    const all = this.getAll();
    return all[projectId] || null;
  },

  set(projectId, data) {
    const all = this.getAll();
    all[projectId] = { ...data, cachedAt: new Date().toISOString() };
    return writeJSON(DATA_FILES.driveCache, all);
  },

  invalidate(projectId) {
    const all = this.getAll();
    delete all[projectId];
    return writeJSON(DATA_FILES.driveCache, all);
  },
};

module.exports = { Projects, LastChapters, DriveCache };
