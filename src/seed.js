// Puebla la base de datos con los datos iniciales de AMA Pets.
// Se ejecuta automáticamente al iniciar el servidor (o en el primer request en
// hostings serverless), y solo escribe lo que todavía no exista: no borra ni
// pisa datos ya cargados.
require('dotenv').config();
const { all, get, run, getSetting, setSetting, setSettings, bcrypt } = require('./db');
const { slugify } = require('./utils/format');

const DEFAULT_SETTINGS = {
  store_name: 'AMA Pets',
  store_tagline: 'Artículos para mascotas',
  whatsapp_number: '59898017328',
  primary_color: '#c96f56', // coral del logo
  secondary_color: '#6b4530', // marrón del logo
  bg_color: '#fbf4ec', // crema del logo
  // Vive en public/, no en storage/uploads/: así el logo siempre está disponible
  // apenas se publica el sitio, sin depender de disco persistente ni de Vercel Blob.
  logo_path: '/img/logo-default.jpg',
  country_code: '+598',

  free_delivery_zone: 'Rivera',
  delivery_note:
    'Los envíos dentro de Rivera son gratis. Los envíos al resto del país quedan a cargo del comprador y se pagan al recibir la encomienda.',
  pickup_enabled: '1',
  pickup_note: 'Retirás tu pedido en nuestro local (a coordinar por WhatsApp).',
  pickup_days: '3 días',

  cash_enabled: '1',
  transfer_enabled: '1',
  card_enabled: '0',
  mercadopago_enabled: '1',
  mercadopago_surcharge_pct: '0',
  transfer_info:
    'Banco: (completar en el panel administrativo)\nCuenta / Alias: (completar en el panel administrativo)\nTitular: AMA Pets',
};

let seeded = false;

async function seed() {
  if (seeded) return; // evita repetir el trabajo en la misma instancia del servidor
  seeded = true;

  // Settings: solo completar las que falten
  const toSet = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(await getSetting(k))) toSet[k] = v;
  }
  if (Object.keys(toSet).length) await setSettings(toSet);

  // Corrige sitios que ya se sembraron con una versión anterior que guardaba el
  // logo por defecto en storage/uploads/ (ruta que no persiste en Vercel sin
  // Blob configurado, y por eso el logo no se veía).
  const currentLogo = await getSetting('logo_path');
  if (currentLogo === '/uploads/logo/logo.jpg') {
    await setSetting('logo_path', DEFAULT_SETTINGS.logo_path);
  }

  // Admin user
  const adminCount = (await get('SELECT COUNT(*) AS c FROM admin_users')).c;
  if (adminCount === 0) {
    const username = process.env.ADMIN_USER || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'cambiar123';
    const hash = bcrypt.hashSync(password, 10);
    await run('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', [
      username,
      hash,
    ]);
    console.log(`[seed] Usuario administrador creado: ${username} / ${password}`);
    console.log('[seed] IMPORTANTE: cambiá esta contraseña en producción (ver .env)');
  }

  // Couriers
  const courierCount = (await get('SELECT COUNT(*) AS c FROM couriers')).c;
  if (courierCount === 0) {
    await run(
      'INSERT INTO couriers (name, note, cost, active, sort_order) VALUES (?, ?, 0, 1, ?)',
      ['Turil Cargo', 'A cargo del comprador', 1]
    );
    await run(
      'INSERT INTO couriers (name, note, cost, active, sort_order) VALUES (?, ?, 0, 1, ?)',
      ['DAC', 'A cargo del comprador', 2]
    );
  }

  // Categories + products (solo si la tienda está vacía)
  const catCount = (await get('SELECT COUNT(*) AS c FROM categories')).c;
  if (catCount === 0) {
    const cats = ['Alimentos', 'Higiene y Cuidado', 'Accesorios', 'Juguetes'];
    const catIds = {};
    for (let i = 0; i < cats.length; i++) {
      const info = await run('INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)', [
        cats[i],
        slugify(cats[i]),
        i,
      ]);
      catIds[cats[i]] = info.lastInsertRowid;
    }

    const sample = [
      {
        cat: 'Alimentos',
        name: 'Ración Premium Perros Adultos 15kg',
        desc: 'Alimento balanceado premium para perros adultos de todas las razas. Fórmula completa con proteínas de alta calidad, ideal para el día a día de tu mascota.',
        price: 2490,
        promo: null,
        stock: 10,
      },
      {
        cat: 'Alimentos',
        name: 'Alimento Gatos Adultos Sabor Salmón 3kg',
        desc: 'Alimento completo para gatos adultos con salmón, cuidando el pelaje y la salud urinaria.',
        price: 1290,
        promo: 1090,
        stock: 15,
      },
      {
        cat: 'Higiene y Cuidado',
        name: 'Shampoo Antipulgas 500ml',
        desc: 'Shampoo especial antipulgas y garrapatas, apto para perros y gatos. Deja el pelaje suave y perfumado.',
        price: 590,
        promo: null,
        stock: 20,
      },
      {
        cat: 'Higiene y Cuidado',
        name: 'Cepillo Removedor de Pelos',
        desc: 'Cepillo ergonómico para remover pelo muerto, reduce la caída y mejora el brillo del pelaje.',
        price: 450,
        promo: null,
        stock: 12,
      },
      {
        cat: 'Accesorios',
        name: 'Collar Ajustable Talle Único',
        desc: 'Collar resistente y ajustable, disponible para perros pequeños, medianos y grandes.',
        price: 380,
        promo: null,
        stock: 25,
      },
      {
        cat: 'Accesorios',
        name: 'Cucha Impermeable Mediana',
        desc: 'Cucha resistente al agua, cómoda y fácil de limpiar. Ideal para exterior o interior.',
        price: 2190,
        promo: 1890,
        stock: 6,
      },
      {
        cat: 'Juguetes',
        name: 'Pelota de Goma Resistente',
        desc: 'Pelota de goma resistente a mordidas, ideal para juegos de buscar y traer.',
        price: 250,
        promo: null,
        stock: 30,
      },
      {
        cat: 'Juguetes',
        name: 'Ratón de Peluche con Catnip',
        desc: 'Juguete de peluche relleno con catnip para estimular el juego de tu gato.',
        price: 190,
        promo: null,
        stock: 18,
      },
    ];

    for (let i = 0; i < sample.length; i++) {
      const p = sample[i];
      await run(
        `INSERT INTO products (category_id, name, slug, description, price, promo_price, stock, track_stock, active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [catIds[p.cat], p.name, slugify(p.name) + '-' + (i + 1), p.desc, p.price, p.promo, p.stock, 1, i]
      );
    }

    console.log('[seed] Categorías y productos de ejemplo creados (editables en /admin).');
  }
}

module.exports = { seed };

if (require.main === module) {
  seed().then(() => console.log('[seed] Listo.'));
}
