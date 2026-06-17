#!/usr/bin/env node
// scripts/auto-update.js
// Supervisor de Lumi: lanza el bot y lo mantiene actualizado solo.
//
// Cada AUTO_UPDATE_INTERVAL_SEC segundos (60 por defecto) revisa la rama en
// GitHub; si hay commits nuevos: git pull → (npm install si cambiaron deps) →
// reinicia el bot. También relanza el bot si se cae.
//
// Uso:   npm run auto
// Detener: Ctrl + C
//
// Variables opcionales (.env o entorno):
//   AUTO_UPDATE_INTERVAL_SEC  → cada cuántos segundos revisar (default 60)
//   AUTO_UPDATE_BRANCH        → rama a seguir (default: la rama actual)

const { spawn, execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function log(msg) {
  console.log(`\x1b[36m[auto-update]\x1b[0m ${new Date().toLocaleTimeString()} ${msg}`);
}

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim();
}

// Huella de las dependencias, para saber si hace falta npm install tras un pull
function depsFingerprint() {
  try {
    const a = fs.existsSync(path.join(ROOT, 'package.json'))      ? fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')      : '';
    const b = fs.existsSync(path.join(ROOT, 'package-lock.json')) ? fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8') : '';
    return a + b;
  } catch { return ''; }
}

const INTERVAL_MS = (parseInt(process.env.AUTO_UPDATE_INTERVAL_SEC, 10) || 60) * 1000;
let BRANCH;
try {
  BRANCH = process.env.AUTO_UPDATE_BRANCH || git('rev-parse --abbrev-ref HEAD');
} catch {
  console.error('❌ Esto no parece un repositorio git. Ejecútalo dentro de la carpeta del bot.');
  process.exit(1);
}

let child = null;
let restarting = false;
let checking = false;

// ── Ciclo de vida del bot ──────────────────────────────────────────────────────
function startBot() {
  log(`Iniciando bot — rama "${BRANCH}" @ ${safe(() => git('rev-parse --short HEAD'))}`);
  child = spawn(process.execPath, ['src/index.js'], { cwd: ROOT, stdio: 'inherit' });

  child.on('exit', (code, signal) => {
    if (restarting) return; // lo reiniciamos nosotros a propósito
    child = null;
    log(`El bot se detuvo (code=${code ?? '-'}, signal=${signal ?? '-'}). Relanzando en 5s...`);
    setTimeout(startBot, 5000);
  });
}

function stopBot() {
  return new Promise(resolve => {
    if (!child) return resolve();
    restarting = true;
    const c = child;
    const hard = setTimeout(() => { try { c.kill('SIGKILL'); } catch {} }, 5000);
    c.once('exit', () => { clearTimeout(hard); restarting = false; child = null; resolve(); });
    c.kill(); // SIGTERM (el bot maneja SIGINT/cierre limpio)
  });
}

function safe(fn) { try { return fn(); } catch { return '?'; } }

// ── Comprobación de actualizaciones ────────────────────────────────────────────
async function checkForUpdates() {
  if (checking) return;
  checking = true;
  try {
    git(`fetch origin ${BRANCH} --quiet`);
    const local  = git('rev-parse HEAD');
    const remote = git(`rev-parse origin/${BRANCH}`);
    if (local === remote) return;

    log('🔔 Cambios nuevos en GitHub. Actualizando...');
    const before = depsFingerprint();

    try {
      git(`pull --ff-only origin ${BRANCH}`);
    } catch {
      log('⚠️ No pude hacer pull (¿cambios locales sin commitear o ramas divergidas?).');
      log('   El host debe ser "solo recibir". Resuélvelo manualmente y sigo intentando.');
      return;
    }

    log('✅ Pull listo → ' + safe(() => git('rev-parse --short HEAD')));

    if (depsFingerprint() !== before) {
      log('📦 Dependencias cambiaron → npm install...');
      try { execSync('npm install --no-audit --no-fund', { cwd: ROOT, stdio: 'inherit' }); }
      catch { log('⚠️ npm install falló; reinicio igual con lo que haya.'); }
    }

    await stopBot();
    startBot();
  } catch (err) {
    log('⚠️ Error revisando actualizaciones: ' + err.message.split('\n')[0]);
  } finally {
    checking = false;
  }
}

// ── Cierre limpio ───────────────────────────────────────────────────────────────
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Cerrando supervisor y bot...');
  await stopBot();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ── Arranque ────────────────────────────────────────────────────────────────────
log(`Supervisor activo. Reviso "${BRANCH}" cada ${INTERVAL_MS / 1000}s. Ctrl+C para salir.`);
startBot();
setInterval(checkForUpdates, INTERVAL_MS);
