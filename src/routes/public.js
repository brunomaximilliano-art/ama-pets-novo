const express = require('express');
const router = express.Router();
const db = require('../db');

async function loadCommon() {
  const settings = await db.getSettings();
  const categories = await db.all('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
  return { settings, categories };
}

async function getImages(productId) {
  const rows = await db.all(
    'SELECT path FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
    [productId]
  );
  return rows.map((r) => r.path);
}

// Página de inicio: una sección por categoría, igual que el sitio de referencia
router.get('/', async (req, res, next) => {
  try {
    const { settings, categories } = await loadCommon();

    const sections = [];
    for (const cat of categories) {
      const total = (
        await db.get('SELECT COUNT(*) AS c FROM products WHERE category_id = ? AND active = 1', [
          cat.id,
        ])
      ).c;
      const rows = await db.all(
        `SELECT * FROM products WHERE category_id = ? AND active = 1
         ORDER BY sort_order ASC, id DESC LIMIT 8`,
        [cat.id]
      );
      const products = [];
      for (const p of rows) products.push({ ...p, images: await getImages(p.id) });
      if (products.length) sections.push({ category: cat, products, total });
    }

    res.render('index', { settings, categories, sections, activeCategory: null });
  } catch (err) {
    next(err);
  }
});

// Página de categoría: grilla completa de productos
router.get('/c/:slug', async (req, res, next) => {
  try {
    const { settings, categories } = await loadCommon();
    const cat = categories.find((c) => c.slug === req.params.slug);
    if (!cat) return res.status(404).render('404', { settings, categories });

    const rows = await db.all(
      `SELECT * FROM products WHERE category_id = ? AND active = 1
       ORDER BY sort_order ASC, id DESC`,
      [cat.id]
    );
    const products = [];
    for (const p of rows) products.push({ ...p, images: await getImages(p.id) });

    res.render('category', {
      settings,
      categories,
      category: cat,
      products,
      activeCategory: cat.slug,
    });
  } catch (err) {
    next(err);
  }
});

// Página de producto
router.get('/p/:slug', async (req, res, next) => {
  try {
    const { settings, categories } = await loadCommon();
    const product = await db.get('SELECT * FROM products WHERE slug = ? AND active = 1', [
      req.params.slug,
    ]);
    if (!product) return res.status(404).render('404', { settings, categories });

    const category = categories.find((c) => c.id === product.category_id);
    const images = await getImages(product.id);

    // Solo se le muestran al cliente las opciones que tienen stock disponible.
    let variants = [];
    if (product.variants_enabled) {
      variants = await db.all(
        'SELECT id, label, stock FROM product_variants WHERE product_id = ? AND stock > 0 ORDER BY sort_order ASC, id ASC',
        [product.id]
      );
    }

    res.render('product', {
      settings,
      categories,
      product,
      images,
      category,
      variants,
      activeCategory: category ? category.slug : null,
    });
  } catch (err) {
    next(err);
  }
});

// Buscador: busca por nombre en todos los productos activos de todas las
// categorías (no solo en la que se esté mirando).
router.get('/buscar', async (req, res, next) => {
  try {
    const { settings, categories } = await loadCommon();
    const q = (req.query.q || '').toString().trim();

    let products = [];
    if (q) {
      const rows = await db.all(
        `SELECT * FROM products WHERE active = 1 AND name LIKE ?
         ORDER BY sort_order ASC, id DESC`,
        [`%${q}%`]
      );
      for (const p of rows) products.push({ ...p, images: await getImages(p.id) });
    }

    res.render('search', {
      settings,
      categories,
      products,
      query: q,
      activeCategory: null,
    });
  } catch (err) {
    next(err);
  }
});

// Carrito (el contenido real lo arma el JS del cliente a partir de localStorage)
router.get('/carrito', async (req, res, next) => {
  try {
    const { settings, categories } = await loadCommon();
    const couriers = await db.all('SELECT * FROM couriers WHERE active = 1 ORDER BY sort_order ASC');
    res.render('cart', { settings, categories, couriers, activeCategory: null });
  } catch (err) {
    next(err);
  }
});

// Checkout (datos del cliente + método de pago)
router.get('/finalizar', async (req, res, next) => {
  try {
    const { settings, categories } = await loadCommon();
    res.render('checkout', { settings, categories, activeCategory: null });
  } catch (err) {
    next(err);
  }
});

router.get('/pedido-enviado', async (req, res, next) => {
  try {
    const { settings, categories } = await loadCommon();
    res.render('order-success', { settings, categories, activeCategory: null });
  } catch (err) {
    next(err);
  }
});

// Generador de imagen placeholder (SVG) para productos sin foto todavía.
router.get('/placeholder.svg', (req, res) => {
  const text = (req.query.text || 'AMA Pets').toString().slice(0, 40);
  const bg = '#f1e4d8';
  const fg = '#6b4530';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
    <rect width="480" height="480" fill="${bg}"/>
    <g fill="none" stroke="${fg}" stroke-width="6" opacity="0.5">
      <circle cx="240" cy="190" r="70"/>
      <circle cx="185" cy="120" r="26"/>
      <circle cx="295" cy="120" r="26"/>
      <circle cx="150" cy="175" r="22"/>
      <circle cx="330" cy="175" r="22"/>
    </g>
    <text x="240" y="330" font-family="Georgia, serif" font-size="24" fill="${fg}" text-anchor="middle">${escapeXml(
    text
  )}</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

function escapeXml(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

module.exports = router;
