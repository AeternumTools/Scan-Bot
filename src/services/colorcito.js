// src/services/colorcito.js
// Cliente para la API REST de Colorcito (api.colorcitoscan.com)
// El sitio migró de WordPress a Next.js — se usa la API interna en vez de scraping HTML.

const axios  = require('axios');
const logger = require('../utils/logger');

const API_BASE  = 'https://api.colorcitoscan.com';
const SITE_BASE = process.env.COLORCITO_BASE_URL || 'https://colorcitoscan.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Accept':     'application/json',
  'Origin':     SITE_BASE,
  'Referer':    SITE_BASE + '/',
};

// Extrae el slug del URL del proyecto.
// Soporta formatos antiguos (/manga/[slug]) y nuevos (/ver/[slug])
// y también slugs directos (sin barra inicial).
function extractSlug(url) {
  if (!url) return null;
  const m = url.match(/\/(?:manga|ver|serie)\/([^\/\?\s]+)/);
  if (m) return m[1].replace(/\/$/, '');
  // Si no tiene prefijo conocido, tomar el último segmento del path
  try {
    const path = new URL(url).pathname.replace(/\/$/, '');
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

/**
 * Obtiene el capítulo más reciente de un proyecto.
 * @param {string} projectUrl  URL del manga en Colorcito (cualquier formato)
 * @returns {{ chapterNum, chapterTitle, chapterUrl, thumbnail, projectName } | null}
 */
async function getLatestChapter(projectUrl) {
  const slug = extractSlug(projectUrl);
  if (!slug) {
    logger.warn('Colorcito', `No se pudo extraer slug de: ${projectUrl}`);
    return null;
  }

  try {
    const { data } = await axios.get(`${API_BASE}/serie/${slug}`, {
      headers: HEADERS,
      timeout: 15_000,
    });

    const serie    = data?.serie;
    const chapters = serie?.chapters;
    if (!serie || !chapters?.length) {
      logger.warn('Colorcito', `Sin capítulos para slug: ${slug}`);
      return null;
    }

    // chapters viene ordenado descendente (mayor num = más reciente primero)
    const latest = chapters.reduce((max, c) => c.num > max.num ? c : max, chapters[0]);

    return {
      projectName:  serie.name,
      thumbnail:    serie.urlImg || null,
      chapterNum:   String(latest.num),
      chapterTitle: latest.name || null,
      chapterUrl:   `${SITE_BASE}/ver/${slug}/${latest.slug}`,
      source:       'colorcito',
    };

  } catch (err) {
    logger.error('Colorcito', `Error en "${slug}": ${err.message}`);
    return null;
  }
}

/**
 * Búsqueda por nombre en Colorcito.
 * Si el endpoint oficial de búsqueda no está disponible, intenta
 * resolver el slug directamente y devuelve el resultado como lista.
 */
async function searchManga(query) {
  if (!query?.trim()) return [];

  // Intento 1: slug normalizado (reemplaza espacios y tildes comunes)
  const slug = query.trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  try {
    const { data } = await axios.get(`${API_BASE}/serie/${slug}`, {
      headers: HEADERS,
      timeout: 10_000,
    });
    if (data?.serie) {
      const s = data.serie;
      return [{
        name:      s.name,
        url:       `${SITE_BASE}/ver/${s.slug}`,
        thumbnail: s.urlImg || null,
        slug:      s.slug,
      }];
    }
  } catch { /* slug no coincidió exactamente */ }

  // Si no encontró nada, retorna vacío.
  // El endpoint REST de búsqueda libre aún no fue identificado.
  logger.warn('Colorcito', `searchManga sin resultados para: "${query}"`);
  return [];
}

module.exports = { getLatestChapter, searchManga };
