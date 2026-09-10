const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin, logIn, logOut } = require('../middleware/auth');
const { uploadLogo, uploadProductMedia, uploadSettings } = require('../middleware/upload');
const { saveBuffer, deleteFile } = require('../lib/storage');
const { slugify } = require('../utils/format');

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// ---------- Login ----------
router.get('/login', (req, res) => {
  if (req.signedCookies && req.signedCookies.admin_session) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (!user || !db.bcrypt.compareSync(password || '', user.password_hash)) {
      return res.render('admin/login', { error: 'Usuario o contraseña incorrectos.' });
    }
    logIn(res, user.id);
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  logOut(res);
  res.redirect('/admin/login');
});

router.use(requireAdmin);

// ---------- Dashboard ----------
router.get('/', async (req, res, next) => {
  try {
    const productCount = (await db.get('SELECT COUNT(*) c FROM products')).c;
    const categoryCount = (await db.get('SELECT COUNT(*) c FROM categories')).c;
    const orders = await db.all('SELECT * FROM orders ORDER BY id DESC LIMIT 8');
    const orderCount = (await db.get('SELECT COUNT(*) c FROM orders')).c;
    res.render('admin/dashboard', { productCount, categoryCount, orders, orderCount });
  } catch (err) {
    next(err);
  }
});

// ---------- Categorías ----------
router.get('/categorias', async (req, res, next) => {
  try {
    const categories = await db.all('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
    res.render('admin/categories', { categories });
  } catch (err) {
    next(err);
  }
});

router.post('/categorias', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (name && name.trim()) {
      const maxOrder = (await db.get('SELECT COALESCE(MAX(sort_order),0) m FROM categories')).m;
      let slug = slugify(name);
      let n = 1;
      while (await db.get('SELECT 1 FROM categories WHERE slug = ?', [slug])) {
        slug = `${slugify(name)}-${++n}`;
      }
      await db.run('INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)', [
        name.trim(),
        slug,
        maxOrder + 1,
      ]);
    }
    res.redirect('/admin/categorias');
  } catch (err) {
    next(err);
  }
});

router.post('/categorias/:id/eliminar', async (req, res, next) => {
  try {
    await db.run('UPDATE products SET category_id = NULL WHERE category_id = ?', [req.params.id]);
    await db.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.redirect('/admin/categorias');
  } catch (err) {
    next(err);
  }
});

router.post('/categorias/:id/mover', async (req, res, next) => {
  try {
    const { dir } = req.body; // 'up' | 'down'
    const cats = await db.all('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
    const idx = cats.findIndex((c) => String(c.id) === req.params.id);
    const swapWith = dir === 'up' ? idx - 1 : idx + 1;
    if (idx >= 0 && swapWith >= 0 && swapWith < cats.length) {
      const a = cats[idx];
      const b = cats[swapWith];
      await db.run('UPDATE categories SET sort_order = ? WHERE id = ?', [b.sort_order, a.id]);
      await db.run('UPDATE categories SET sort_order = ? WHERE id = ?', [a.sort_order, b.id]);
    }
    res.redirect('/admin/categorias');
  } catch (err) {
    next(err);
  }
});

// ---------- Productos ----------
router.get('/productos', async (req, res, next) => {
  try {
    const products = await db.all(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.id DESC`
    );
    res.render('admin/products', { products });
  } catch (err) {
    next(err);
  }
});

router.get('/productos/nuevo', async (req, res, next) => {
  try {
    const categories = await db.all('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
    res.render('admin/product-form', { product: null, images: [], categories, variants: [] });
  } catch (err) {
    next(err);
  }
});

router.get('/productos/:id/editar', async (req, res, next) => {
  try {
    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.redirect('/admin/productos');
    const categories = await db.all('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
    const images = await db.all(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
      [product.id]
    );
    const variants = await db.all(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
      [product.id]
    );
    res.render('admin/product-form', { product, images, categories, variants });
  } catch (err) {
    next(err);
  }
});

async function uniqueSlug(name, excludeId) {
  let slug = slugify(name);
  let n = 1;
  while (true) {
    const row = await db.get('SELECT id FROM products WHERE slug = ?', [slug]);
    if (!row || (excludeId && String(row.id) === String(excludeId))) break;
    slug = `${slugify(name)}-${++n}`;
  }
  return slug;
}

// Talles/colores: se reemplazan todos de una, en el orden en que llegaron del
// formulario (mismo enfoque simple que ya se usa en el resto del panel). Las
// filas con etiqueta vacía se descartan.
async function saveVariants(body, productId) {
  await db.run('DELETE FROM product_variants WHERE product_id = ?', [productId]);
  const labels = [].concat(body.variant_label || []);
  const stocks = [].concat(body.variant_stock || []);
  let order = 0;
  for (let i = 0; i < labels.length; i++) {
    const label = (labels[i] || '').toString().trim();
    if (!label) continue;
    const stock = Math.max(0, Number(stocks[i]) || 0);
    await db.run(
      'INSERT INTO product_variants (product_id, label, stock, sort_order) VALUES (?, ?, ?, ?)',
      [productId, label, stock, order++]
    );
  }
}

async function saveUploadedImages(files, productId) {
  if (!files || !files.length) return;
  const maxOrder = (
    await db.get('SELECT COALESCE(MAX(sort_order),-1) m FROM product_images WHERE product_id = ?', [
      productId,
    ])
  ).m;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const url = await saveBuffer(f.buffer, 'products', f.originalname, f.mimetype);
    await db.run('INSERT INTO product_images (product_id, path, sort_order) VALUES (?, ?, ?)', [
      productId,
      url,
      maxOrder + 1 + i,
    ]);
  }
}

router.post('/productos', uploadProductMedia, async (req, res, next) => {
  try {
    const b = req.body;
    const files = req.files || {};
    const slug = await uniqueSlug(b.name);
    const trackStock = b.track_stock ? 1 : 0;

    let videoUrl = b.video_url || '';
    if (files.video && files.video[0]) {
      videoUrl = await saveBuffer(files.video[0].buffer, 'videos', files.video[0].originalname, files.video[0].mimetype);
    }

    const info = await db.run(
      `INSERT INTO products (category_id, name, slug, description, price, promo_price, stock, track_stock, video_url, active, variants_enabled, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        b.category_id || null,
        b.name,
        slug,
        b.description || '',
        Number(b.price) || 0,
        b.promo_price ? Number(b.promo_price) : null,
        trackStock ? Number(b.stock) || 0 : null,
        trackStock,
        videoUrl,
        b.active ? 1 : 0,
        b.variants_enabled ? 1 : 0,
      ]
    );

    const productId = info.lastInsertRowid;
    await saveUploadedImages(files.images, productId);
    await saveVariants(b, productId);
    res.redirect(`/admin/productos/${productId}/editar`);
  } catch (err) {
    next(err);
  }
});

router.post('/productos/:id/editar', uploadProductMedia, async (req, res, next) => {
  try {
    const b = req.body;
    const files = req.files || {};
    const id = req.params.id;
    const existing = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return res.redirect('/admin/productos');

    const slug = b.name && b.name !== existing.name ? await uniqueSlug(b.name, id) : existing.slug;
    const trackStock = b.track_stock ? 1 : 0;

    let videoUrl = b.video_url || '';
    if (files.video && files.video[0]) {
      if (existing.video_url) await deleteFile(existing.video_url);
      videoUrl = await saveBuffer(files.video[0].buffer, 'videos', files.video[0].originalname, files.video[0].mimetype);
    }

    await db.run(
      `UPDATE products SET category_id=?, name=?, slug=?, description=?, price=?, promo_price=?, stock=?, track_stock=?, video_url=?, active=?, variants_enabled=? WHERE id=?`,
      [
        b.category_id || null,
        b.name,
        slug,
        b.description || '',
        Number(b.price) || 0,
        b.promo_price ? Number(b.promo_price) : null,
        trackStock ? Number(b.stock) || 0 : null,
        trackStock,
        videoUrl,
        b.active ? 1 : 0,
        b.variants_enabled ? 1 : 0,
        id,
      ]
    );

    await saveUploadedImages(files.images, id);
    await saveVariants(b, id);
    res.redirect(`/admin/productos/${id}/editar`);
  } catch (err) {
    next(err);
  }
});

router.post('/productos/:id/imagenes/:imageId/eliminar', async (req, res, next) => {
  try {
    const img = await db.get('SELECT * FROM product_images WHERE id = ?', [req.params.imageId]);
    if (img) {
      await deleteFile(img.path);
      await db.run('DELETE FROM product_images WHERE id = ?', [img.id]);
    }
    res.redirect(`/admin/productos/${req.params.id}/editar`);
  } catch (err) {
    next(err);
  }
});

router.post('/productos/:id/eliminar', async (req, res, next) => {
  try {
    const images = await db.all('SELECT * FROM product_images WHERE product_id = ?', [req.params.id]);
    for (const img of images) await deleteFile(img.path);
    const product = await db.get('SELECT video_url FROM products WHERE id = ?', [req.params.id]);
    if (product && product.video_url) await deleteFile(product.video_url);
    await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.redirect('/admin/productos');
  } catch (err) {
    next(err);
  }
});

// ---------- Entrega (couriers) ----------
router.get('/entrega', async (req, res, next) => {
  try {
    const settings = await db.getSettings();
    const couriers = await db.all('SELECT * FROM couriers ORDER BY sort_order ASC');
    res.render('admin/delivery', { settings, couriers });
  } catch (err) {
    next(err);
  }
});

router.post('/entrega/general', async (req, res, next) => {
  try {
    const b = req.body;
    await db.setSettings({
      free_delivery_zone: b.free_delivery_zone || '',
      delivery_note: b.delivery_note || '',
    });
    res.redirect('/admin/entrega');
  } catch (err) {
    next(err);
  }
});

router.post('/entrega/transportadoras', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (name && name.trim()) {
      const maxOrder = (await db.get('SELECT COALESCE(MAX(sort_order),0) m FROM couriers')).m;
      await db.run(
        'INSERT INTO couriers (name, note, cost, active, sort_order) VALUES (?, ?, 0, 1, ?)',
        [name.trim(), 'A cargo del comprador', maxOrder + 1]
      );
    }
    res.redirect('/admin/entrega');
  } catch (err) {
    next(err);
  }
});

router.post('/entrega/transportadoras/:id/eliminar', async (req, res, next) => {
  try {
    await db.run('DELETE FROM couriers WHERE id = ?', [req.params.id]);
    res.redirect('/admin/entrega');
  } catch (err) {
    next(err);
  }
});

router.post('/entrega/transportadoras/:id', async (req, res, next) => {
  try {
    const b = req.body;
    await db.run('UPDATE couriers SET name=?, note=?, cost=?, active=? WHERE id=?', [
      b.name,
      b.note || '',
      Number(b.cost) || 0,
      b.active ? 1 : 0,
      req.params.id,
    ]);
    res.redirect('/admin/entrega');
  } catch (err) {
    next(err);
  }
});

// ---------- Pagos ----------
router.get('/pagos', async (req, res, next) => {
  try {
    const settings = await db.getSettings();
    res.render('admin/payments', { settings });
  } catch (err) {
    next(err);
  }
});

router.post('/pagos', async (req, res, next) => {
  try {
    const b = req.body;
    await db.setSettings({
      cash_enabled: b.cash_enabled ? '1' : '0',
      transfer_enabled: b.transfer_enabled ? '1' : '0',
      card_enabled: b.card_enabled ? '1' : '0',
      mercadopago_enabled: b.mercadopago_enabled ? '1' : '0',
      mercadopago_surcharge_pct: b.mercadopago_surcharge_pct || '0',
      transfer_info: b.transfer_info || '',
    });
    res.redirect('/admin/pagos');
  } catch (err) {
    next(err);
  }
});

// ---------- Configuración de tienda ----------
router.get('/configuracion', async (req, res, next) => {
  try {
    const settings = await db.getSettings();
    res.render('admin/settings', { settings, error: null });
  } catch (err) {
    next(err);
  }
});

// Antes acá se usaba "uploadSettings" directo como middleware de la ruta. El
// problema: si la foto es muy pesada (más de 4MB) o no es una imagen, multer
// corta la subida con un error ANTES de que este handler llegue a ejecutarse,
// y ese error caía derecho en la pantalla genérica de "Ocurrió un error en el
// servidor" — sin decir qué pasó realmente. Envolviendo la llamada a mano
// podemos mostrar un mensaje claro y devolver a la persona a la misma
// pantalla con lo que ya tenía cargado, en vez de una pantalla de error.
router.post('/configuracion', (req, res, next) => {
  uploadSettings(req, res, async (uploadErr) => {
    if (uploadErr) {
      try {
        const settings = await db.getSettings();
        const msg =
          uploadErr.code === 'LIMIT_FILE_SIZE'
            ? 'La imagen es demasiado pesada (máximo 4MB). Probá con una foto más liviana, o sacale una captura de pantalla más chica y subí esa.'
            : uploadErr.message || 'No se pudo subir la imagen.';
        return res.status(400).render('admin/settings', { settings, error: msg });
      } catch (err) {
        return next(err);
      }
    }

    try {
      const b = req.body;
      const files = req.files || {};
      const update = {
        store_name: b.store_name || 'Mi tienda',
        store_tagline: b.store_tagline || '',
        whatsapp_number: (b.whatsapp_number || '').replace(/[^\d]/g, ''),
        store_address: b.store_address || '',
        primary_color: b.primary_color || '#c96f56',
        secondary_color: b.secondary_color || '#6b4530',
        bg_color: b.bg_color || '#fbf4ec',
        hero_title: b.hero_title || '',
        hero_subtitle: b.hero_subtitle || '',
        instagram_handle: b.instagram_handle || '',
        tiktok_handle: b.tiktok_handle || '',
      };
      if (files.logo && files.logo[0]) {
        update.logo_path = await saveBuffer(files.logo[0].buffer, 'logo', files.logo[0].originalname, files.logo[0].mimetype);
      }
      if (files.hero_image && files.hero_image[0]) {
        update.hero_image = await saveBuffer(
          files.hero_image[0].buffer,
          'hero',
          files.hero_image[0].originalname,
          files.hero_image[0].mimetype
        );
      }
      await db.setSettings(update);
      res.redirect('/admin/configuracion');
    } catch (err) {
      next(err);
    }
  });
});

// ---------- Pedidos ----------
router.get('/pedidos', async (req, res, next) => {
  try {
    const orders = await db.all('SELECT * FROM orders ORDER BY id DESC');
    res.render('admin/orders', { orders });
  } catch (err) {
    next(err);
  }
});

router.post('/pedidos/:id/estado', async (req, res, next) => {
  try {
    await db.run('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    res.redirect('/admin/pedidos');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
