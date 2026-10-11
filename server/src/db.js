// The ONLY file that talks to the database (SQLite today, could be Cloud SQL later).
const Database = require('better-sqlite3');
const config = require('./config');

const db = new Database(config.dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, name TEXT, brand TEXT, category TEXT,
  price REAL, stock INTEGER, description TEXT)`);

// Seed 60 sample electronics products the first time.
if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n === 0) {
  const catalog = {
    Phones: ['Nova X1', 'Nova X2', 'Pixelon 5', 'Pixelon 6', 'Zenith S', 'Zenith Pro', 'Orbit 9', 'Orbit Lite', 'Vega A3', 'Vega A5', 'Lumo 12', 'Lumo Max'],
    Laptops: ['AeroBook 14', 'AeroBook 16', 'Titan G15', 'Titan G17', 'SlimPad Air', 'SlimPad Pro', 'WorkMate 13', 'WorkMate 15', 'Forge Z', 'Forge ZX', 'Nimbus 14', 'Nimbus 16'],
    Audio: ['BassPods', 'BassPods Pro', 'StudioCans', 'StudioCans X', 'Echo Mini', 'Echo Max', 'SoundBar 2', 'SoundBar 5', 'TuneBuds', 'TuneBuds 2', 'Pulse Speaker', 'Pulse XL'],
    Wearables: ['FitBand 3', 'FitBand 5', 'ChronoWatch', 'ChronoWatch S', 'Trek GPS', 'Trek GPS 2', 'PulseRing', 'PulseRing 2', 'SleepTrack', 'SleepTrack+', 'KidWatch', 'SportWatch'],
    Accessories: ['USB-C Hub 7-in-1', 'Wireless Mouse', 'Mech Keyboard', 'Laptop Stand', 'Webcam 1080p', 'Power Bank 20k', 'Fast Charger 65W', 'HDMI Cable 2m', 'Phone Case', 'Screen Guard', 'Desk Mat', 'Cable Organizer'],
  };
  const insert = db.prepare('INSERT INTO products (name, brand, category, price, stock, description) VALUES (?,?,?,?,?,?)');
  let i = 0;
  db.transaction(() => {
    for (const [category, names] of Object.entries(catalog)) {
      for (const name of names) {
        i++;
        const price = 499 + ((i * 1373) % 79500);
        insert.run(name, name.split(' ')[0], category, price, 5 + ((i * 7) % 90), `${name}: a popular ${category.toLowerCase()} pick in our catalogue.`);
      }
    }
  })();
}

const stats = { queries: 0 };
// Simulated network/disk latency of a remote database. Disclose this in the viva.
const delay = () => new Promise((r) => setTimeout(r, config.dbDelayMs));

module.exports = {
  stats,
  async getProduct(id) {
    stats.queries++; await delay();
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id) || null;
  },
  async listProducts(q = '', category = '') {
    stats.queries++; await delay();
    return db.prepare(`SELECT * FROM products
      WHERE (name LIKE ? OR brand LIKE ?) AND (? = '' OR category = ?) ORDER BY id`)
      .all(`%${q}%`, `%${q}%`, category, category);
  },
  async updatePrice(id, price) {
    stats.queries++; await delay();
    db.prepare('UPDATE products SET price = ? WHERE id = ?').run(price, id);
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id) || null;
  },
};
