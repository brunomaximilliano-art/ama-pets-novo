const multer = require('multer');

// Todo se guarda primero en memoria (buffer) y después src/lib/storage.js decide
// si va a disco local o a Vercel Blob. Esto permite correr tanto en hostings con
// disco persistente (Railway, Render, un VPS) como en Vercel (sin disco persistente).
const memory = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (/^image\//.test(file.mimetype)) cb(null, true);
  else cb(new Error('Solo se permiten archivos de imagen'));
};

const videoFilter = (req, file, cb) => {
  if (/^video\//.test(file.mimetype)) cb(null, true);
  else cb(new Error('Solo se permiten archivos de video'));
};

const uploadProductImages = multer({
  storage: memory,
  fileFilter: imageFilter,
  limits: { fileSize: 4 * 1024 * 1024, files: 8 }, // 4MB por foto: entra cómodo en el límite de subida de Vercel
});

const uploadLogo = multer({
  storage: memory,
  fileFilter: imageFilter,
  limits: { fileSize: 4 * 1024 * 1024 },
});

// Videos: límite chico a propósito. Vercel (y muchos hostings) rechazan
// solicitudes de más de ~4.5MB, así que para videos más largos lo mejor
// es pegar un link de YouTube en vez de subir el archivo.
const uploadVideo = multer({
  storage: memory,
  fileFilter: videoFilter,
  limits: { fileSize: 4 * 1024 * 1024 },
});

// Para el formulario de producto, que sube fotos (campo "images") y opcionalmente
// un video corto (campo "video") en el mismo envío.
const uploadProductMedia = multer({
  storage: memory,
  limits: { fileSize: 4 * 1024 * 1024, files: 9 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') return videoFilter(req, file, cb);
    return imageFilter(req, file, cb);
  },
}).fields([
  { name: 'images', maxCount: 8 },
  { name: 'video', maxCount: 1 },
]);

// Para el formulario de "Configuración de la tienda", que puede subir el logo
// y/o la foto de portada (hero) de la página de inicio en el mismo envío.
const uploadSettings = multer({
  storage: memory,
  fileFilter: imageFilter,
  limits: { fileSize: 4 * 1024 * 1024, files: 2 },
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'hero_image', maxCount: 1 },
]);

module.exports = {
  uploadProductImages,
  uploadLogo,
  uploadVideo,
  uploadProductMedia,
  uploadSettings,
};
