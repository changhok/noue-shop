// Payments add-on — NOT INSTALLED YET (skeleton).
//
// The shop currently shows products only. When checkout is needed, this is the
// one place it gets built; the core storefront stays as it is.
//
// Plan (see docs/ADDONS.md):
//   1. Fill in `migrations` (orders, order_items, payments — drafted below).
//   2. Implement a provider adapter in ./providers/<name>.js
//      (Stripe, PayPal, Toss Payments … all fit the same three functions):
//         createCheckout(env, order)   -> { redirectUrl }
//         verifyWebhook(env, request)  -> { orderId, status }
//         refund(env, payment)         -> { status }
//   3. Add routes: POST /checkout, POST /webhooks/<provider>, GET /orders/:id
//   4. Return an "Add to bag / Buy" button from productActions().
//   5. Add `payments` to INSTALLED in src/addons/index.js.
//
// Provider API keys go in Cloudflare as Secrets, never in the repository.

export default {
  id: 'payments',
  name: 'Payments',
  description: '카드·간편결제, 주문 접수, 재고 차감. 결제 대행사(Stripe, PayPal, 토스페이먼츠 등) 선택 후 연결합니다.',

  // Drafted schema — applied automatically once the add-on is installed.
  migrations: [
    {
      id: 'payments:001-orders',
      statements: [
        `CREATE TABLE orders (
           id            TEXT PRIMARY KEY,
           status        TEXT NOT NULL DEFAULT 'pending',   -- pending | paid | shipped | cancelled | refunded
           email         TEXT NOT NULL,
           customer_name TEXT NOT NULL DEFAULT '',
           shipping_json TEXT NOT NULL DEFAULT '{}',
           currency      TEXT NOT NULL,
           total         REAL NOT NULL,
           created_at    TEXT NOT NULL,
           updated_at    TEXT NOT NULL
         )`,
        `CREATE TABLE order_items (
           id         INTEGER PRIMARY KEY AUTOINCREMENT,
           order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
           product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
           name       TEXT NOT NULL,
           unit_price REAL NOT NULL,
           quantity   INTEGER NOT NULL DEFAULT 1
         )`,
        `CREATE TABLE payments (
           id           TEXT PRIMARY KEY,
           order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
           provider     TEXT NOT NULL,
           provider_ref TEXT NOT NULL DEFAULT '',
           status       TEXT NOT NULL,
           amount       REAL NOT NULL,
           raw_json     TEXT NOT NULL DEFAULT '{}',
           created_at   TEXT NOT NULL
         )`,
        `ALTER TABLE products ADD COLUMN stock INTEGER`,
      ],
    },
  ],

  routes(app) {
    // app.post('/checkout', ...)
    // app.post('/webhooks/:provider', ...)
  },

  productActions(/* { product, settings } */) {
    return null; // return html`<form ...>` for the buy button
  },
};
