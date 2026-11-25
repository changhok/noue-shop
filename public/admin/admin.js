// Admin screen (Korean UI). Talks to the JSON API in src/routes/admin-api.js.
// Pages: #products, #products/new, #products/<id>, #categories, #settings, #addons

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');

const state = { data: null, product: null };

const AVAILABILITY_KO = { in_stock: '판매 중', sold_out: '품절', coming_soon: '출시 예정' };
const CURRENCY_KO = { USD: 'USD — 미국 달러 ($)', KRW: 'KRW — 원 (₩)', EUR: 'EUR — 유로 (€)', GBP: 'GBP — 파운드 (£)', JPY: 'JPY — 엔 (¥)' };

// ---- helpers ----------------------------------------------------------------

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

let toastTimer;
function toast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.className = isError ? 'toast toast--error' : 'toast';
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), isError ? 6000 : 2500);
}

async function api(path, { method = 'GET', json, body, headers = {} } = {}) {
  const response = await fetch(`/admin/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : body,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/login') {
    renderLogin(true);
    throw new Error(data.error || '로그인이 필요합니다.');
  }
  if (!response.ok) throw new Error(data.error || `요청에 실패했습니다 (${response.status}).`);
  return data;
}

/** Runs an action, shows errors as a toast, and disables the button meanwhile. */
async function run(button, action) {
  if (button) button.disabled = true;
  try {
    await action();
  } catch (error) {
    toast(error.message, true);
  } finally {
    if (button) button.disabled = false;
  }
}

function formatPrice(amount) {
  const currency = state.data.settings.currency;
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      ...(Number.isInteger(value) ? { minimumFractionDigits: 0 } : {}),
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

// ---- photo upload -----------------------------------------------------------

const MAX_SIDE = 1600;

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Shrinks a photo in the browser so it fits in the free database. */
async function shrink(file, limit) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`"${file.name}" 파일을 읽을 수 없습니다. JPG, PNG, WebP 사진을 사용해 주세요.`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const draw = (background) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas;
  };
  for (const quality of [0.86, 0.76, 0.62]) {
    let blob = await canvasBlob(draw(null), 'image/webp', quality);
    if (!blob || blob.type !== 'image/webp') blob = await canvasBlob(draw('#ffffff'), 'image/jpeg', quality);
    if (blob && blob.size <= limit) return blob;
  }
  throw new Error(`"${file.name}" 사진의 용량을 충분히 줄이지 못했습니다.`);
}

async function upload(file) {
  const blob = await shrink(file, state.data.maxUploadBytes);
  const { url } = await api('/media', { method: 'POST', body: blob, headers: { 'Content-Type': blob.type } });
  return url;
}

// ---- shell ------------------------------------------------------------------

const NAV = [
  ['products', '상품'],
  ['categories', '카테고리'],
  ['settings', '사이트 설정'],
  ['addons', '애드온'],
];

function shell(section, content) {
  const brand = state.data.settings.brand_name;
  app.innerHTML = `
    <div class="shell">
      <aside class="side">
        <p class="side__brand">${esc(brand)}</p>
        <nav class="side__nav" aria-label="관리 메뉴">
          ${NAV.map(([id, label]) => `<a href="#${id}"${section === id ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
        </nav>
        <div class="side__foot">
          <a href="/" target="_blank" rel="noopener">사이트 보기</a>
          <button class="linkbtn" type="button" data-action="logout">로그아웃</button>
        </div>
      </aside>
      <main class="main">${content}</main>
    </div>`;
}

async function reload() {
  state.data = await api('/bootstrap');
}

// ---- login ------------------------------------------------------------------

function renderLogin(configured) {
  app.innerHTML = `
    <form class="login" id="login-form">
      <h1>쇼핑몰 관리</h1>
      ${configured
        ? ''
        : `<p class="note">관리자 비밀번호가 아직 설정되지 않았습니다. Cloudflare 대시보드의 Worker 설정에서
           <b>ADMIN_PASSWORD</b> 시크릿(8자 이상)을 추가한 뒤 다시 접속해 주세요.</p>`}
      <label class="field"><span>관리자 비밀번호</span>
        <input type="password" name="password" autocomplete="current-password" required autofocus>
      </label>
      <button class="btn" type="submit">로그인</button>
    </form>`;
  document.getElementById('login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    run(form.querySelector('button'), async () => {
      await api('/login', { method: 'POST', json: { password: form.password.value } });
      await reload();
      route();
    });
  });
}

// ---- products: list ---------------------------------------------------------

function renderProducts() {
  const { products, categories } = state.data;
  const categoryName = (id) => categories.find((cat) => cat.id === id)?.name ?? '—';
  const rows = products
    .map(
      (p) => `
      <tr data-id="${p.id}">
        <td class="table__thumb">${p.image ? `<img src="${esc(p.image)}" alt="">` : ''}</td>
        <td class="table__name"><a href="#products/${p.id}">${esc(p.name)}</a><small>${esc(categoryName(p.category_id))}</small></td>
        <td>${esc(formatPrice(p.price))}</td>
        <td>
          <select data-quick="availability" aria-label="판매 상태">
            ${Object.entries(AVAILABILITY_KO).map(([value, label]) => `<option value="${value}"${p.availability === value ? ' selected' : ''}>${label}</option>`).join('')}
          </select>
        </td>
        <td>
          <select data-quick="status" aria-label="공개 여부">
            <option value="published"${p.status === 'published' ? ' selected' : ''}>공개</option>
            <option value="draft"${p.status === 'draft' ? ' selected' : ''}>비공개</option>
          </select>
        </td>
        <td><button class="star" type="button" data-quick="featured" aria-pressed="${p.featured ? 'true' : 'false'}" title="첫 화면에 먼저 노출">★</button></td>
        <td><a class="btn btn--line btn--small" href="#products/${p.id}">수정</a></td>
      </tr>`,
    )
    .join('');

  shell(
    'products',
    `
    <div class="head">
      <h1>상품 <span class="hint">${products.length}개</span></h1>
      <a class="btn" href="#products/new">새 상품 등록</a>
    </div>
    ${products.length
      ? `<div class="tablewrap"><table class="table">
          <thead><tr><th></th><th>상품명</th><th>가격</th><th>판매 상태</th><th>공개</th><th>추천</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <p class="hint" style="margin-top:1rem">판매 상태·공개 여부·추천(★)은 목록에서 바꾸면 바로 저장됩니다. ★ 상품은 첫 화면에 먼저 보입니다.</p>`
      : `<div class="emptybox"><p>등록된 상품이 없습니다.</p><a class="btn" href="#products/new">첫 상품 등록하기</a></div>`}`,
  );

  app.querySelector('tbody')?.addEventListener('change', (event) => {
    const select = event.target.closest('select[data-quick]');
    if (!select) return;
    const id = select.closest('tr').dataset.id;
    run(select, async () => {
      await api(`/products/${id}`, { method: 'PATCH', json: { [select.dataset.quick]: select.value } });
      state.data.products.find((p) => p.id === Number(id))[select.dataset.quick] = select.value;
      toast('저장했습니다.');
    });
  });
  app.querySelector('tbody')?.addEventListener('click', (event) => {
    const star = event.target.closest('button[data-quick="featured"]');
    if (!star) return;
    const id = star.closest('tr').dataset.id;
    const next = star.getAttribute('aria-pressed') !== 'true';
    run(star, async () => {
      await api(`/products/${id}`, { method: 'PATCH', json: { featured: next } });
      star.setAttribute('aria-pressed', String(next));
      state.data.products.find((p) => p.id === Number(id)).featured = next ? 1 : 0;
      toast('저장했습니다.');
    });
  });
}

// ---- products: editor -------------------------------------------------------

function photosHtml(images) {
  return `
    ${images
      .map(
        (url, i) => `
        <div class="photo">
          <img src="${esc(url)}" alt="상품 사진 ${i + 1}">
          ${i === 0 ? '<span class="photo__main">대표</span>' : ''}
          <div class="photo__bar">
            <button type="button" data-photo="left" data-index="${i}" ${i === 0 ? 'disabled' : ''} aria-label="앞으로 이동">←</button>
            <button type="button" data-photo="right" data-index="${i}" ${i === images.length - 1 ? 'disabled' : ''} aria-label="뒤로 이동">→</button>
            <button type="button" data-photo="remove" data-index="${i}">삭제</button>
          </div>
        </div>`,
      )
      .join('')}
    <label class="drop" id="drop">
      <input type="file" id="photo-input" accept="image/*" multiple>
      <span>사진 추가<br>(클릭 또는 끌어다 놓기)</span>
    </label>`;
}

async function renderProductForm(id) {
  const isNew = id === 'new';
  const product = isNew
    ? { name: '', slug: '', category_id: null, price: '', colour: '', material: '', description: '', details: '', availability: 'in_stock', status: 'published', featured: 0, images: [] }
    : await api(`/products/${id}`);
  state.product = product;
  const { categories, settings } = state.data;

  shell(
    'products',
    `
    <div class="head">
      <h1>${isNew ? '새 상품 등록' : '상품 수정'}</h1>
      ${!isNew && product.status === 'published' ? `<a class="btn btn--line btn--small" href="/products/${esc(product.slug)}" target="_blank" rel="noopener">사이트에서 보기</a>` : ''}
      <a class="btn btn--line btn--small" href="#products">목록으로</a>
    </div>
    <form class="form" id="product-form">
      <label class="field"><span>상품명 (사이트에 표시되는 이름 · 영문 권장)</span>
        <input type="text" name="name" value="${esc(product.name)}" maxlength="160" required placeholder="Cherry charm in cotton">
      </label>
      <div class="form__row">
        <label class="field"><span>카테고리</span>
          <select name="category_id">
            <option value="">선택 안 함</option>
            ${categories.map((cat) => `<option value="${cat.id}"${product.category_id === cat.id ? ' selected' : ''}>${esc(cat.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>가격 (${esc(settings.currency)})</span>
          <input type="number" name="price" value="${esc(product.price)}" min="0" step="any" required>
        </label>
      </div>
      <div class="form__row">
        <label class="field"><span>색상</span>
          <input type="text" name="colour" value="${esc(product.colour)}" maxlength="120" placeholder="Red/Green">
        </label>
        <label class="field"><span>소재</span>
          <input type="text" name="material" value="${esc(product.material)}" maxlength="120" placeholder="Mercerised cotton">
        </label>
      </div>
      <label class="field"><span>상품 설명 (빈 줄로 문단 구분)</span>
        <textarea name="description">${esc(product.description)}</textarea>
      </label>
      <label class="field"><span>상세 정보 (한 줄에 한 항목 — 크기, 소재, 부자재 등)</span>
        <textarea name="details" placeholder="Height 11 cm including clasp&#10;Solid brass lobster clasp and ring">${esc(product.details)}</textarea>
      </label>

      <fieldset>
        <legend>사진</legend>
        <p class="hint">첫 번째 사진이 대표 사진입니다. 세로 4:5 비율이 가장 잘 맞고, 올릴 때 자동으로 용량을 줄여 저장합니다.</p>
        <div class="photos" id="photos">${photosHtml(product.images)}</div>
      </fieldset>

      <fieldset>
        <legend>판매 설정</legend>
        <div class="form__row">
          <label class="field"><span>판매 상태</span>
            <select name="availability">
              ${Object.entries(AVAILABILITY_KO).map(([value, label]) => `<option value="${value}"${product.availability === value ? ' selected' : ''}>${label}</option>`).join('')}
            </select>
          </label>
          <label class="field"><span>공개 여부</span>
            <select name="status">
              <option value="published"${product.status === 'published' ? ' selected' : ''}>공개 (사이트에 표시)</option>
              <option value="draft"${product.status === 'draft' ? ' selected' : ''}>비공개 (임시 저장)</option>
            </select>
          </label>
        </div>
        <label class="checkline"><input type="checkbox" name="featured"${product.featured ? ' checked' : ''}> 첫 화면에 먼저 노출 (추천 상품)</label>
        <label class="field"><span>주소(URL)에 쓰는 이름 — 비워 두면 상품명으로 자동 생성</span>
          <input type="text" name="slug" value="${esc(product.slug)}" maxlength="80" placeholder="cherry-charm-in-cotton">
        </label>
      </fieldset>

      <div class="form__actions">
        <button class="btn" type="submit">저장</button>
        <a class="btn btn--line" href="#products">취소</a>
        ${isNew ? '' : '<button class="btn btn--danger" type="button" data-action="delete-product">상품 삭제</button>'}
      </div>
    </form>`,
  );

  const form = document.getElementById('product-form');
  const photos = document.getElementById('photos');
  const redrawPhotos = () => (photos.innerHTML = photosHtml(product.images));

  const addFiles = async (files) => {
    for (const file of files) {
      if (product.images.length >= 12) {
        toast('사진은 상품당 12장까지 등록할 수 있습니다.', true);
        break;
      }
      try {
        toast(`"${file.name}" 올리는 중…`);
        product.images.push(await upload(file));
        redrawPhotos();
      } catch (error) {
        toast(error.message, true);
      }
    }
    toastEl.hidden = true;
  };

  photos.addEventListener('change', (event) => {
    if (event.target.id === 'photo-input') addFiles([...event.target.files]);
  });
  photos.addEventListener('dragover', (event) => {
    event.preventDefault();
    document.getElementById('drop')?.classList.add('is-over');
  });
  photos.addEventListener('dragleave', () => document.getElementById('drop')?.classList.remove('is-over'));
  photos.addEventListener('drop', (event) => {
    event.preventDefault();
    addFiles([...event.dataTransfer.files].filter((file) => file.type.startsWith('image/')));
  });
  photos.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-photo]');
    if (!button) return;
    const i = Number(button.dataset.index);
    const list = product.images;
    if (button.dataset.photo === 'remove') list.splice(i, 1);
    if (button.dataset.photo === 'left' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    if (button.dataset.photo === 'right' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
    redrawPhotos();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = {
      name: form.name.value,
      slug: form.slug.value,
      category_id: form.category_id.value ? Number(form.category_id.value) : null,
      price: Number(form.price.value),
      colour: form.colour.value,
      material: form.material.value,
      description: form.description.value,
      details: form.details.value,
      availability: form.availability.value,
      status: form.status.value,
      featured: form.featured.checked,
      images: product.images,
    };
    run(form.querySelector('button[type="submit"]'), async () => {
      if (isNew) await api('/products', { method: 'POST', json: payload });
      else await api(`/products/${id}`, { method: 'PUT', json: payload });
      await reload();
      toast('저장했습니다.');
      location.hash = '#products';
    });
  });

  form.querySelector('[data-action="delete-product"]')?.addEventListener('click', (event) => {
    if (!confirm(`"${product.name}" 상품을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    run(event.currentTarget, async () => {
      await api(`/products/${id}`, { method: 'DELETE' });
      await reload();
      toast('삭제했습니다.');
      location.hash = '#products';
    });
  });
}

// ---- categories -------------------------------------------------------------

function categoryRow(cat) {
  const isNew = !cat.id;
  return `
    <form class="row" data-id="${cat.id ?? ''}">
      <label class="field"><span>이름</span><input type="text" name="name" value="${esc(cat.name)}" maxlength="80" required placeholder="${isNew ? '새 카테고리 이름' : ''}"></label>
      <label class="field"><span>설명 (선택)</span><input type="text" name="description" value="${esc(cat.description)}" maxlength="300"></label>
      <label class="field"><span>순서</span><input type="number" name="sort_order" value="${esc(cat.sort_order)}" step="1"></label>
      <button class="btn btn--small" type="submit">${isNew ? '추가' : '저장'}</button>
      ${isNew ? '<span></span>' : '<button class="btn btn--danger btn--small" type="button" data-action="delete-category">삭제</button>'}
    </form>`;
}

function renderCategories() {
  const { categories } = state.data;
  const nextOrder = categories.reduce((max, cat) => Math.max(max, cat.sort_order), 0) + 1;
  shell(
    'categories',
    `
    <div class="head"><h1>카테고리</h1></div>
    <p class="note">카테고리는 사이트 상단 메뉴와 상품 목록 필터에 '순서' 숫자가 작은 것부터 표시됩니다.</p>
    <div class="rows" id="category-rows">
      ${categories.map(categoryRow).join('')}
      ${categoryRow({ name: '', description: '', sort_order: nextOrder })}
    </div>`,
  );

  const rows = document.getElementById('category-rows');
  rows.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target;
    const id = form.dataset.id;
    const json = { name: form.name.value, description: form.description.value, sort_order: Number(form.sort_order.value) || 0 };
    run(form.querySelector('button[type="submit"]'), async () => {
      if (id) await api(`/categories/${id}`, { method: 'PUT', json });
      else await api('/categories', { method: 'POST', json });
      await reload();
      renderCategories();
      toast('저장했습니다.');
    });
  });
  rows.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="delete-category"]');
    if (!button) return;
    const form = button.closest('form');
    if (!confirm(`"${form.name.value}" 카테고리를 삭제할까요? 상품은 삭제되지 않고 '카테고리 없음'이 됩니다.`)) return;
    run(button, async () => {
      await api(`/categories/${form.dataset.id}`, { method: 'DELETE' });
      await reload();
      renderCategories();
      toast('삭제했습니다.');
    });
  });
}

// ---- settings ---------------------------------------------------------------

function renderSettings() {
  const { settings, currencies } = state.data;
  let heroImage = settings.hero_image;
  const field = (key, label, { type = 'text', placeholder = '' } = {}) =>
    `<label class="field"><span>${label}</span><input type="${type}" name="${key}" value="${esc(settings[key])}" placeholder="${esc(placeholder)}"></label>`;
  const area = (key, label) =>
    `<label class="field"><span>${label}</span><textarea name="${key}">${esc(settings[key])}</textarea></label>`;
  const heroHtml = () =>
    heroImage
      ? `<div class="heroimg"><img src="${esc(heroImage)}" alt="첫 화면 사진"></div>
         <div><button class="btn btn--line btn--small" type="button" data-action="hero-remove">사진 빼기 (기본 일러스트로 되돌리기)</button></div>`
      : `<p class="hint">사진이 없으면 기본 일러스트(매달린 참 그림)가 표시됩니다.</p>`;

  shell(
    'settings',
    `
    <div class="head"><h1>사이트 설정</h1></div>
    <form class="form" id="settings-form">
      <fieldset style="border-top:0;padding-top:0">
        <legend>브랜드</legend>
        ${field('brand_name', '브랜드 이름 (로고·제목·하단에 모두 반영됩니다)')}
        ${field('tagline', '한 줄 소개')}
        ${field('meta_description', '검색엔진용 설명 (구글 검색 결과에 표시)')}
      </fieldset>

      <fieldset>
        <legend>가격 표시</legend>
        <label class="field"><span>통화</span>
          <select name="currency">
            ${currencies.map((code) => `<option value="${code}"${settings.currency === code ? ' selected' : ''}>${CURRENCY_KO[code] ?? code}</option>`).join('')}
          </select>
        </label>
        <p class="hint">통화를 바꾸면 기호만 바뀌고 금액은 자동 환산되지 않습니다. 상품 가격을 새 통화 기준으로 다시 입력해 주세요.</p>
      </fieldset>

      <fieldset>
        <legend>첫 화면</legend>
        ${field('hero_title', '큰 제목')}
        ${field('hero_text', '제목 아래 문장')}
        <div class="field"><span class="hint">첫 화면 사진 (선택 · 가로 사진 권장)</span></div>
        <div id="hero-box" style="display:grid;gap:.6rem">${heroHtml()}</div>
        <div><label class="btn btn--line btn--small">사진 선택<input type="file" id="hero-input" accept="image/*" hidden></label></div>
      </fieldset>

      <fieldset>
        <legend>소개 페이지 (About)</legend>
        ${field('about_title', '제목')}
        ${area('about_body', '본문 (빈 줄로 문단 구분 · 첫 문단은 첫 화면에도 표시)')}
      </fieldset>

      <fieldset>
        <legend>문의·안내</legend>
        ${field('contact_email', '문의 이메일 (입력하면 상품 페이지에 "Enquire by email" 버튼 표시)', { type: 'email', placeholder: 'hello@example.com' })}
        ${field('instagram_url', '인스타그램 주소', { type: 'url', placeholder: 'https://www.instagram.com/…' })}
        ${area('shipping_note', '주문·배송 안내 (상품 페이지의 "Orders and delivery")')}
        ${field('footer_note', '하단 추가 문구 (선택 · 사업자 정보 등)')}
      </fieldset>

      <div class="form__actions"><button class="btn" type="submit">설정 저장</button></div>
    </form>`,
  );

  const form = document.getElementById('settings-form');
  const heroBox = document.getElementById('hero-box');
  document.getElementById('hero-input').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (!file) return;
    run(null, async () => {
      toast('사진 올리는 중…');
      heroImage = await upload(file);
      heroBox.innerHTML = heroHtml();
      toast('사진을 올렸습니다. "설정 저장"을 눌러야 반영됩니다.');
    });
  });
  heroBox.addEventListener('click', (event) => {
    if (!event.target.closest('[data-action="hero-remove"]')) return;
    heroImage = '';
    heroBox.innerHTML = heroHtml();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const json = Object.fromEntries(new FormData(form).entries());
    json.hero_image = heroImage;
    run(form.querySelector('button[type="submit"]'), async () => {
      await api('/settings', { method: 'PUT', json });
      await reload();
      renderSettings();
      toast('설정을 저장했습니다.');
    });
  });
}

// ---- add-ons ----------------------------------------------------------------

function renderAddons() {
  const { addons, storage } = state.data;
  const megabytes = (storage.bytes / 1_048_576).toFixed(1);
  shell(
    'addons',
    `
    <div class="head"><h1>애드온</h1></div>
    <p class="note">결제·통계 같은 기능은 쇼핑몰 본체를 고치지 않고 '애드온'으로 추가합니다.
      아래 항목은 자리가 준비된 상태이며, 필요할 때 Claude에게 "결제 애드온을 완성해 줘"처럼 요청하면 됩니다.</p>
    <div class="rows">
      ${addons
        .map(
          (addon) => `
          <section class="addon">
            <h2>${esc(addon.name)}<span class="badge${addon.installed ? ' badge--on' : ''}">${addon.installed ? '사용 중' : '준비됨 · 미설치'}</span></h2>
            <p>${esc(addon.description)}</p>
          </section>`,
        )
        .join('')}
      <section class="addon">
        <h2>사진 저장 공간</h2>
        <p>올린 사진 ${storage.files}장 · ${megabytes} MB 사용 (무료 DB 한도 5 GB). 사진이 수천 장으로 늘어나면 R2 저장소로 옮길 수 있습니다.</p>
      </section>
    </div>`,
  );
}

// ---- routing ----------------------------------------------------------------

async function route() {
  if (!state.data) return;
  const [section, id] = location.hash.replace(/^#/, '').split('/');
  try {
    if (section === 'products' && id) await renderProductForm(id);
    else if (section === 'categories') renderCategories();
    else if (section === 'settings') renderSettings();
    else if (section === 'addons') renderAddons();
    else renderProducts();
    window.scrollTo(0, 0);
  } catch (error) {
    toast(error.message, true);
    if (section === 'products' && id) location.hash = '#products';
  }
}

app.addEventListener('click', (event) => {
  if (!event.target.closest('[data-action="logout"]')) return;
  run(null, async () => {
    await api('/logout', { method: 'POST' });
    state.data = null;
    renderLogin(true);
  });
});

window.addEventListener('hashchange', route);

(async function start() {
  try {
    const me = await api('/me');
    if (!me.signedIn) return renderLogin(me.configured);
    await reload();
    route();
  } catch (error) {
    app.innerHTML = `<p class="loading">${esc(error.message)}</p>`;
  }
})();
