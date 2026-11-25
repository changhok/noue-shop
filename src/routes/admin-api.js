// JSON API behind the admin screen (public/admin/). Everything except
// sign-in requires a valid admin session.

import { Hono } from 'hono';
import { passwordStatus, isSignedIn, signIn, signOut, requireAdmin, sameOriginOnly } from '../lib/auth.js';
import { DEFAULTS, SETTING_KEYS, mergeSettings } from '../lib/settings.js';
import { CURRENCIES, AVAILABILITY, slugify } from '../lib/format.js';
import { categoriesQuery, settingsQuery } from '../lib/db.js';
import { saveMedia, sweepMediaStatement, MAX_UPLOAD_BYTES } from './media.js';
import { addonSummary } from '../addons/index.js';

const admin = new Hono();
admin.use('*', sameOriginOnly);
admin.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});

const bad = (c, message, status = 400) => c.json({ error: message }, status);
const text = (value, max = 5000) => String(value ?? '').trim().slice(0, max);
const isImageUrl = (url) => typeof url === 'string' && /^\/(media|img)\/[\w./-]+$/.test(url) && !url.includes('..');

// ---- Session --------------------------------------------------------------

admin.get('/me', async (c) => c.json({ passwordStatus: await passwordStatus(c.env), signedIn: await isSignedIn(c) }));

admin.post('/login', async (c) => {
  const { password } = await c.req.json().catch(() => ({}));
  const result = await signIn(c, password);
  return result.ok ? c.json({ ok: true }) : bad(c, result.message, result.status);
});

admin.post('/logout', async (c) => {
  await signOut(c);
  return c.json({ ok: true });
});

admin.use('*', requireAdmin);

// ---- Everything the admin screen needs on load ----------------------------

admin.get('/bootstrap', async (c) => {
  const db = c.env.DB;
  const [settings, categories, products, storage] = await db.batch([
    settingsQuery(db),
    categoriesQuery(db),
    db.prepare(
      `SELECT p.id, p.slug, p.name, p.price, p.colour, p.availability, p.status, p.featured, p.category_id, p.updated_at,
        (SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS image
       FROM products p ORDER BY p.created_at DESC, p.id DESC`,
    ),
    db.prepare('SELECT COUNT(*) AS files, COALESCE(SUM(size), 0) AS bytes FROM media'),
  ]);
  return c.json({
    settings: mergeSettings(settings.results),
    defaults: DEFAULTS,
    currencies: CURRENCIES,
    availability: AVAILABILITY,
    categories: categories.results,
    products: products.results,
    storage: storage.results[0],
    addons: addonSummary(),
    maxUploadBytes: MAX_UPLOAD_BYTES,
  });
});

// ---- Products -------------------------------------------------------------

async function uniqueSlug(db, table, wanted, ignoreId = 0) {
  const base = slugify(wanted);
  for (let n = 1; n < 200; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const clash = await db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`).bind(slug, ignoreId).first();
    if (!clash) return slug;
  }
  return `${base}-${Date.now()}`;
}

function readProduct(body) {
  const name = text(body.name, 160);
  if (!name) return { error: '상품명을 입력해 주세요.' };
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) return { error: '가격은 0 이상의 숫자로 입력해 주세요.' };
  const images = Array.isArray(body.images) ? body.images.filter(isImageUrl).slice(0, 12) : [];
  return {
    product: {
      name,
      slug: text(body.slug, 80),
      category_id: Number.isInteger(body.category_id) ? body.category_id : null,
      price,
      colour: text(body.colour, 120),
      material: text(body.material, 120),
      description: text(body.description),
      details: text(body.details),
      availability: AVAILABILITY[body.availability] ? body.availability : 'in_stock',
      status: body.status === 'published' ? 'published' : 'draft',
      featured: body.featured ? 1 : 0,
    },
    images,
  };
}

const imageInserts = (db, productId, name, images) =>
  images.map((url, i) =>
    db.prepare('INSERT INTO product_images (product_id, url, alt, sort_order) VALUES (?, ?, ?, ?)').bind(productId, url, name, i),
  );

admin.get('/products/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const [product, images] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id),
    c.env.DB.prepare('SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order, id').bind(id),
  ]);
  if (!product.results[0]) return bad(c, '상품을 찾을 수 없습니다.', 404);
  return c.json({ ...product.results[0], images: images.results.map((i) => i.url) });
});

admin.post('/products', async (c) => {
  const db = c.env.DB;
  const { product: p, images, error } = readProduct(await c.req.json().catch(() => ({})));
  if (error) return bad(c, error);
  const slug = await uniqueSlug(db, 'products', p.slug || p.name);
  const now = new Date().toISOString();
  const created = await db
    .prepare(
      `INSERT INTO products (slug, name, category_id, price, colour, material, description, details,
         availability, status, featured, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(slug, p.name, p.category_id, p.price, p.colour, p.material, p.description, p.details, p.availability, p.status, p.featured, now, now)
    .first();
  if (images.length) await db.batch(imageInserts(db, created.id, p.name, images));
  return c.json({ id: created.id, slug }, 201);
});

admin.put('/products/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const { product: p, images, error } = readProduct(await c.req.json().catch(() => ({})));
  if (error) return bad(c, error);
  const existing = await db.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
  if (!existing) return bad(c, '상품을 찾을 수 없습니다.', 404);
  const slug = await uniqueSlug(db, 'products', p.slug || p.name, id);
  await db.batch([
    db
      .prepare(
        `UPDATE products SET slug = ?, name = ?, category_id = ?, price = ?, colour = ?, material = ?, description = ?,
           details = ?, availability = ?, status = ?, featured = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(slug, p.name, p.category_id, p.price, p.colour, p.material, p.description, p.details, p.availability, p.status, p.featured, new Date().toISOString(), id),
    db.prepare('DELETE FROM product_images WHERE product_id = ?').bind(id),
    ...imageInserts(db, id, p.name, images),
    sweepMediaStatement(db),
  ]);
  return c.json({ id, slug });
});

// Quick changes from the product list (sold out, publish, feature).
admin.patch('/products/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const sets = [];
  const params = [];
  if (AVAILABILITY[body.availability]) {
    sets.push('availability = ?');
    params.push(body.availability);
  }
  if (body.status === 'published' || body.status === 'draft') {
    sets.push('status = ?');
    params.push(body.status);
  }
  if (typeof body.featured === 'boolean') {
    sets.push('featured = ?');
    params.push(body.featured ? 1 : 0);
  }
  if (!sets.length) return bad(c, '변경할 내용이 없습니다.');
  await c.env.DB.prepare(`UPDATE products SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`)
    .bind(...params, new Date().toISOString(), id)
    .run();
  return c.json({ ok: true });
});

admin.delete('/products/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  await db.batch([
    db.prepare('DELETE FROM product_images WHERE product_id = ?').bind(id),
    db.prepare('DELETE FROM products WHERE id = ?').bind(id),
    sweepMediaStatement(db),
  ]);
  return c.json({ ok: true });
});

// ---- Categories -----------------------------------------------------------

function readCategory(body) {
  const name = text(body.name, 80);
  if (!name) return { error: '카테고리 이름을 입력해 주세요.' };
  return {
    category: {
      name,
      slug: text(body.slug, 80),
      description: text(body.description, 300),
      sort_order: Number.isFinite(Number(body.sort_order)) ? Math.round(Number(body.sort_order)) : 0,
    },
  };
}

admin.post('/categories', async (c) => {
  const db = c.env.DB;
  const { category: cat, error } = readCategory(await c.req.json().catch(() => ({})));
  if (error) return bad(c, error);
  const slug = await uniqueSlug(db, 'categories', cat.slug || cat.name);
  const row = await db
    .prepare('INSERT INTO categories (slug, name, description, sort_order) VALUES (?, ?, ?, ?) RETURNING id')
    .bind(slug, cat.name, cat.description, cat.sort_order)
    .first();
  return c.json({ id: row.id, slug }, 201);
});

admin.put('/categories/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const { category: cat, error } = readCategory(await c.req.json().catch(() => ({})));
  if (error) return bad(c, error);
  const slug = await uniqueSlug(db, 'categories', cat.slug || cat.name, id);
  await db
    .prepare('UPDATE categories SET slug = ?, name = ?, description = ?, sort_order = ? WHERE id = ?')
    .bind(slug, cat.name, cat.description, cat.sort_order, id)
    .run();
  return c.json({ id, slug });
});

admin.delete('/categories/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  await db.batch([
    db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').bind(id),
    db.prepare('DELETE FROM categories WHERE id = ?').bind(id),
  ]);
  return c.json({ ok: true });
});

// ---- Settings -------------------------------------------------------------

admin.put('/settings', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  const statements = [];
  for (const key of SETTING_KEYS) {
    if (!(key in body)) continue;
    let value = text(body[key], 8000);
    if (key === 'currency' && !CURRENCIES.includes(value)) return bad(c, '지원하지 않는 통화입니다.');
    if (key === 'brand_name' && !value) return bad(c, '브랜드 이름을 입력해 주세요.');
    if (key === 'instagram_url' && value && !/^https:\/\//i.test(value)) return bad(c, '인스타그램 주소는 https:// 로 시작해야 합니다.');
    if (key === 'contact_email' && value && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(value)) return bad(c, '이메일 주소 형식이 올바르지 않습니다.');
    if (key === 'hero_image' && value && !isImageUrl(value)) value = '';
    statements.push(
      db
        .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
        .bind(key, value),
    );
  }
  if (statements.length) await db.batch([...statements, sweepMediaStatement(db)]);
  const { results } = await settingsQuery(db).all();
  return c.json({ settings: mergeSettings(results) });
});

// ---- Photo upload (raw image bytes in the request body) -------------------

admin.post('/media', async (c) => {
  const contentType = (c.req.header('content-type') ?? '').split(';')[0].trim();
  const buffer = await c.req.arrayBuffer();
  const result = await saveMedia(c.env.DB, contentType, buffer);
  return result.error ? bad(c, result.error) : c.json(result, 201);
});

export default admin;
