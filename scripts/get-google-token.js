#!/usr/bin/env node
// scripts/get-google-token.js
// Genera el GOOGLE_REFRESH_TOKEN de OAuth para Google Drive, sin admin.
//
// Requisitos previos (ver GUIA-DRIVE.md):
//   1. Tener un "ID de cliente de OAuth" tipo "Aplicación web" en Google Cloud
//      con esta URI de redirección autorizada:  http://localhost:3001/callback
//   2. Poner GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el .env (o pasarlos como
//      argumentos:  npm run google-token -- TU_CLIENT_ID TU_CLIENT_SECRET).
//
// Uso:
//   npm run google-token
//   → abre la URL que imprime, autoriza, y te devuelve el GOOGLE_REFRESH_TOKEN.

require('dotenv').config();
const http = require('http');
const { google } = require('googleapis');

const PORT     = 3001;
const REDIRECT = `http://localhost:${PORT}/callback`;
// Scope completo: permite leer (/status) y escribir (subir/crear/borrar).
const SCOPES   = ['https://www.googleapis.com/auth/drive'];

const clientId     = process.env.GOOGLE_CLIENT_ID     || process.argv[2];
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.argv[3];

if (!clientId || !clientSecret) {
  console.error('\n❌ Faltan credenciales.');
  console.error('   Pon GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el .env, o pásalos así:');
  console.error('   npm run google-token -- TU_CLIENT_ID TU_CLIENT_SECRET\n');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',   // necesario para recibir refresh_token
  prompt:      'consent',   // fuerza que SIEMPRE devuelva refresh_token
  scope:       SCOPES,
});

console.log('\n────────────────────────────────────────────────────────────');
console.log('1) Abre esta URL en tu navegador y autoriza con tu cuenta de Drive:\n');
console.log('   ' + authUrl);
console.log('\n2) Al terminar, Google te redirige a localhost:3001 y este script');
console.log('   imprimirá tu GOOGLE_REFRESH_TOKEN aquí abajo.');
console.log('────────────────────────────────────────────────────────────\n');

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) { res.writeHead(404); res.end(); return; }

  const code = new URL(req.url, REDIRECT).searchParams.get('code');
  if (!code) { res.end('No recibí el código. Revisa la URL.'); return; }

  try {
    const { tokens } = await oauth2.getToken(code);
    res.end('✅ Listo. Ya puedes cerrar esta pestaña y volver a la terminal.');

    if (tokens.refresh_token) {
      console.log('✅ ¡Token generado! Copia esta línea en tu .env:\n');
      console.log('   GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token + '\n');
    } else {
      console.log('⚠️  No llegó refresh_token. Suele pasar si ya habías autorizado antes.');
      console.log('   Revoca el acceso en https://myaccount.google.com/permissions');
      console.log('   y vuelve a ejecutar  npm run google-token\n');
    }
  } catch (err) {
    res.end('Error al canjear el código: ' + err.message);
    console.error('\n❌ Error:', err.message, '\n');
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(PORT, () => console.log(`Esperando la autorización en ${REDIRECT} ...\n`));
