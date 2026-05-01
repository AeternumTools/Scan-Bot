# 📖 Lumi Bot

Bot de Discord diseñado para Aeternum Translations. Monitorea **Colorcito.com**, verifica el estado de proyectos en **Google Drive** y publica anuncios automáticos con reacciones personalizadas en tu servidor.

---

## ✨ Funcionalidades

| Función | Descripción |
|---|---|
| 📢 **Anuncios automáticos** | Detecta nuevos capítulos en Colorcito y los anuncia en tu canal |
| 🔔 **Roles por serie** | Menciona el rol del proyecto al anunciar |
| 🎭 **Reacciones automáticas** | Añade emojis al mensaje de anuncio |
| 📂 **Estado en Drive** | Muestra cuántos Raws/Cleans/Traducciones/Typeos hay |
| ⚙️ **Panel en Discord** | Configura todo mediante comandos Slash (`/`) sin tocar código |
| 🔍 **Búsqueda integrada** | Busca proyectos en Colorcito directamente desde Discord |
| 📝 **Sistemas integrados** | Flujos de reclutamiento y reportes de errores (tickets) |

---

## 🚀 Instalación paso a paso

### 1. Requisitos previos

- **Node.js 20+** → [nodejs.org](https://nodejs.org)
- Una cuenta de **Discord** con permisos de administrador en tu servidor
- Acceso a **Google Drive** con los proyectos

---

### 2. Crear el bot de Discord

1. Ve a [discord.com/developers/applications](https://discord.com/developers/applications)
2. Clic en **"New Application"** → dale el nombre `Lumi`
3. Ve a **Bot** → clic en **"Add Bot"**
4. En **Privileged Gateway Intents** activa:
   - ✅ `SERVER MEMBERS INTENT`
5. Copia el **TOKEN** (lo necesitas en `.env`)
6. Ve a **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Add Reactions`, `Embed Links`, `Read Message History`, `Mention Everyone`, `Manage Threads`
7. Abre la URL generada y añade el bot a tu servidor

---

### 3. Configurar Google Drive (Service Account)

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto nuevo o usa uno existente
3. Ve a **APIs y servicios → Biblioteca**
   - Busca y activa: **Google Drive API**
4. Ve a **IAM y admin → Cuentas de servicio**
   - Clic en **"Crear cuenta de servicio"**
   - Ponle un nombre, por ej: `lumi-bot`
   - Clic en **Crear y continuar → Continuar → Listo**
5. Haz clic en la cuenta de servicio recién creada
6. Ve a la pestaña **Claves → Agregar clave → Crear clave nueva → JSON**
7. Descarga el archivo JSON y guárdalo como `config/google-credentials.json`
8. **Comparte tu carpeta raíz de Drive** con el email de la cuenta de servicio (rol **Lector**).

---

### 4. Configurar el bot

```bash
# Instalar dependencias
npm install

# Copiar el archivo de configuración
cp .env.example .env
```

Abre `.env` con un editor de texto y llena los valores:

```env
DISCORD_TOKEN=tu_token_aqui
DISCORD_CLIENT_ID=tu_client_id
DISCORD_GUILD_ID=id_de_tu_servidor_staff
DISCORD_READER_GUILD_ID=id_de_tu_servidor_lectores

GDRIVE_ROOT_FOLDER_ID=id_carpeta_drive
```

---

### 5. Registrar los comandos en Discord

```bash
npm run deploy
```

Esto registra los slash commands (`/proyecto`, `/status`, `/anunciar`, etc.) en tu servidor de Staff y los comandos de lectores en el servidor de Lectores.

---

### 6. Iniciar el bot

```bash
# Producción
npm start

# Desarrollo
npm run dev
```

---

## 📋 Comandos principales

### `/proyecto`
Gestión de proyectos en la base de datos de Lumi.
- `/proyecto add nombre: Solo Leveling drive_folder: Solo Leveling colorcito_url: https://colorcitoscan.com/manga/solo-leveling categoria: manhwas`
- `/proyecto info` — Detalles de configuración.
- `/proyecto list` — Ver todos los activos.
- `/proyecto toggle` — Activa o desactiva su monitoreo.

### `/status`
Revisa el estado de progreso en Google Drive y el último capítulo en Colorcito.
- `/status` — Resumen de todos los proyectos.
- `/status proyecto: solo-leveling` — Resumen detallado de un solo proyecto.

### `/configurar`
Ajustes dinámicos del bot.
- `/configurar canal` — Asigna canal de anuncios.
- `/configurar reacciones` — Asigna emojis para nuevos capítulos.
- `/configurar rol` — Asigna el rol de Discord que se debe mencionar.

### `/buscar`
- `/buscar nombre: Omniscient Reader` — Busca la URL del proyecto en Colorcito.

### `/anunciar`
Fuerza un anuncio de forma manual.
- `/anunciar proyecto: solo-leveling capitulo: 150`

---

## 📁 Estructura de carpetas en Google Drive

Lumi lee esta estructura para armar la tabla de progreso de `/status`:

```text
📁 [Carpeta Raíz del Scan]
  📁 Solo Leveling
    📁 Raws
    📁 Cleans
    📁 Traduccion
    📁 Typeo
```

---

## 🔧 Archivos de datos

El bot guarda su estado en la carpeta `data/`:
- `projects.json` — proyectos configurados.
- `last_chapters.json` — registro del último capítulo anunciado para no repetir.
- `drive_cache.json` — caché de Google Drive para mayor velocidad.

---

## 📝 Notas
- El bot hace **scraping** a Colorcito. Si la web cambia su diseño, podría ser necesario actualizar `src/services/colorcito.js`.
- No borres `last_chapters.json`, o Lumi anunciará de nuevo los capítulos que ya procesó.
