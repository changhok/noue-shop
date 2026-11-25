// Entry point of the Worker.
//
//   public/            static files, served by Cloudflare before this code runs
//   src/routes/        storefront pages, admin API, uploaded photos
//   src/views/         HTML templates
//   src/lib/           database schema + migrations, sign-in, helpers
//   src/addons/        optional features (payments, statistics) — see docs/ADDONS.md

import { Hono } from 'hono';
import { ensureSchema } from './lib/db.js';
import storefront, { renderNotFound } from './routes/storefront.js';
import adminApi from './routes/admin-api.js';
import media from './routes/media.js';
import { addonMigrations, registerAddonRoutes } from './addons/index.js';

const app = new Hono();

// Make sure the database tables exist (runs once per Worker start).
app.use('*', async (c, next) => {
  if (!c.env.DB) {
    return c.text('The D1 database binding "DB" is missing. Check wrangler.jsonc and redeploy.', 500);
  }
  await ensureSchema(c.env.DB, addonMigrations());
  return next();
});

app.route('/admin/api', adminApi);
app.route('/', media);
registerAddonRoutes(app);
app.route('/', storefront);

app.notFound((c) => {
  if (c.req.path.startsWith('/admin/api/')) return c.json({ error: 'Not found' }, 404);
  return renderNotFound(c);
});

app.onError((error, c) => {
  console.error(error);
  if (c.req.path.startsWith('/admin/api/')) {
    return c.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, 500);
  }
  return c.text('Something went wrong on our side. Please try again in a moment.', 500);
});

export default app;
