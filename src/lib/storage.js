const fs = require('fs');
const path = require('path');

// Todo lo que el sitio necesita guardar de forma permanente (base de datos local
// y archivos subidos) vive bajo una única carpeta: STORAGE_DIR. Esto hace que en
// Railway/Render/un VPS solo haga falta un volumen/disco persistente (montado en
// esa carpeta) en vez de dos carpetas separadas.
//
// - Por defecto (sin configurar nada) es "storage/" en la raíz del proyecto: sirve
//   para correr en local sin pensar en esto.
// - En Railway/Render, configurá la variable STORAGE_DIR con la misma ruta donde
//   montaste el volumen (por ejemplo "/data") — ver el README.
// - En Vercel no se usa (ahí las fotos van a Vercel Blob, ver más abajo).
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, '..', '..', 'storage');
const UPLOAD_ROOT = path.join(STORAGE_DIR, 'uploads');

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

function safeFilename(originalName, mimetype) {
  let ext = path.extname(originalName || '').toLowerCase();
  if (!ext) ext = EXT_BY_MIME[mimetype] || '';
  const base =
    path
      .basename(originalName || 'archivo', path.extname(originalName || ''))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'archivo';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${base}${ext}`;
}

// Guarda un archivo (buffer en memoria, viene de multer memoryStorage) y devuelve
// la ruta/URL para guardar en la base de datos y usar directo en <img src="..."> o <video src="...">.
async function saveBuffer(buffer, folder, originalName, mimetype) {
  const filename = safeFilename(originalName, mimetype);

  if (useBlob) {
    const { put } = require('@vercel/blob');
    const pathname = `${folder}/${filename}`;
    // Los "Blob Store" que crea Vercel hoy en día son privados: para leer un
    // archivo hace falta mandar el token, así que un <img src="..."> apuntando
    // directo a Vercel Blob no funciona (el navegador no manda ese token).
    // Por eso acá guardamos "access: private" y devolvemos una ruta propia
    // del sitio (/media/...) que el servidor resuelve pidiéndole el archivo a
    // Vercel Blob con el token puesto, y se lo entrega al navegador como si
    // fuera un archivo cualquiera (ver la ruta GET /media/* en src/app.js).
    await put(pathname, buffer, {
      access: 'private',
      contentType: mimetype,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return `/media/${pathname}`;
  }

  const dir = path.join(UPLOAD_ROOT, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}

// Elimina un archivo guardado previamente (acepta una ruta local "/uploads/...",
// la ruta propia "/media/..." que usamos para los archivos en Vercel Blob, o
// (por compatibilidad con datos guardados antes de este cambio) una URL
// completa de Vercel Blob).
async function deleteFile(pathOrUrl) {
  if (!pathOrUrl) return;
  try {
    if (pathOrUrl.startsWith('/media/')) {
      if (useBlob) {
        const { del } = require('@vercel/blob');
        const pathname = pathOrUrl.replace(/^\/media\//, '');
        await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
      }
      return;
    }
    if (/^https?:\/\//.test(pathOrUrl)) {
      if (useBlob) {
        const { del } = require('@vercel/blob');
        await del(pathOrUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
      }
      return;
    }
    const filePath = path.join(UPLOAD_ROOT, pathOrUrl.replace(/^\/uploads\//, ''));
    fs.unlinkSync(filePath);
  } catch (e) {
    // Si el archivo ya no existe o no se puede borrar, no interrumpimos la operación.
  }
}

// Le pide a Vercel Blob el contenido de un archivo privado (usando el token) y
// lo manda tal cual a la respuesta HTTP, como si el archivo estuviera en
// nuestro propio servidor. Lo usa la ruta GET /media/* en src/app.js.
async function serveBlobFile(pathname, res) {
  const { get } = require('@vercel/blob');
  const result = await get(pathname, {
    access: 'private',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  if (!result || !result.stream) {
    res.status(404).send('Archivo no encontrado');
    return;
  }
  res.setHeader('Content-Type', (result.blob && result.blob.contentType) || 'application/octet-stream');
  // El nombre de archivo incluye fecha + un código al azar (ver safeFilename),
  // así que nunca se reutiliza el mismo nombre para un contenido distinto: se
  // puede cachear "para siempre" sin miedo a mostrar una versión vieja.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  const { Readable } = require('stream');
  Readable.fromWeb(result.stream).pipe(res);
}

module.exports = { saveBuffer, deleteFile, serveBlobFile, useBlob, STORAGE_DIR, UPLOAD_ROOT };
