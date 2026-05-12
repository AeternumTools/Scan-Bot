// src/services/memoryService.js
// Memoria persistente de Lumi: historial por canal y perfiles del staff.

const fs   = require('fs-extra');
const path = require('path');

const CONV_DIR    = 'data/conversations';
const MEMORY_FILE = 'data/memory.json';
const MAX_CONV    = 20; // intercambios guardados por canal

// ── Historial de conversación por canal ───────────────────────────────────────

function loadConversation(channelId) {
  const file = path.join(CONV_DIR, `${channelId}.json`);
  try {
    return fs.existsSync(file) ? fs.readJSONSync(file) : [];
  } catch { return []; }
}

function saveConversation(channelId, messages) {
  fs.ensureDirSync(CONV_DIR);
  fs.outputJSONSync(
    path.join(CONV_DIR, `${channelId}.json`),
    messages.slice(-MAX_CONV),
    { spaces: 2 },
  );
}

function appendToConversation(channelId, userMsg, assistantMsg) {
  const history = loadConversation(channelId);
  history.push(userMsg, assistantMsg);
  saveConversation(channelId, history);
}

// ── Perfiles del staff ────────────────────────────────────────────────────────

function loadMemory() {
  try {
    return fs.existsSync(MEMORY_FILE)
      ? fs.readJSONSync(MEMORY_FILE)
      : { staff: {} };
  } catch { return { staff: {} }; }
}

function touchStaff(userId, name) {
  const mem = loadMemory();
  if (!mem.staff[userId]) mem.staff[userId] = {};
  mem.staff[userId].name     = name;
  mem.staff[userId].lastSeen = new Date().toISOString();
  fs.ensureDirSync(path.dirname(MEMORY_FILE));
  fs.outputJSONSync(MEMORY_FILE, mem, { spaces: 2 });
}

// Genera el bloque de memoria que se inyecta al system prompt
function buildMemoryContext() {
  const mem   = loadMemory();
  const staff = Object.entries(mem.staff || {});
  if (!staff.length) return '';

  const lines = staff.map(([id, p]) => `- ${p.name} (ID: ${id})`);
  return `\n[Staff que ha interactuado conmigo]\n${lines.join('\n')}\n`;
}

module.exports = { loadConversation, appendToConversation, touchStaff, buildMemoryContext };
