const express = require('express');
const router = express.Router();
const db = require('../db');
const { buildOrderMessage, whatsappLink } = require('../utils/whatsapp');

// Todos los productos activos, con imágenes, para que el carrito (cliente) pueda
// calcular precios/totales sin recargar la página.
router.get('/products', async (req, res, next) => {
  try {
    const products = await db.all(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.active = 1
       ORDER BY p.sort_order ASC, p.id DESC`
    );

    const out = [];
    for (const p of products) {
      const images = await db.all(
        'SELECT path FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
        [p.id]
      );
      out.push({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        promo_price: p.promo_price,
        stock: p.track_stock ? p.stock : null,
        track_stock: !!p.track_stock,
        category: p.category_name,
        categorySlug: p.category_slug,
        images: images.map((r) => r.path),
      });
    }

    res.json(out);
  } catch (err) {
    next(err);
  }
});

router.get('/couriers', async (req, res, next) => {
  try {
    const rows = await db.all(
      'SELECT id, name, note, cost FROM couriers WHERE active = 1 ORDER BY sort_order ASC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/orders', express.json(), async (req, res, next) => {
  try {
    const settings = await db.getSettings();
    const {
      items = [],
      deliveryMethod,
      courierName,
      address,
      paymentMethod,
      cashAmount,
      customerName,
      phone,
      observation,
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío.' });
    }
    if (!customerName || !phone) {
      return res.status(400).json({ error: 'Faltan datos del cliente.' });
    }

    let total = items.reduce((sum, it) => sum + Number(it.price) * Number(it.qty), 0);
    if (paymentMethod === 'mercadopago') {
      const pct = Number(settings.mercadopago_surcharge_pct || 0);
      if (pct > 0) total = total * (1 + pct / 100);
    }

    const info = await db.run(
      `INSERT INTO orders (customer_name, phone, address, delivery_method, courier_name, payment_method, observation, items_json, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerName,
        phone,
        address || '',
        deliveryMethod,
        courierName || '',
        paymentMethod,
        observation || '',
        JSON.stringify(items),
        total,
      ]
    );

    const message = buildOrderMessage({
      items,
      deliveryMethod,
      courierName,
      address,
      paymentMethod,
      cashAmount: Number(cashAmount) || 0,
      customerName,
      phone,
      observation,
      total,
      storeName: settings.store_name || 'la tienda',
    });

    const link = whatsappLink(settings.whatsapp_number, message);

    res.json({ ok: true, orderId: info.lastInsertRowid, whatsappUrl: link, total });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
