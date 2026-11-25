// Database schema + automatic migrations.
//
// There is nothing to run by hand: the first request after a deploy checks the
// `schema_migrations` table and applies whatever is missing. To change the
// schema later, append a new entry to MIGRATIONS (never edit an old one).
// Add-ons contribute their own migrations through their `migrations` field.

const SAMPLE_CATEGORIES = [
  ['bag-charms', 'Bag charms', 'Larger pieces that clip onto a handle or strap.', 1],
  ['keyrings', 'Keyrings', 'Small pieces on a brass split ring.', 2],
];

// [slug, name, category slug, price, colour, material, description, details, availability, featured, image]
const SAMPLE_PRODUCTS = [
  ['cherry-charm-in-cotton', 'Cherry charm in cotton', 'bag-charms', 48, 'Red/Green', 'Mercerised cotton',
    'A pair of cherries on twisted stems, crocheted in tight single stitches so they keep their shape.',
    'Height 11 cm including clasp\nMercerised cotton, recycled fibre filling\nSolid brass lobster clasp and ring\nMade by hand', 'in_stock', 1, 'cherry'],
  ['daisy-charm-in-merino-wool', 'Daisy charm in merino wool', 'bag-charms', 42, 'Ivory/Yellow', 'Merino wool',
    'Eight soft petals around a raised centre. Light enough for a small bag or a set of keys.',
    'Height 10 cm including clasp\nMerino wool\nSolid brass lobster clasp and ring\nMade by hand', 'in_stock', 1, 'daisy'],
  ['strawberry-charm-in-cotton', 'Strawberry charm in cotton', 'bag-charms', 46, 'Red/Green', 'Mercerised cotton',
    'A plump strawberry with hand-embroidered seeds and a five-point leaf cap.',
    'Height 11 cm including clasp\nMercerised cotton, recycled fibre filling\nSolid brass lobster clasp and ring\nMade by hand', 'in_stock', 1, 'strawberry'],
  ['tulip-charm-in-cotton', 'Tulip charm in cotton', 'bag-charms', 52, 'Pink/Green', 'Mercerised cotton',
    'A single tulip with two leaves, worked in the round and finished with a wired stem.',
    'Height 13 cm including clasp\nMercerised cotton\nSolid brass lobster clasp and ring\nMade by hand', 'in_stock', 1, 'tulip'],
  ['lemon-charm-in-cotton', 'Lemon charm in cotton', 'bag-charms', 44, 'Yellow/Green', 'Mercerised cotton',
    'A bright lemon with a single leaf, firm to the touch and easy to spot at the bottom of a bag.',
    'Height 11 cm including clasp\nMercerised cotton, recycled fibre filling\nSolid brass lobster clasp and ring\nMade by hand', 'sold_out', 0, 'lemon'],
  ['mushroom-charm-in-merino-wool', 'Mushroom charm in merino wool', 'bag-charms', 54, 'Red/Cream', 'Merino wool',
    'A spotted cap on a short cream stem, with the spots stitched on one at a time.',
    'Height 11 cm including clasp\nMerino wool, recycled fibre filling\nSolid brass lobster clasp and ring\nMade by hand', 'in_stock', 1, 'mushroom'],
  ['clover-charm-in-cotton', 'Clover charm in cotton', 'bag-charms', 40, 'Green', 'Mercerised cotton',
    'Four leaves and a curved stem. Makes a good gift before an exam or a first day.',
    'Height 11 cm including clasp\nMercerised cotton\nSolid brass lobster clasp and ring\nMade by hand', 'in_stock', 0, 'clover'],
  ['heart-keyring-in-cotton', 'Heart keyring in cotton', 'keyrings', 32, 'Rose', 'Mercerised cotton',
    'A padded heart on a brass ring, small enough to sit flat in a pocket.',
    'Height 9 cm including ring\nMercerised cotton, recycled fibre filling\nSolid brass split ring\nMade by hand', 'in_stock', 1, 'heart'],
  ['star-keyring-in-cotton', 'Star keyring in cotton', 'keyrings', 32, 'Mustard', 'Mercerised cotton',
    'A five-point star with softly rounded tips, stitched in a warm mustard yellow.',
    'Height 9 cm including ring\nMercerised cotton, recycled fibre filling\nSolid brass split ring\nMade by hand', 'in_stock', 1, 'star'],
  ['fish-keyring-in-cotton', 'Fish keyring in cotton', 'keyrings', 36, 'Blue', 'Mercerised cotton',
    'A little blue fish with a stitched eye and a split tail.',
    'Length 9 cm\nMercerised cotton, recycled fibre filling\nSolid brass split ring\nMade by hand', 'in_stock', 1, 'fish'],
  ['pear-keyring-in-merino-wool', 'Pear keyring in merino wool', 'keyrings', 34, 'Green', 'Merino wool',
    'A soft green pear with a single leaf, weighted slightly at the base.',
    'Height 9 cm including ring\nMerino wool, recycled fibre filling\nSolid brass split ring\nMade by hand', 'coming_soon', 0, 'pear'],
  ['cloud-keyring-in-cotton', 'Cloud keyring in cotton', 'keyrings', 28, 'Pale blue', 'Mercerised cotton',
    'A flat, pale blue cloud. The lightest piece we make.',
    'Width 8 cm\nMercerised cotton\nSolid brass split ring\nMade by hand', 'in_stock', 0, 'cloud'],
];

function seedStatements() {
  const statements = [];
  for (const [slug, name, description, order] of SAMPLE_CATEGORIES) {
    statements.push([
      'INSERT INTO categories (slug, name, description, sort_order) VALUES (?, ?, ?, ?)',
      slug, name, description, order,
    ]);
  }
  SAMPLE_PRODUCTS.forEach((p, index) => {
    const [slug, name, category, price, colour, material, description, details, availability, featured, image] = p;
    // Stagger created_at so "Newest" has a stable order.
    const created = new Date(Date.UTC(2026, 10, 1, 9, 0, 0) - index * 86_400_000).toISOString();
    statements.push([
      `INSERT INTO products (slug, name, category_id, price, colour, material, description, details,
         availability, status, featured, created_at, updated_at)
       VALUES (?, ?, (SELECT id FROM categories WHERE slug = ?), ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`,
      slug, name, category, price, colour, material, description, details, availability, featured, created, created,
    ]);
    statements.push([
      `INSERT INTO product_images (product_id, url, alt, sort_order)
       VALUES ((SELECT id FROM products WHERE slug = ?), ?, ?, 0)`,
      slug, `/img/samples/${image}.svg`, name,
    ]);
  });
  return statements;
}

/** Each statement is a SQL string or [sql, ...params]. */
export const MIGRATIONS = [
  {
    id: 'core:001-init',
    statements: [
      `CREATE TABLE settings (
         key   TEXT PRIMARY KEY,
         value TEXT NOT NULL
       )`,
      `CREATE TABLE categories (
         id          INTEGER PRIMARY KEY AUTOINCREMENT,
         slug        TEXT NOT NULL UNIQUE,
         name        TEXT NOT NULL,
         description TEXT NOT NULL DEFAULT '',
         sort_order  INTEGER NOT NULL DEFAULT 0
       )`,
      `CREATE TABLE products (
         id           INTEGER PRIMARY KEY AUTOINCREMENT,
         slug         TEXT NOT NULL UNIQUE,
         name         TEXT NOT NULL,
         category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
         price        REAL NOT NULL DEFAULT 0,
         colour       TEXT NOT NULL DEFAULT '',
         material     TEXT NOT NULL DEFAULT '',
         description  TEXT NOT NULL DEFAULT '',
         details      TEXT NOT NULL DEFAULT '',
         availability TEXT NOT NULL DEFAULT 'in_stock',
         status       TEXT NOT NULL DEFAULT 'draft',
         featured     INTEGER NOT NULL DEFAULT 0,
         created_at   TEXT NOT NULL,
         updated_at   TEXT NOT NULL
       )`,
      `CREATE INDEX idx_products_listing ON products (status, category_id, created_at)`,
      `CREATE TABLE product_images (
         id         INTEGER PRIMARY KEY AUTOINCREMENT,
         product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
         url        TEXT NOT NULL,
         alt        TEXT NOT NULL DEFAULT '',
         sort_order INTEGER NOT NULL DEFAULT 0
       )`,
      `CREATE INDEX idx_product_images_product ON product_images (product_id, sort_order)`,
      // Uploaded photos. Swapping this for R2 later only touches src/routes/media.js.
      `CREATE TABLE media (
         id           TEXT PRIMARY KEY,
         content_type TEXT NOT NULL,
         data         BLOB NOT NULL,
         size         INTEGER NOT NULL,
         created_at   TEXT NOT NULL
       )`,
      `CREATE TABLE sessions (
         token_hash TEXT PRIMARY KEY,
         expires_at INTEGER NOT NULL
       )`,
      `CREATE TABLE login_attempts (
         ip TEXT NOT NULL,
         at INTEGER NOT NULL
       )`,
      `CREATE INDEX idx_login_attempts ON login_attempts (ip, at)`,
    ],
  },
  { id: 'core:002-sample-catalogue', statements: seedStatements() },
];

let ready; // one migration check per Worker isolate

export function ensureSchema(db, extraMigrations = []) {
  ready ??= migrate(db, [...MIGRATIONS, ...extraMigrations]).catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

async function appliedIds(db) {
  try {
    const { results } = await db.prepare('SELECT id FROM schema_migrations').all();
    return new Set(results.map((row) => row.id));
  } catch {
    await db
      .prepare('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
      .run();
    return new Set();
  }
}

async function migrate(db, migrations) {
  const done = await appliedIds(db);
  for (const migration of migrations) {
    if (done.has(migration.id)) continue;
    const statements = migration.statements.map((statement) => {
      const [sql, ...params] = Array.isArray(statement) ? statement : [statement];
      return db.prepare(sql).bind(...params);
    });
    statements.push(
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').bind(migration.id, new Date().toISOString()),
    );
    try {
      await db.batch(statements); // a batch is one transaction: all or nothing
    } catch (error) {
      // Another isolate may have applied the same migration a moment ago.
      const now = await appliedIds(db);
      if (!now.has(migration.id)) throw error;
    }
  }
}

// ---- Shared queries -------------------------------------------------------

const FIRST_IMAGE = (offset) =>
  `(SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1 OFFSET ${offset})`;

export const PRODUCT_CARD_COLUMNS = `
  p.id, p.slug, p.name, p.price, p.colour, p.availability, p.featured, p.created_at,
  c.name AS category_name, c.slug AS category_slug,
  ${FIRST_IMAGE(0)} AS image, ${FIRST_IMAGE(1)} AS image_alt`;

export const PRODUCT_FROM = `FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

export const settingsQuery = (db) => db.prepare('SELECT key, value FROM settings');
export const categoriesQuery = (db) =>
  db.prepare('SELECT id, slug, name, description, sort_order FROM categories ORDER BY sort_order, name');
