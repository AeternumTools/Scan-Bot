#!/usr/bin/env node
// scripts/backup.js
// Empaqueta toda la configuración de Lumi en un único .zip portable, para
// moverla a otro PC sin tener que reconfigurar nada en Discord.
//
// Incluye:
//   • data/                         → proyectos, último capítulo, config por servidor
//   • .env                          → tokens y configuración del bot
//   • config/google-credentials.json → credenciales de Google Drive (si existen)
//
// Uso:
//   npm run backup                  → crea lumi-backup-AAAA-MM-DD.zip
//   npm run backup -- mi-archivo.zip → crea con un nombre concreto

const fs     = require('fs');
const path   = require('path');
const AdmZip = require('adm-zip');

const ROOT = path.resolve(__dirname, '..');

// Lo que vamos a respaldar.
//   folder → dest es la ruta de la carpeta dentro del zip
//   file   → dest es la CARPETA dentro del zip donde se coloca el archivo
//            ('' = raíz del zip), conservando su nombre original
const ITEMS = [
  { type: 'folder', src: 'data',                           dest: 'data'   },
  { type: 'file',   src: '.env',                           dest: ''       },
  { type: 'file',   src: 'config/google-credentials.json', dest: 'config' },
];

function main() {
  const argName = process.argv[2];
  const stamp   = new Date().toISOString().slice(0, 10);
  const outName = argName || `lumi-backup-${stamp}.zip`;
  const outPath = path.isAbsolute(outName) ? outName : path.join(ROOT, outName);

  const zip      = new AdmZip();
  const incluido = [];
  const faltante = [];

  for (const item of ITEMS) {
    const abs = path.join(ROOT, item.src);
    if (!fs.existsSync(abs)) { faltante.push(item.src); continue; }

    if (item.type === 'folder') zip.addLocalFolder(abs, item.dest);
    else                        zip.addLocalFile(abs, item.dest);

    incluido.push(item.src);
  }

  if (!incluido.length) {
    console.error('\n❌ No se encontró nada que respaldar (¿ya configuraste el bot?).');
    console.error('   Esperaba al menos la carpeta  data/  o el archivo  .env\n');
    process.exit(1);
  }

  zip.writeZip(outPath);

  console.log('\n✅ Backup creado:');
  console.log(`   📦 ${outPath}\n`);
  console.log('   Incluido:');
  incluido.forEach(f => console.log(`     • ${f}`));
  if (faltante.length) {
    console.log('\n   Omitido (no existe, normal si no lo usas):');
    faltante.forEach(f => console.log(`     · ${f}`));
  }
  console.log('\n👉 Copia ese .zip al otro PC y ejecuta:  npm run restore -- ' + path.basename(outPath) + '\n');
  console.log('⚠️  Contiene tokens y credenciales: guárdalo en lugar seguro y NO lo subas a git.\n');
}

main();
