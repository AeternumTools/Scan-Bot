#!/usr/bin/env node
// scripts/restore.js
// Restaura una copia creada con  npm run backup  en este PC.
// Extrae data/, .env y config/ tal cual estaban en el PC original.
//
// Uso:
//   npm run restore                       → busca el lumi-backup-*.zip más reciente
//   npm run restore -- lumi-backup-X.zip  → restaura ese archivo concreto

const fs     = require('fs');
const path   = require('path');
const AdmZip = require('adm-zip');

const ROOT = path.resolve(__dirname, '..');

function masReciente() {
  const zips = fs.readdirSync(ROOT)
    .filter(f => /^lumi-backup.*\.zip$/i.test(f))
    .map(f => ({ f, t: fs.statSync(path.join(ROOT, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return zips.length ? zips[0].f : null;
}

function main() {
  const arg     = process.argv[2];
  const nombre  = arg || masReciente();

  if (!nombre) {
    console.error('\n❌ No encontré ningún archivo  lumi-backup-*.zip  en esta carpeta.');
    console.error('   Indica la ruta:  npm run restore -- /ruta/a/tu-backup.zip\n');
    process.exit(1);
  }

  const zipPath = path.isAbsolute(nombre) ? nombre : path.join(ROOT, nombre);
  if (!fs.existsSync(zipPath)) {
    console.error(`\n❌ No existe el archivo: ${zipPath}\n`);
    process.exit(1);
  }

  console.log(`\n📦 Restaurando desde: ${path.basename(zipPath)}`);

  const zip = new AdmZip(zipPath);
  // overwrite = true → reemplaza los archivos existentes con los del backup
  zip.extractAllTo(ROOT, /* overwrite */ true);

  const entradas = zip.getEntries().map(e => e.entryName);
  const tiene = p => entradas.some(e => e.startsWith(p));

  console.log('\n✅ Restauración completada. Recuperado:');
  if (tiene('data'))                          console.log('   • data/        (proyectos, historial, config)');
  if (entradas.includes('.env'))              console.log('   • .env         (tokens y configuración)');
  if (tiene('config/google-credentials.json'))console.log('   • config/google-credentials.json');

  console.log('\n👉 Siguiente paso:');
  console.log('     npm install      (si es la primera vez en este PC)');
  console.log('     npm run deploy   (registra los comandos / en tu servidor)');
  console.log('     npm start        (arranca el bot)\n');
}

main();
