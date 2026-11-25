// Statistics add-on — NOT INSTALLED YET (skeleton).
//
// Counts storefront page views in D1 without cookies or third-party scripts.
// The storefront already calls onPageView() for every page it serves, so
// installing this add-on needs no change to the core.
//
// To finish it (see docs/ADDONS.md):
//   1. Review the drafted `migrations` and onPageView() below.
//   2. Add a report route, e.g. GET /admin/api/stats, and a screen in the admin.
//   3. Add `analytics` to INSTALLED in src/addons/index.js.

export default {
  id: 'analytics',
  name: 'Statistics',
  description: '방문 수, 인기 상품, 유입 경로 등 통계. 쿠키 없이 D1에 일별로 집계합니다.',

  migrations: [
    {
      id: 'analytics:001-page-views',
      statements: [
        `CREATE TABLE page_views (
           day        TEXT NOT NULL,              -- YYYY-MM-DD (UTC)
           page       TEXT NOT NULL,              -- home | shop | product | about
           product_id INTEGER NOT NULL DEFAULT 0,
           country    TEXT NOT NULL DEFAULT '',
           views      INTEGER NOT NULL DEFAULT 0,
           PRIMARY KEY (day, page, product_id, country)
         )`,
      ],
    },
  ],

  async onPageView({ c, page, product }) {
    const day = new Date().toISOString().slice(0, 10);
    const country = c.req.raw.cf?.country ?? '';
    await c.env.DB.prepare(
      `INSERT INTO page_views (day, page, product_id, country, views) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT (day, page, product_id, country) DO UPDATE SET views = views + 1`,
    )
      .bind(day, page, product?.id ?? 0, country)
      .run();
  },

  routes(app) {
    // app.get('/admin/api/stats', requireAdmin, ...)
  },
};
