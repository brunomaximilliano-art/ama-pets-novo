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
    const result = await put(`${folder}/${filename}`, buffer, {
      access: 'public',
      contentType: mimetype,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return result.url;
  }

  const dir = path.join(UPLOAD_ROOT, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}

// Elimina un archivo guardado previamente (acepta tanto una ruta local "/uploads/..."
// como una URL completa de Vercel Blob).
async function deleteFile(pathOrUrl) {
  if (!pathOrUrl) return;
  try {
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

module.exports = { saveBuffer, deleteFile, useBlob, STORAGE_DIR, UPLOAD_ROOT };
