# 🛠️ Guía de desarrollo de Lumi (multi-PC)

Cómo trabajar el bot desde varias máquinas sin volverte loco.

---

## 🌐 Cómo viaja el código

```
Editas (casa / trabajo / con Claude)  ──git push──►  GitHub  ──git pull──►  PC que aloja el bot
```

El código vive en **GitHub**. Cualquier PC que corra `npm run auto` se actualiza
solo cuando hay commits nuevos (pull + reinicio automático en <60s).

---

## ⚠️ Regla de oro: SOLO UNA Lumi encendida a la vez

El bot se identifica con el `DISCORD_TOKEN`. Si lo corres en **dos PCs a la vez
con el mismo token**, tendrás respuestas y anuncios **duplicados**.

| Escenario | ¿OK? |
|---|---|
| Encendido en el trabajo, apagado en casa | ✅ |
| Encendido en casa, apagado en el trabajo | ✅ |
| Encendido en ambos a la vez | ❌ duplicados |

Las dos máquinas pueden tener el código listo, pero **enciende solo una**.
Para mover el "en vivo": **apaga una, enciende la otra**.

---

## 📦 Lo que NO viaja por git (config por máquina)

`.env` y `data/` están en `.gitignore` → **no se copian solos**. Cada PC necesita
su propio `.env` + `config/google-credentials.json`.

Para clonar la config de una máquina a otra:
```bash
npm run backup     # en el PC ya configurado → genera lumi-backup-FECHA.zip
npm run restore    # en el PC nuevo → lo deja igualito
```

---

## ▶️ Cómo arrancar el bot

```bash
npm run auto       # supervisor: auto-pull + auto-reinicio (recomendado)
# o
npm start          # arranque simple, sin auto-actualización
```

### Mantenerlo vivo
El bot corre dentro de la terminal donde lo lanzas. Si cierras esa terminal,
se apaga. Opciones:
- **Ventana de PowerShell aparte** (no la de VS Code): así cierras el editor y el
  bot sigue mientras esa ventana esté abierta.
- **pm2** (segundo plano, sin ventana):
  ```bash
  npm install pm2
  npx pm2 start scripts/auto-update.js --name lumi
  ```
- Si apagas o suspendes el PC, el bot se apaga.

---

## 🔧 Scripts útiles

| Comando | Qué hace |
|---|---|
| `npm run auto` | Bot + auto-actualización desde GitHub |
| `npm start` | Bot a secas |
| `npm run deploy` | Registra los comandos slash en Discord (solo si cambian) |
| `npm run backup` / `npm run restore` | Mover `.env` + `data` + credenciales entre PCs |
| `npm run google-token` | Generar el `GOOGLE_REFRESH_TOKEN` de OAuth (subidas a Drive) |

---

## 📚 Otras guías

- **`GUIA-LOCAL.md`** — instalar y correr el bot sin admin (Windows)
- **`GUIA-DRIVE.md`** — conectar Google Drive (Service Account + OAuth)
