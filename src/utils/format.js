// Formatea números como moneda estilo "$ 1.234,00" (punto para miles, coma para decimales)
function money(n) {
  const num = Number(n) || 0;
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${parts[0]},${parts[1]}`;
}

// Ícono (imagen personalizada) + color de respaldo para los botones de
// categoría de la portada, la gaveta lateral y el menú fijo de escritorio,
// según palabras clave en el nombre de la categoría. Como las categorías las
// crea la tienda desde el panel administrativo (no son un listado fijo),
// esto permite que se vean "personalizadas" sin tener que agregar un campo
// extra de ícono a cada categoría.
const CATEGORY_ICONS = [
  {
    match: /aliment|comida|raci[oó]n|nutrici/i,
    emoji: '🍖',
    color: '#f4a261',
    image: '/img/icons/category-alimentacion.png',
  },
  {
    match: /higien|cuidado|limpieza|shampoo|ba[nñ]o/i,
    emoji: '🧼',
    color: '#8ecae6',
    image: '/img/icons/category-higiene.png',
  },
  {
    match: /accesor|collar|correa|ropa|indumentaria/i,
    emoji: '🎀',
    color: '#ffb4a2',
    image: '/img/icons/category-accesorios.png',
  },
  { match: /juguet/i, emoji: '🎾', color: '#b5e48c', image: '/img/icons/category-juguetes.png' },
  {
    match: /hogar|casa|cucha|cama|transport/i,
    emoji: '🏠',
    color: '#cdb4db',
    image: '/img/icons/category-hogar.png',
  },
  { match: /gato|felino/i, emoji: '🐱', color: '#e9c46a', image: '/img/icons/category-y-mas.png' },
  { match: /perr|canino/i, emoji: '🐶', color: '#f6bd60', image: '/img/icons/category-y-mas.png' },
];

const DEFAULT_CATEGORY_ICON = { emoji: '🐾', color: '#e0c097', image: '/img/icons/category-y-mas.png' };

function categoryIcon(name) {
  const found = CATEGORY_ICONS.find((c) => c.match.test(String(name || '')));
  return found || DEFAULT_CATEGORY_ICON;
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
