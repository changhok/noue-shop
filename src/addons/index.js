// Add-on registry.
//
// The shop core (catalogue, admin, media) never changes when a feature such as
// payments or statistics is added. A feature is an "add-on": one folder in
// src/addons/ that exports an object with any of the hooks below, plus one
// line in INSTALLED. Removing that line switches the feature off again.
//
//   id, name, description     shown in Admin > Add-ons
//   migrations                [{ id: 'payments:001-...', statements: [...] }]
//                             applied automatically, same runner as the core
//   routes(app)               register pages / API routes on the Hono app
//   headTags(ctx)             html to add inside <head>   (ctx: { settings, path })
//   bodyEnd(ctx)              html to add before </body>
//   productActions(ctx)       html for the buy area on a product page
//                             (ctx: { product, settings }) — replaces "Enquire"
//   onPageView(ctx)           called after a storefront page is served
//                             (ctx: { c, page, product }) — runs in waitUntil
//
// See docs/ADDONS.md for a walk-through.

import payments from './payments/index.js';
import analytics from './analytics/index.js';

/** Everything that exists in the codebase (listed in the admin). */
export const AVAILABLE = [payments, analytics];

/** What is actually switched on. Add `payments` / `analytics` here when they are ready. */
export const INSTALLED = [];

export const addonMigrations = () => INSTALLED.flatMap((addon) => addon.migrations ?? []);

export function registerAddonRoutes(app) {
  for (const addon of INSTALLED) addon.routes?.(app);
}

/** Collects the html each installed add-on returns for a hook. */
export function renderHook(hook, ctx) {
  return INSTALLED.map((addon) => addon[hook]?.(ctx)).filter(Boolean);
}

/** Fire-and-forget hooks (statistics etc.). Never blocks or breaks the page. */
export function notify(hook, ctx) {
  for (const addon of INSTALLED) {
    if (!addon[hook]) continue;
    try {
      const work = Promise.resolve(addon[hook](ctx)).catch(() => {});
      ctx.c?.executionCtx?.waitUntil?.(work);
    } catch {
      /* an add-on must never take the storefront down */
    }
  }
}

export function addonSummary() {
  return AVAILABLE.map((addon) => ({
    id: addon.id,
    name: addon.name,
    description: addon.description,
    installed: INSTALLED.includes(addon),
  }));
}
