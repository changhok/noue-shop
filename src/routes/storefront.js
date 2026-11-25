// Public pages: home, shop, product, about, sitemap.

import { Hono } from 'hono';
import { mergeSettings } from '../lib/settings.js';
import { PRODUCT_CARD_COLUMNS, PRODUCT_FROM, settingsQuery, categoriesQuery } from '../lib/db.js';
import { layout } from '../views/layout.js';
import { homePage, shopPage, productPage, productJsonLd, aboutPage, notFoundPage } from '../views/pages.js';
import { html } from '../lib/html.js';
import { notify } from '../addons/index.js';

const PAGE_SIZE = 24;

const SORT_SQL = {
  new: 'p.created_at DESC, p.id DESC',
  'price-asc': 'p.price ASC, p.id DESC',
  'price-desc': 'p.price DESC, p.id DESC',
};

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function page(c, view, status = 200) {
  return c.body(layout({ path: new URL(c.req.url).pathname, ...view }).toString(), status, HEADERS);
}

/** Settings + categories are needed on every page; fetch them in one round trip with the page's own queries. */
async function load(db, ...queries) {
  const [settingsRows, categoryRows, ...rest] = await db.batch([settingsQuery(db), categoriesQuery(db), ...queries]);
  return {
    settings: mergeSettings(settingsRows.results),
    categories: categoryRows.results,
    results: rest.map((r) => r.results),
  };
}

export async function renderNotFound(c) {
  const { settings, categories } = await load(c.env.DB);
  return page(c, { settings, categories, title: 'Page not found', body: notFoundPage() }, 404);
}

const storefront = new Hono();

storefront.get('/', async (c) => {
  const db = c.env.DB;
  const { settings, categories, results } = await load(
    db,
    db.prepare(
      `SELECT ${PRODUCT_CARD_COLUMNS} ${PRODUCT_FROM}
       WHERE p.status = 'published'
       ORDER BY p.featured DESC, p.created_at DESC, p.id DESC LIMIT 8`,
    ),
    // One representative image per category for the category tiles.
    db.prepare(
      `SELECT c.id, c.slug, c.name, c.description,
        (SELECT i.url FROM products p JOIN product_images i ON i.product_id = p.id
          WHERE p.category_id = c.id AND p.status = 'published'
          ORDER BY p.featured DESC, p.created_at DESC, i.sort_order LIMIT 1) AS image
       FROM categories c ORDER BY c.sort_order, c.name LIMIT 3`,
    ),
  );
  const [products, tiles] = results;
  notify('onPageView', { c, page: 'home' });
  return page(c, {
    settings,
    categories,
    canonical: new URL('/', c.req.url).href,
    body: homePage({ settings, products, categoryTiles: tiles.filter((t) => t.image) }),
  });
});

async function shop(c) {
  const db = c.env.DB;
  const slug = c.req.param('category');
  const sort = SORT_SQL[c.req.query('sort')] ? c.req.query('sort') : 'new';
  const inStockOnly = c.req.query('stock') === '1';
  const requestedPage = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1);

  const where = ["p.status = 'published'"];
  const params = [];
  if (slug) {
    where.push('c.slug = ?');
    params.push(slug);
  }
  if (inStockOnly) where.push("p.availability = 'in_stock'");
  const whereSql = where.join(' AND ');

  const { settings, categories, results } = await load(
    db,
    db.prepare(`SELECT COUNT(*) AS total ${PRODUCT_FROM} WHERE ${whereSql}`).bind(...params),
    db
      .prepare(
        `SELECT ${PRODUCT_CARD_COLUMNS} ${PRODUCT_FROM} WHERE ${whereSql}
         ORDER BY ${SORT_SQL[sort]} LIMIT ? OFFSET ?`,
      )
      .bind(...params, PAGE_SIZE, (requestedPage - 1) * PAGE_SIZE),
  );

  const category = slug ? categories.find((cat) => cat.slug === slug) : null;
  if (slug && !category) return renderNotFound(c);

  const total = results[0][0]?.total ?? 0;
  const basePath = slug ? `/shop/${slug}` : '/shop';
  notify('onPageView', { c, page: 'shop' });
  return page(c, {
    settings,
    categories,
    title: category ? category.name : 'Shop all',
    description: category?.description || undefined,
    canonical: new URL(basePath, c.req.url).href,
    body: shopPage({
      settings,
      categories,
      category,
      products: results[1],
      total,
      page: requestedPage,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      sort,
      inStockOnly,
      basePath,
    }),
  });
}
storefront.get('/shop', shop);
storefront.get('/shop/:category', shop);

storefront.get('/products/:slug', async (c) => {
  const db = c.env.DB;
  const slug = c.req.param('slug');
  const { settings, categories, results } = await load(
    db,
    db
      .prepare(
        `SELECT p.*, c.name AS category_name, c.slug AS category_slug ${PRODUCT_FROM}
         WHERE p.slug = ? AND p.status = 'published'`,
      )
      .bind(slug),
    db
      .prepare(
        `SELECT i.url, i.alt FROM product_images i JOIN products p ON p.id = i.product_id
         WHERE p.slug = ? ORDER BY i.sort_order, i.id`,
      )
      .bind(slug),
    db
      .prepare(
        `SELECT ${PRODUCT_CARD_COLUMNS} ${PRODUCT_FROM}
         WHERE p.status = 'published' AND p.slug != ?
         ORDER BY (p.category_id IS (SELECT category_id FROM products WHERE slug = ?)) DESC, p.created_at DESC
         LIMIT 4`,
      )
      .bind(slug, slug),
  );
  const [[product], images, related] = results;
  if (!product) return renderNotFound(c);

  const origin = new URL(c.req.url).origin;
  notify('onPageView', { c, page: 'product', product });
  return page(c, {
    settings,
    categories,
    title: product.name,
    description: product.description.slice(0, 160),
    image: images[0] ? origin + images[0].url : undefined,
    canonical: `${origin}/products/${product.slug}`,
    body: html`${productPage({ settings, product, images, related })}${productJsonLd({ settings, product, images, origin })}`,
  });
});

storefront.get('/about', async (c) => {
  const { settings, categories } = await load(c.env.DB);
  notify('onPageView', { c, page: 'about' });
  return page(c, {
    settings,
    categories,
    title: 'About',
    canonical: new URL('/about', c.req.url).href,
    body: aboutPage({ settings }),
  });
});

storefront.get('/sitemap.xml', async (c) => {
  const origin = new URL(c.req.url).origin;
  const [products, categories] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT slug, updated_at FROM products WHERE status = 'published'"),
    c.env.DB.prepare('SELECT slug FROM categories'),
  ]);
  const urls = [
    '/', '/shop', '/about',
    ...categories.results.map((cat) => `/shop/${cat.slug}`),
    ...products.results.map((p) => `/products/${p.slug}`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${origin}${u}</loc></url>`).join('\n')}
</urlset>`;
  return c.body(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
});

storefront.get('/robots.txt', (c) =>
  c.text(`User-agent: *\nDisallow: /admin\nSitemap: ${new URL('/sitemap.xml', c.req.url).href}\n`),
);

export default storefront;
