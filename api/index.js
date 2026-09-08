// Punto de entrada para Vercel: exporta la app de Express directamente,
// sin llamar a .listen() (Vercel se encarga de eso). vercel.json enruta
// todas las requests hacia acá.
module.exports = require('../src/app');
