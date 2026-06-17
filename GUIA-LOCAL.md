# 💻 Correr Lumi en tu PC (sin admin y sin pagar)

Guía para llevar el bot a otro computador —por ejemplo el del trabajo— **sin
permisos de administrador** y **sin reconfigurar nada en Discord**.

> El bot es 100 % Node.js. No instala servicios del sistema ni necesita puertos
> privilegiados, así que corre en una cuenta de usuario normal.

---

## 🧩 Resumen de lo que cuesta dinero (spoiler: nada obligatorio)

| Servicio | ¿Pago? |
|---|---|
| Bot de Discord | Gratis siempre |
| Groq (la IA de Lumi) | Tiene capa **gratuita**; el bot ya está optimizado para ella |
| Google Drive API | Gratis |
| Railway (hosting 24/7) | **No lo necesitas** si corres el bot en tu PC |

La única "desventaja" de correrlo en tu PC es que el bot solo está en línea
mientras el PC esté encendido y con internet.

---

## 1. Instalar Node.js **sin administrador** (Windows)

No uses el instalador `.msi` (pide admin). Usa la versión **portable (.zip)**:

1. Entra a <https://nodejs.org/en/download> → elige **Windows Binary (.zip)** de la
   versión **LTS (20 o superior)**, arquitectura x64.
2. Descomprime el `.zip` en una carpeta de tu usuario, por ejemplo:
   `C:\Users\TU_USUARIO\node`
3. Añade esa carpeta al `PATH` **de usuario** (no del sistema, eso no pide admin):
   - Menú inicio → escribe *"Editar las variables de entorno de tu cuenta"*.
   - En **Variables de usuario** → selecciona `Path` → **Editar** → **Nuevo** →
     pega `C:\Users\TU_USUARIO\node` → Aceptar.
4. Abre una **PowerShell nueva** y verifica:
   ```powershell
   node --version
   npm --version
   ```
   Si imprime las versiones, listo. ✅

> ¿Bloqueado incluso para esto? Alternativa: [`fnm`](https://github.com/Schniz/fnm)
> o `nvm-windows` instalan Node en tu carpeta de usuario sin admin.

---

## 2. Traer el proyecto

```powershell
git clone https://github.com/AeternumTools/Scan-Bot.git
cd Scan-Bot
npm install
```

`npm install` descarga todo dentro de `node_modules/` en la propia carpeta del
proyecto: no necesita admin.

---

## 3. Recuperar tu configuración (sin tocar Discord) 🪄

Tienes **dos formas**. La opción A es la más cómoda si aún tienes acceso al PC /
servidor donde el bot funcionaba.

### Opción A — Mover TODO con un backup (recomendado)

En el **PC original** (donde el bot ya estaba configurado):

```powershell
npm run backup
```

Esto genera un archivo `lumi-backup-AAAA-MM-DD.zip` con tus **proyectos, el
historial de capítulos, la configuración por servidor, el `.env` y las
credenciales de Google**.

Copia ese `.zip` al PC nuevo (USB, Drive, lo que sea), déjalo dentro de la
carpeta `Scan-Bot` y ejecuta:

```powershell
npm run restore
```

¡Listo! No tienes que volver a usar `/configurar` ni `/proyecto add`. Todo queda
igual que en el PC anterior.

### Opción B — Rellenar el `.env` a mano

Si no puedes generar el backup (por ejemplo, el bot vivía en Railway):

1. Copia la plantilla:
   ```powershell
   copy .env.example .env
   ```
2. Abre `.env` con el Bloc de notas y rellena los valores. Los **tokens** y los
   **IDs de canales/roles** los puedes copiar tal cual desde el panel de
   *Variables* de Railway (Settings → Variables) de tu proyecto.
3. Como el bot lee toda su config desde el `.env` como respaldo, con esto **no
   necesitas reconfigurar canales ni roles en Discord**.

> ⚠️ Con la Opción B, tus **proyectos** (`/proyecto add`) no se copian solos:
> o restauras `data/projects.json` desde el PC viejo, o los vuelves a añadir.

---

## 4. Registrar los comandos y arrancar

```powershell
npm run deploy   # registra los comandos / en tu servidor (solo la 1ª vez)
npm start        # arranca el bot
```

Si todo va bien verás en la consola algo como
`✅ Conectado como Lumi#1234`. Deja esa ventana abierta: mientras esté abierta,
el bot está en línea.

> Para detenerlo: `Ctrl + C` en esa ventana.

---

## 5. Mantenerlo encendido (opcional)

- **Lo más simple:** deja la ventana de PowerShell abierta.
- Para que sobreviva a cierres de sesión sin admin puedes usar
  [`pm2`](https://pm2.keymetrics.io/) instalado localmente:
  ```powershell
  npm install pm2
  npx pm2 start src/index.js --name lumi
  ```
  (Nota: configurar pm2 como servicio de arranque automático **sí** suele pedir
  admin; sin él, tendrás que relanzarlo tras reiniciar el PC.)

---

## 🔁 Para futuros traslados

Cada vez que quieras mover el bot a otro equipo:

```powershell
npm run backup    # en el PC actual  → genera el .zip
npm run restore   # en el PC nuevo   → lo deja igualito
```

---

## ❓ Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `node no se reconoce` | El `PATH` no quedó bien | Cierra y reabre PowerShell; revisa el paso 1.3 |
| `Variables de entorno faltantes: DISCORD_TOKEN...` | Falta o está vacío el `.env` | Revisa el paso 3 |
| El bot conecta pero no responde / no anuncia | Red corporativa bloquea salidas | Prueba en otra red; el firewall del trabajo puede bloquear Discord/Groq/Drive |
| La IA no contesta | Falta `GROQ_API_KEY` | Crea una gratis en <https://console.groq.com/keys> |
| `/status` vacío | Falta configurar Google Drive | Revisa la sección de Drive en el `.env` |
