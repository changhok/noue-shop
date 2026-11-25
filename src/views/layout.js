import { html, raw } from '../lib/html.js';
import { formatPrice, AVAILABILITY } from '../lib/format.js';
import { renderHook } from '../addons/index.js';

const current = (path, href) => (path === href ? raw(' aria-current="page"') : '');

export function layout({ settings, categories, path, title, description, image, body, canonical }) {
  const brand = settings.brand_name;
  const pageTitle = title ? `${title} | ${brand}` : `${brand} | ${settings.tagline}`;
  const metaDescription = description || settings.meta_description;
  const hookCtx = { settings, path };

  const shopLinks = html`
    <li><a href="/shop"${current(path, '/shop')}>Shop all</a></li>
    ${categories.map(
      (cat) => html`<li><a href="/shop/${cat.slug}"${current(path, `/shop/${cat.slug}`)}>${cat.name}</a></li>`,
    )}`;
  const infoLinks = html`
    <li><a href="/about"${current(path, '/about')}>About</a></li>
    ${settings.contact_email ? html`<li><a href="mailto:${settings.contact_email}">Contact</a></li>` : ''}
    ${settings.instagram_url
      ? html`<li><a href="${settings.instagram_url}" rel="noopener" target="_blank">Instagram</a></li>`
      : ''}`;

  return html`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${pageTitle}</title>
  <meta name="description" content="${metaDescription}">
  ${canonical ? html`<link rel="canonical" href="${canonical}">` : ''}
  <meta property="og:site_name" content="${brand}">
  <meta property="og:title" content="${title || brand}">
  <meta property="og:description" content="${metaDescription}">
  ${image ? html`<meta property="og:image" content="${image}">` : ''}
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="/fonts/jost-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/site.css">
  ${renderHook('headTags', hookCtx)}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <a class="wordmark" href="/" aria-label="${brand} home">${brand}</a>
    <nav class="site-nav" id="site-nav" aria-label="Main">
      <ul class="site-nav__shop">${shopLinks}</ul>
      <ul class="site-nav__info">${infoLinks}</ul>
    </nav>
  </header>

  <main id="main">${body}</main>

  <footer class="site-footer">
    <div class="site-footer__brand">
      <p class="wordmark wordmark--small">${brand}</p>
      <p>${settings.tagline}</p>
    </div>
    <ul class="site-footer__links">${shopLinks}</ul>
    <ul class="site-footer__links">${infoLinks}</ul>
    <p class="site-footer__legal">
      © ${new Date().getUTCFullYear()} ${brand}${settings.footer_note ? html`. ${settings.footer_note}` : ''}
    </p>
  </footer>
  <script src="/js/site.js" defer></script>
  ${renderHook('bodyEnd', hookCtx)}
</body>
</html>`;
}

/** One product tile, shared by the home page, shop grid and "more pieces". */
export function productCard(product, settings, { eager = false } = {}) {
  const unavailable = product.availability !== 'in_stock';
  return html`
    <li class="card${unavailable ? ' card--unavailable' : ''}">
      <a class="card__link" href="/products/${product.slug}">
        <div class="card__media${product.image_alt ? ' card__media--swap' : ''}">
          ${product.image
            ? html`<img src="${product.image}" alt="" width="800" height="1000" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`
            : ''}
          ${product.image_alt
            ? html`<img class="card__second" src="${product.image_alt}" alt="" width="800" height="1000" loading="lazy" decoding="async">`
            : ''}
        </div>
        <div class="card__text">
          <h3 class="card__name">${product.name}</h3>
          ${product.colour ? html`<p class="card__colour">${product.colour}</p>` : ''}
          <p class="card__price">
            ${unavailable ? AVAILABILITY[product.availability] ?? 'Unavailable' : formatPrice(product.price, settings.currency)}
          </p>
        </div>
      </a>
    </li>`;
}
