// Punto de entrada para correr el sitio como servidor tradicional: local,
// Railway, Render, un VPS, etc. (En Vercel se usa api/index.js en su lugar,
// que exporta la misma app de src/app.js sin llamar a .listen()).
const app = require('./src/app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AMA Pets corriendo en http://localhost:${PORT}`);
  console.log(`Panel administrativo en http://localhost:${PORT}/admin`);
});
