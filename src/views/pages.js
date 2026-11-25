import { html, raw, paragraphs, lines } from '../lib/html.js';
import { formatPrice, AVAILABILITY } from '../lib/format.js';
import { productCard } from './layout.js';
import { renderHook } from '../addons/index.js';

// ---- Home -----------------------------------------------------------------

const HERO_CHARMS = ['cherry', 'daisy', 'heart', 'lemon', 'star'];

function hero(settings) {
  const text = html`
    <div class="hero__text">
      <h1 class="hero__title">${settings.hero_title}</h1>
      <p class="hero__lede">${settings.hero_text}</p>
      <a class="text-link" href="/shop">Shop all pieces</a>
    </div>`;

  if (settings.hero_image) {
    return html`
      <section class="hero hero--photo">
        <img class="hero__photo" src="${settings.hero_image}" alt="" width="1600" height="1000" fetchpriority="high">
        ${text}
      </section>`;
  }
  // Default hero: charms hanging from the top edge of the page.
  return html`
    <section class="hero hero--hanging">
      <div class="hero__charms" aria-hidden="true">
        ${HERO_CHARMS.map(
          (name, i) => html`<span class="hang hang--${i + 1}"><img src="/img/charms/${name}.svg" alt="" width="400" height="500"></span>`,
        )}
      </div>
      ${text}
    </section>`;
}

export function homePage({ settings, products, categoryTiles }) {
  const [firstParagraph] = String(settings.about_body).split(/\n\s*\n/);
  return html`
    ${hero(settings)}

    ${products.length
      ? html`
        <section class="section" aria-labelledby="latest-heading">
          <div class="section__head">
            <h2 id="latest-heading" class="section__title">Latest pieces</h2>
            <a class="text-link" href="/shop">View all</a>
          </div>
          <ul class="grid">${products.map((p) => productCard(p, settings))}</ul>
        </section>`
      : ''}

    ${categoryTiles.length
      ? html`
        <section class="section" aria-label="Categories">
          <ul class="tiles tiles--${Math.min(categoryTiles.length, 3)}">
            ${categoryTiles.map(
              (cat) => html`
                <li>
                  <a class="tile" href="/shop/${cat.slug}">
                    <div class="tile__media">
                      ${cat.image ? html`<img src="${cat.image}" alt="" width="800" height="1000" loading="lazy">` : ''}
                    </div>
                    <span class="tile__name">${cat.name}</span>
                    ${cat.description ? html`<span class="tile__note">${cat.description}</span>` : ''}
                  </a>
                </li>`,
            )}
          </ul>
        </section>`
      : ''}

    <section class="story">
      <h2 class="story__title">${settings.about_title}</h2>
      <div class="story__body">
        <p>${firstParagraph}</p>
        <a class="text-link" href="/about">How each piece is made</a>
      </div>
    </section>`;
}

// ---- Shop -----------------------------------------------------------------

const SORTS = [
  ['new', 'Newest'],
  ['price-asc', 'Price, low to high'],
  ['price-desc', 'Price, high to low'],
];

export function shopPage({ settings, categories, category, products, total, page, pages, sort, inStockOnly, basePath }) {
  const query = (overrides = {}) => {
    const params = new URLSearchParams();
    const next = { sort, stock: inStockOnly ? '1' : '', page: '', ...overrides };
    if (next.sort && next.sort !== 'new') params.set('sort', next.sort);
    if (next.stock) params.set('stock', '1');
    if (next.page && Number(next.page) > 1) params.set('page', next.page);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return html`
    <section class="shop-head">
      <h1 class="page-title">${category ? category.name : 'Bag charms & keyrings'}</h1>
      ${category?.description ? html`<p class="shop-head__note">${category.description}</p>` : ''}
      <ul class="subnav" aria-label="Categories">
        <li><a href="/shop"${category ? '' : raw(' aria-current="page"')}>All</a></li>
        ${categories.map(
          (cat) => html`<li><a href="/shop/${cat.slug}"${category?.id === cat.id ? raw(' aria-current="page"') : ''}>${cat.name}</a></li>`,
        )}
      </ul>
    </section>

    <form class="controls" method="get" action="${basePath}" data-autosubmit>
      <p class="controls__count">${total} ${total === 1 ? 'piece' : 'pieces'}</p>
      <label class="check">
        <input type="checkbox" name="stock" value="1"${inStockOnly ? raw(' checked') : ''}>
        <span>In stock only</span>
      </label>
      <label class="select">
        <span>Sort by</span>
        <select name="sort">
          ${SORTS.map(([value, label]) => html`<option value="${value}"${sort === value ? raw(' selected') : ''}>${label}</option>`)}
        </select>
      </label>
      <noscript><button class="button button--quiet" type="submit">Apply</button></noscript>
    </form>

    ${products.length
      ? html`<ul class="grid">${products.map((p, i) => productCard(p, settings, { eager: i < 4 }))}</ul>`
      : html`
        <div class="empty">
          <p>Nothing matches these filters right now.</p>
          <a class="text-link" href="${basePath}">Clear filters</a>
        </div>`}

    ${pages > 1
      ? html`
        <nav class="pagination" aria-label="Pages">
          ${page > 1 ? html`<a href="${query({ page: page - 1 })}" rel="prev">Previous</a>` : ''}
          ${Array.from({ length: pages }, (_, i) => i + 1).map(
            (n) => html`<a href="${query({ page: n })}"${n === page ? raw(' aria-current="page"') : ''}>${n}</a>`,
          )}
          ${page < pages ? html`<a href="${query({ page: page + 1 })}" rel="next">Next</a>` : ''}
        </nav>`
      : ''}`;
}

// ---- Product --------------------------------------------------------------

function enquireActions(product, settings) {
  const subject = encodeURIComponent(`Enquiry: ${product.name}`);
  if (settings.contact_email) {
    return html`<a class="button" href="mailto:${settings.contact_email}?subject=${subject}">Enquire by email</a>`;
  }
  if (settings.instagram_url) {
    return html`<a class="button" href="${settings.instagram_url}" rel="noopener" target="_blank">Enquire on Instagram</a>`;
  }
  return '';
}

export function productPage({ settings, product, images, related }) {
  const unavailable = product.availability !== 'in_stock';
  const addonActions = renderHook('productActions', { product, settings });
  const detailLines = lines(product.details);

  return html`
    <article class="product">
      <div class="product__gallery${images.length === 1 ? ' product__gallery--single' : ''}">
        ${images.map(
          (image, i) => html`<img src="${image.url}" alt="${image.alt || product.name}" width="800" height="1000"
            ${i === 0 ? raw('fetchpriority="high"') : raw('loading="lazy"')} decoding="async">`,
        )}
      </div>

      <div class="product__info">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a href="/shop">Shop</a>
          ${product.category_slug ? html`<span aria-hidden="true">/</span> <a href="/shop/${product.category_slug}">${product.category_name}</a>` : ''}
        </nav>
        <h1 class="product__name">${product.name}</h1>
        <p class="product__price">${formatPrice(product.price, settings.currency)}</p>
        ${unavailable ? html`<p class="product__status">${AVAILABILITY[product.availability] ?? 'Unavailable'}</p>` : ''}

        <dl class="product__facts">
          ${product.colour ? html`<div><dt>Colour</dt><dd>${product.colour}</dd></div>` : ''}
          ${product.material ? html`<div><dt>Material</dt><dd>${product.material}</dd></div>` : ''}
        </dl>

        <div class="product__description">${paragraphs(product.description)}</div>

        <div class="product__actions">
          ${addonActions.length ? addonActions : enquireActions(product, settings)}
        </div>

        ${detailLines.length
          ? html`
            <details class="fold" open>
              <summary>Details</summary>
              <ul>${detailLines.map((line) => html`<li>${line}</li>`)}</ul>
            </details>`
          : ''}
        ${settings.shipping_note
          ? html`
            <details class="fold">
              <summary>Orders and delivery</summary>
              ${paragraphs(settings.shipping_note)}
            </details>`
          : ''}
      </div>
    </article>

    ${related.length
      ? html`
        <section class="section" aria-labelledby="more-heading">
          <div class="section__head">
            <h2 id="more-heading" class="section__title">More pieces</h2>
          </div>
          <ul class="grid">${related.map((p) => productCard(p, settings))}</ul>
        </section>`
      : ''}`;
}

export function productJsonLd({ settings, product, images, origin }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: images.map((image) => origin + image.url),
    brand: { '@type': 'Brand', name: settings.brand_name },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: settings.currency,
      availability:
        product.availability === 'in_stock' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${origin}/products/${product.slug}`,
    },
  };
  return raw(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);
}

// ---- About / not found ----------------------------------------------------

export function aboutPage({ settings }) {
  return html`
    <article class="about">
      <h1 class="about__title">${settings.about_title}</h1>
      <div class="about__body">
        ${paragraphs(settings.about_body)}
        ${settings.contact_email || settings.instagram_url
          ? html`
            <p class="about__contact">
              ${settings.contact_email ? html`<a class="text-link" href="mailto:${settings.contact_email}">${settings.contact_email}</a>` : ''}
              ${settings.instagram_url ? html`<a class="text-link" href="${settings.instagram_url}" rel="noopener" target="_blank">Instagram</a>` : ''}
            </p>`
          : ''}
      </div>
    </article>`;
}

export function notFoundPage() {
  return html`
    <section class="empty empty--page">
      <h1 class="page-title">This page can’t be found</h1>
      <p>The piece may have sold out and been removed, or the address may be mistyped.</p>
      <a class="text-link" href="/shop">Shop all pieces</a>
    </section>`;
}
