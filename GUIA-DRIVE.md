# 📂 Conectar Google Drive (sacar los tokens para el `.env`)

El error `invalid_grant` significa que las credenciales de Google no son válidas
o caducaron. Aquí tienes cómo sacar **las dos** credenciales y ponerlas en el
`.env`. Puedes tener ambas a la vez: el bot usa OAuth si está, y si no, la
Service Account.

| | Service Account | OAuth (refresh token) |
|---|---|---|
| Sirve para | **Leer** (`/status`) | **Leer y SUBIR** (`subir_raws`, crear/borrar) |
| Caduca | ❌ Nunca | ⚠️ A los 7 días si la app está en modo *Testing* |
| Dificultad | Fácil | Media (pero hay script) |

> 💡 Recomendación: configura **ambas**. La Service Account te da `/status`
> estable para siempre; el OAuth habilita las subidas a tu Drive personal.

---

## 🅰️ Service Account (lectura, nunca caduca)

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) y crea (o usa) un proyecto.
2. **APIs y servicios → Biblioteca** → busca y **activa "Google Drive API"**.
3. **IAM y administración → Cuentas de servicio → Crear cuenta de servicio**.
   - Nombre: `lumi-bot` → Crear y continuar → Listo.
4. Entra a la cuenta creada → pestaña **Claves → Agregar clave → Crear clave nueva → JSON**.
   - Se descarga un archivo `.json`.
5. Guarda ese archivo como **`config/google-credentials.json`** dentro del proyecto.
   *(O pega su contenido en una sola línea en `GOOGLE_SERVICE_ACCOUNT_KEY` del `.env`.)*
6. Abre el `.json`, copia el email `client_email` (algo como `lumi-bot@...iam.gserviceaccount.com`).
7. En **Google Drive**, clic derecho en tu carpeta raíz del scan → **Compartir** →
   pega ese email → permiso **Lector** (o **Editor** si quieres que pueda escribir en un Drive compartido).
8. En el `.env`, pon el ID de la carpeta raíz:
   ```env
   GDRIVE_ROOT_FOLDER_ID=el_id_de_la_url_de_la_carpeta
   ```
   (de la URL `drive.google.com/drive/folders/ESTE_ID`)

✅ Con esto `/status` ya funciona.

---

## 🅱️ OAuth (permite SUBIR a tu Drive personal)

### 1. Crear el cliente de OAuth
1. En el mismo proyecto: **APIs y servicios → Pantalla de consentimiento de OAuth**.
   - Tipo **Externo** → llena lo mínimo (nombre de app, tu correo).
   - En **Usuarios de prueba**, agrega tu propia cuenta de Google.
2. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
   - Tipo de aplicación: **Aplicación web**.
   - En **URIs de redirección autorizados** agrega EXACTAMENTE:
     ```
     http://localhost:3001/callback
     ```
   - Crear → copia el **ID de cliente** y el **Secreto de cliente**.
3. Ponlos en el `.env`:
   ```env
   GOOGLE_CLIENT_ID=tu_client_id
   GOOGLE_CLIENT_SECRET=tu_client_secret
   ```

### 2. Sacar el refresh token (con el script)
En la carpeta del proyecto:
```powershell
npm run google-token
```
- Te imprime una URL → ábrela en el navegador → autoriza con tu cuenta.
- Google te redirige a `localhost:3001` y el script imprime tu token:
  ```
  GOOGLE_REFRESH_TOKEN=1//0g....
  ```
- Copia esa línea en el `.env`.

✅ Con esto Lumi ya puede **subir y crear** en tu Drive personal.

---

## ⚠️ Lo importante del OAuth: el caducado a los 7 días

Si tu app de Google está en modo **"Testing"** (lo normal), Google **invalida el
refresh token cada 7 días** → vuelve el `invalid_grant`. Opciones:

- **Más estable:** usa la **Service Account** para el día a día (no caduca) y deja
  el OAuth solo para cuando necesites subir. Si caduca, vuelves a correr
  `npm run google-token` (30 segundos).
- **Permanente:** en la pantalla de consentimiento, pasa la app a **"En producción"**
  (*Publicar app*). Ojo: el scope de Drive es "restringido" y Google puede pedir
  verificación; para uso personal suele bastar con publicarla y aceptar el aviso.

---

## 🔁 Reiniciar el bot tras configurar
```powershell
# Ctrl + C para detenerlo, y:
npm start
```
Prueba: `@Lumi haz un diagnóstico` → la línea de Google Drive debe decir **OK**.
