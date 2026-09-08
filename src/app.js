require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { seed } = require('./seed');
const { UPLOAD_ROOT } = require('./lib/storage');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.locals.money = require('./utils/format').money;

// Archivos del proyecto (CSS, JS del carrito) + archivos subidos por el panel
// administrativo (fotos, videos, logo), que viven en una carpeta separada
// (STORAGE_DIR/uploads) para poder montar ahí un único volumen persistente.
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(UPLOAD_ROOT));
app.use(cookieParser(process.env.COOKIE_SECRET || 'dev-secret-cambiar'));

// Se asegura de que la base esté sembrada con los datos iniciales antes de
// atender cualquier request. En un servidor tradicional esto pasa una sola vez
// al arrancar; en un entorno serverless (Vercel) puede volver a chequearse en
// cada arranque en frío, pero seed() no repite trabajo si ya está todo cargado.
app.use(async (req, res, next) => {
  try {
    await seed();
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);
app.use('/', publicRoutes);

app.use((req, res) => {
  res.status(404).send('Página no encontrada');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Ocurrió un error en el servidor. Revisá los logs para más detalles.');
});

module.exports = app;
