// Formatea números como moneda estilo "$ 1.234,00" (punto para miles, coma para decimales)
function money(n) {
  const num = Number(n) || 0;
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${parts[0]},${parts[1]}`;
}

// Ícono + color decorativos para los botones de categoría de la portada y del
// menú lateral, según palabras clave en el nombre de la categoría. Como las
// categorías las crea la tienda desde el panel administrativo (no son un
// listado fijo), esto permite que se vean "personalizadas" sin tener que
// agregar un campo extra de ícono a cada categoría.
const CATEGORY_ICONS = [
  { match: /aliment|comida|raci[oó]n|nutrici/i, emoji: '🍖', color: '#f4a261' },
  { match: /higien|cuidado|limpieza|shampoo|ba[nñ]o/i, emoji: '🧼', color: '#8ecae6' },
  { match: /accesor|collar|correa|ropa|indumentaria/i, emoji: '🎀', color: '#ffb4a2' },
  { match: /juguet/i, emoji: '🎾', color: '#b5e48c' },
  { match: /hogar|casa|cucha|cama|transport/i, emoji: '🏠', color: '#cdb4db' },
  { match: /gato|felino/i, emoji: '🐱', color: '#e9c46a' },
  { match: /perr|canino/i, emoji: '🐶', color: '#f6bd60' },
];

function categoryIcon(name) {
  const found = CATEGORY_ICONS.find((c) => c.match.test(String(name || '')));
  return found ? { emoji: found.emoji, color: found.color } : { emoji: '🐾', color: '#e0c097' };
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

module.exports = { money, slugify, categoryIcon };
