const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

// Base de datos SQLite compatible con dos modos, sin cambiar el código de las rutas:
//
// - Local / Railway / Render (con disco persistente): si no hay variables TURSO_*
//   configuradas, se usa un archivo local dentro de STORAGE_DIR (ver src/lib/storage.js;
//   por defecto "storage/store.db" en la raíz del proyecto).
// - Vercel (sin disco persistente): configurá TURSO_DATABASE_URL y TURSO_AUTH_TOKEN
//   apuntando a una base de datos Turso (gratis, https://turso.tech) y todo se guarda ahí.
const usingTurso = !!process.env.TURSO_DATABASE_URL;
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, '..', 'storage');

if (!usingTurso && !fs.existsSync(STORAGE_DIR)) {
  try {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  } catch (e) {
    // En hostings de solo lectura (como Vercel) esto no debería pasar porque ahí
    // se configura TURSO_DATABASE_URL, pero por las dudas no interrumpimos el arranque.
  }
}

const url = process.env.TURSO_DATABASE_URL || `file:${path.join(STORAGE_DIR, 'store.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  promo_price REAL,
  stock INTEGER,
  track_stock INTEGER NOT NULL DEFAULT 0,
  video_url TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS couriers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  note TEXT DEFAULT 'A cargo del comprador',
  cost REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT,
  phone TEXT,
  address TEXT,
  delivery_method TEXT,
  courier_name TEXT,
  payment_method TEXT,
  observation TEXT,
  items_json TEXT,
  total REAL,
  status TEXT NOT NULL DEFAULT 'nuevo',
  created_at TEXT DEFAULT (datetime('now'))
);
`;

let readyPromise = null;
function ready() {
  if (!readyPromise) readyPromise = client.executeMultiple(SCHEMA);
  return readyPromise;
}

// Convierte bigint (lastInsertRowid, y algunos valores numéricos grandes) a Number
// para que se puedan usar en cálculos y en JSON.stringify sin explotar.
function normalizeRow(row) {
  if (!row) return row;
  const out = {};
  for (const key of Object.keys(row)) {
    const v = row[key];
    out[key] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}

async function all(sql, args = []) {
  await ready();
  const rs = await client.execute({ sql, args });
  return rs.rows.map(normalizeRow);
}

async function get(sql, args = []) {
  const rows = await all(sql, args);
  return rows[0];
}

async function run(sql, args = []) {
  await ready();
  const rs = await client.execute({ sql, args });
  return {
    lastInsertRowid: rs.lastInsertRowid != null ? Number(rs.lastInsertRowid) : undefined,
    rowsAffected: rs.rowsAffected,
  };
}

async function getSetting(key, fallback = '') {
  const row = await get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : fallback;
}

async function getSettings() {
  const rows = await all('SELECT key, value FROM settings');
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

async function setSetting(key, value) {
  await run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value == null ? '' : String(value)]
  );
}

async function setSettings(obj) {
  for (const [k, v] of Object.entries(obj)) {
    await setSetting(k, v);
  }
}

module.exports = {
  ready,
  all,
  get,
  run,
  getSetting,
  getSettings,
  setSetting,
  setSettings,
  bcrypt,
  usingTurso,
};
