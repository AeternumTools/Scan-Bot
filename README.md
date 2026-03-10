# 📖 Scan Discord Bot

Bot de Discord para grupos de scanlation. Monitorea **TuMangaOnline (LectorTMO)** y **Colorcito.com**, verifica el estado de proyectos en **Google Drive** y publica anuncios automáticos con reacciones en tu servidor.

---

## ✨ Funcionalidades

| Función | Descripción |
|---|---|
| 📢 **Anuncios automáticos** | Detecta nuevos capítulos y los anuncia en tu canal |
| 🔔 **Roles por serie** | Menciona el rol del proyecto al anunciar |
| 🎭 **Reacciones automáticas** | Añade emojis al mensaje de anuncio |
| 📂 **Estado en Drive** | Muestra cuántos Raws/Cleans/Traducciones/Typeos hay |
| ⚙️ **Panel en Discord** | Configura todo sin tocar código |
| 🔍 **Búsqueda integrada** | Busca mangas en TMO y Colorcito directamente |

---

## 🚀 Instalación paso a paso

### 1. Requisitos previos

- **Node.js 18+** → [nodejs.org](https://nodejs.org)
- Una cuenta de **Discord** con permisos de administrador en tu servidor
- Acceso a **Google Drive** con los proyectos

---

### 2. Crear el bot de Discord

1. Ve a [discord.com/developers/applications](https://discord.com/developers/applications)
2. Clic en **"New Application"** → dale un nombre (ej: `ScanBot`)
3. Ve a **Bot** → clic en **"Add Bot"**
4. En **Privileged Gateway Intents** activa:
   - ✅ `SERVER MEMBERS INTENT`
   - ✅ `MESSAGE CONTENT INTENT`
5. Copia el **TOKEN** (lo necesitas en `.env`)
6. Ve a **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Add Reactions`, `Embed Links`, `Read Message History`, `Mention Everyone`
7. Abre la URL generada y añade el bot a tu servidor

**¿Dónde encuentro los IDs?**
- Activa el **Modo Desarrollador** en Discord: Ajustes → Avanzado → Modo desarrollador
- Click derecho en tu servidor → **Copiar ID del servidor** (GUILD_ID)
- Click derecho en el canal de anuncios → **Copiar ID** (CHANNEL_ID)
- Tu Application ID está en la página de tu app en Discord Developers (CLIENT_ID)

---

### 3. Configurar Google Drive (Service Account)

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto nuevo o usa uno existente
3. Ve a **APIs y servicios → Biblioteca**
   - Busca y activa: **Google Drive API**
4. Ve a **IAM y admin → Cuentas de servicio**
   - Clic en **"Crear cuenta de servicio"**
   - Ponle un nombre, por ej: `scan-bot`
   - Clic en **Crear y continuar → Continuar → Listo**
5. Haz clic en la cuenta de servicio recién creada
6. Ve a la pestaña **Claves → Agregar clave → Crear clave nueva → JSON**
7. Descarga el archivo JSON y guárdalo como `config/google-credentials.json`
8. **Comparte tu carpeta raíz de Drive** con el email de la cuenta de servicio:
   - El email se ve en la página de la cuenta: `nombre@proyecto.iam.gserviceaccount.com`
   - En Google Drive → click derecho en tu carpeta de proyectos → **Compartir**
   - Pega el email de la cuenta de servicio → rol **Lector** → Enviar

**¿Cuál es el ID de la carpeta?**
Cuando abres la carpeta en Drive, la URL tiene este formato:
```
https://drive.google.com/drive/folders/1ABC123XYZ...
                                       ↑ este es el ID
```

---

### 4. Configurar el bot

```bash
# Clonar / descomprimir los archivos
cd scanbot

# Instalar dependencias
npm install

# Copiar el archivo de configuración
cp .env.example .env
```

Abre `.env` con un editor de texto y llena los valores:

```env
DISCORD_TOKEN=tu_token_aqui
DISCORD_CLIENT_ID=tu_client_id
DISCORD_GUILD_ID=id_de_tu_servidor
ANNOUNCEMENT_CHANNEL_ID=id_del_canal_anuncios
LOG_CHANNEL_ID=id_del_canal_logs       # puede ser el mismo canal

GDRIVE_ROOT_FOLDER_ID=id_carpeta_drive

CHECK_INTERVAL_MINUTES=25              # cada cuántos minutos verificar
TIMEZONE=America/Bogota
```

---

### 5. Registrar los comandos en Discord

```bash
node src/deploy-commands.js
```

Esto registra los slash commands (`/proyecto`, `/status`, etc.) en tu servidor.
Solo necesitas ejecutarlo una vez, o cuando añadas nuevos comandos.

---

### 6. Iniciar el bot

```bash
# Producción
npm start

# Desarrollo (reinicio automático al guardar)
npm run dev
```

Si todo está bien verás:
```
🟢 [Bot] Conectado como ScanBot#1234
🔵 [Monitor] Iniciando scheduler: cada 25 minutos
```

---

## 📋 Comandos disponibles

### `/proyecto`
| Subcomando | Descripción |
|---|---|
| `add` | Añade un nuevo proyecto al bot |
| `remove` | Elimina un proyecto |
| `list` | Lista todos los proyectos |
| `info` | Info detallada + estado de Drive |
| `toggle` | Activa/pausa el monitoreo |
| `setstatus` | Cambia estado: ongoing/completed/hiatus/dropped |

**Ejemplo — añadir un proyecto:**
```
/proyecto add
  nombre: Solo Leveling
  drive_folder: Solo Leveling
  tmo_url: https://lectortmo.com/library/manga/12345/solo-leveling
  colorcito_url: https://colorcito.com/manga/solo-leveling
  rol: @Solo Leveling
  tags: manhwa,accion,color
```

---

### `/status`
```
/status                        → Estado de todos los proyectos
/status proyecto: solo-leveling → Estado detallado de uno
```

Muestra:
```
📂 Solo Leveling — Estado
✅ Raws   ████████░░ 80% (80)
✅ Cleans ██████░░░░ 60% (60)
🟡 Trad.  ████░░░░░░ 40% (40)
❌ Typeo  ██░░░░░░░░ 20% (20)
```

---

### `/configurar`
| Subcomando | Descripción |
|---|---|
| `canal` | Cambia el canal de anuncios (global o por proyecto) |
| `reacciones` | Cambia las reacciones de un proyecto |
| `rol` | Asigna/quita el rol de ping de un proyecto |
| `verificar` | Fuerza una verificación manual ahora |
| `info` | Muestra la configuración actual del bot |

---

### `/buscar`
```
/buscar nombre: Omniscient Reader fuente: tmo
/buscar nombre: Tower of God fuente: ambas
```

---

### `/anunciar`
```
/anunciar proyecto: solo-leveling
/anunciar proyecto: solo-leveling fuente: colorcito capitulo: 150
```

---

## 📁 Estructura de carpetas en Google Drive

El bot espera esta estructura para cada proyecto:

```
📁 [Tu carpeta raíz]
  📁 Solo Leveling
    📁 Raws          ← (o RAW, Crudos...)
    📁 Cleans        ← (o Limpieza, Clean...)
    📁 Traduccion    ← (o Traducciones, TL...)
    📁 Typeo         ← (o Typesetting, TS...)
  📁 Omniscient Reader
    📁 Raws
    ...
```

Puedes personalizar los nombres aceptados en `config/config.js` → `DRIVE_FOLDERS`.

---

## 🎨 Personalizar reacciones

**Reacciones globales** (para todos los proyectos) — edita `config/config.js`:
```js
REACTIONS: {
  newChapter: ['❤️', '🔥', '👏'],
}
```

**Reacciones por proyecto** — usa el comando:
```
/configurar reacciones proyecto: solo-leveling emojis: ⚔️ 💀 🔥
```

Para usar **emojis custom de tu servidor**, copia el emoji en Discord
y pégalo directamente en el comando. El formato es `<:nombre:ID>`.

---

## 🔧 Archivos de datos

El bot guarda todo en la carpeta `data/`:
- `projects.json` — proyectos configurados
- `last_chapters.json` — último capítulo visto por proyecto
- `drive_cache.json` — caché de Drive (15 min)

No borres estos archivos o el bot volverá a anunciar todos los capítulos.

---

## ❓ Solución de problemas

**El bot no detecta nuevos capítulos**
- Verifica que la URL del proyecto sea correcta con `/proyecto info`
- Usa `/configurar verificar` para forzar un chequeo inmediato
- Revisa los logs en tu canal de logs

**Error de Google Drive**
- Asegúrate de haber compartido la carpeta con el email del Service Account
- Verifica que `GDRIVE_ROOT_FOLDER_ID` sea correcto
- El nombre en `drive_folder` debe coincidir EXACTAMENTE con el nombre en Drive

**Los comandos no aparecen en Discord**
- Ejecuta `node src/deploy-commands.js` de nuevo
- Puede tardar hasta 1 hora en propagarse (en servidores específicos suele ser instantáneo)

---

## 📝 Notas

- El bot usa **scraping** en TMO y Colorcito. Si cambian su estructura HTML puede requerir ajuste en los scrapers (`src/services/tmoScraper.js` y `src/services/colorcito.js`).
- El intervalo mínimo recomendado es **15 minutos** para no saturar los servidores.
- Los comandos de configuración requieren el permiso **Gestionar Servidor** en Discord.
