'use strict';

/**
 * BUENARDA (@buenardaparana) — Lógica de la web
 * Local: Colón 696, Paraná, Entre Ríos · Miércoles a Domingo
 *
 * Los datos editables (precios, carta, horarios, envío, WhatsApp, reseñas)
 * viven en menu-data.js. Este archivo no hace falta tocarlo para cambiarlos.
 */

const CART_KEY = 'buenarda_cart_v1';
const CUSTOMER_KEY = 'buenarda_customer_v1';
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const state = {
  filter: 'all',
  search: '',
  heroIndex: 0,
  selectedSizes: {}, // { [id]: 'doble' | 'triple' }
  deliveryMode: 'retiro',
  cart: loadCartFromStorage(),
};

function loadCartFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((c) => c && typeof c.key === 'string' && Number.isFinite(c.qty) && Number.isFinite(c.unitPrice))
      .map((c) => ({ ...c, note: typeof c.note === 'string' ? c.note : '' }));
  } catch {
    return [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  } catch {
    // Almacenamiento no disponible (modo privado): el carrito sigue funcionando en memoria
  }
}

function loadCustomer() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMER_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveCustomer() {
  try {
    localStorage.setItem(
      CUSTOMER_KEY,
      JSON.stringify({
        name: document.getElementById('customerName')?.value || '',
        address: document.getElementById('customerAddress')?.value || '',
        payment: document.getElementById('paymentMethod')?.value || '',
      })
    );
  } catch {
    // Ignorar
  }
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function formatARS(amount) {
  return '$' + amount.toLocaleString('es-AR');
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function findItem(id) {
  return MENU_ITEMS.find((entry) => entry.id === id);
}

/**
 * Medición opcional. No hace nada hasta que se instale Google Analytics (gtag) o Meta Pixel (fbq),
 * y además dispara un evento DOM "buenarda:track" por si se quiere escuchar desde otro script.
 */
function track(name, params = {}) {
  try {
    if (typeof window.gtag === 'function') window.gtag('event', name, params);
    if (typeof window.fbq === 'function') window.fbq('trackCustom', name, params);
    window.dispatchEvent(new CustomEvent('buenarda:track', { detail: { name, params } }));
  } catch {
    // La medición nunca debe romper la web
  }
}

// ---------------------------------------------------------------------------
// Horarios: estado "Abierto ahora"
// ---------------------------------------------------------------------------

function formatHour(h) {
  return String(h % 24).padStart(2, '0') + ':00';
}

/** Día de la semana (0=domingo) y hora/minuto en Argentina, sin depender de la zona del navegador. */
function getLocalParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SITE.timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: dayMap[get('weekday')],
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function getOpenStatus(now = new Date()) {
  const { openDays, open, close } = SITE.hours;
  const { day, minutes } = getLocalParts(now);
  const isOpenDay = openDays.includes(day);

  if (isOpenDay && minutes >= open * 60 && minutes < close * 60) {
    return {
      isOpen: true,
      nextText: '',
      bannerText: `ABIERTO AHORA · HASTA LAS ${formatHour(close)} HS`,
    };
  }

  let nextText = '';
  if (isOpenDay && minutes < open * 60) {
    nextText = `hoy a las ${formatHour(open)} hs`;
  } else {
    for (let i = 1; i <= 7; i += 1) {
      const d = (day + i) % 7;
      if (openDays.includes(d)) {
        nextText = i === 1 ? `mañana a las ${formatHour(open)} hs` : `el ${DAY_NAMES[d]} a las ${formatHour(open)} hs`;
        break;
      }
    }
  }

  return {
    isOpen: false,
    nextText,
    bannerText: `CERRADO · ABRIMOS ${nextText.toUpperCase()}`,
  };
}

function renderOpenStatus() {
  const status = getOpenStatus(new Date());
  const textEl = document.getElementById('openStatusText');
  const dotEl = document.getElementById('openStatusDot');
  const noticeEl = document.getElementById('cartOpenNotice');

  if (textEl) textEl.textContent = status.bannerText;
  if (dotEl) {
    dotEl.classList.toggle('is-open', status.isOpen);
    dotEl.classList.toggle('is-closed', !status.isOpen);
  }
  if (noticeEl) {
    noticeEl.hidden = status.isOpen;
    if (!status.isOpen) {
      noticeEl.textContent = `Ahora estamos cerrados (abrimos ${status.nextText}). Podés dejar armado tu pedido y lo confirmamos cuando abramos.`;
    }
  }
}

// ---------------------------------------------------------------------------
// Ilustración SVG (o foto real si está activada en menu-data.js)
// ---------------------------------------------------------------------------

function createBurgerSVG(item, isTriple = false, prefix = 'card') {
  if (!item.isBurger) {
    return `<div style="font-size: 4.5rem; line-height: 1;">${item.icon || '🍔'}</div>`;
  }

  const layers = item.layers || {};
  const gradId = `bunGrad-${prefix}-${item.id}`;
  const cheeseColor =
    layers.cheese === 'provolone' ? '#F4EFE6' : layers.cheese === 'smoked-cheddar' ? '#F6E2B3' : '#F5B700';

  const sauceColors = {
    'thousand-island': '#F29F79',
    bbq: '#5C1912',
    alioli: '#F7F3DC',
    buenarda: '#E89B4C',
    royale: '#C92A2A',
  };
  const sauceColor = sauceColors[layers.sauce] || '#F5B700';

  const extraPattySVG = isTriple
    ? `
      <rect x="44" y="138" width="132" height="19" rx="9" fill="#3B2014" />
      <polygon points="48,138 172,138 112,153" fill="${cheeseColor}" />
    `
    : '';

  const bottomBunY = isTriple ? 160 : 144;
  const viewBoxHeight = isTriple ? 190 : 175;

  return `
    <svg viewBox="0 0 220 ${viewBoxHeight}" role="img" aria-label="${escapeHTML(item.name)}">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#D9822B" />
          <stop offset="100%" stop-color="#9E5216" />
        </linearGradient>
      </defs>

      <!-- Pan superior -->
      <path d="M42 64 C42 28 178 28 178 64 Z" fill="url(#${gradId})" />
      <!-- Semillas de sésamo -->
      <ellipse cx="86" cy="42" rx="3" ry="1.6" fill="#F8E7C1" transform="rotate(-18 86 42)" />
      <ellipse cx="112" cy="37" rx="3" ry="1.6" fill="#F8E7C1" />
      <ellipse cx="138" cy="43" rx="3" ry="1.6" fill="#F8E7C1" transform="rotate(18 138 43)" />
      <ellipse cx="98" cy="51" rx="3" ry="1.6" fill="#F8E7C1" transform="rotate(-10 98 51)" />
      <ellipse cx="126" cy="51" rx="3" ry="1.6" fill="#F8E7C1" transform="rotate(12 126 51)" />

      <!-- Salsa superior -->
      <path d="M46 66 Q75 74 110 67 T174 66" stroke="${sauceColor}" stroke-width="7" stroke-linecap="round" fill="none" />

      <!-- Cebolla fresca brunoise -->
      ${
        layers.dicedOnion
          ? `<g fill="#F8F8F8">
              <rect x="64" y="64" width="6" height="6" rx="1" />
              <rect x="82" y="66" width="6" height="6" rx="1" />
              <rect x="104" y="64" width="6" height="6" rx="1" />
              <rect x="126" y="66" width="6" height="6" rx="1" />
              <rect x="148" y="64" width="6" height="6" rx="1" />
            </g>`
          : ''
      }

      <!-- Cebolla caramelizada -->
      ${
        layers.caramelOnion
          ? `<path d="M48 73 Q80 65 110 73 T172 73" stroke="#6E3B1E" stroke-width="7" stroke-linecap="round" fill="none" />`
          : ''
      }

      <!-- Cebolla crispy -->
      ${
        layers.crispyOnion
          ? `<path d="M46 73 L64 67 L82 75 L102 66 L122 75 L142 67 L162 74 L175 68" stroke="#C67D30" stroke-width="5.5" stroke-linecap="round" fill="none" />`
          : ''
      }

      <!-- Lechuga y Tomate (Americana) -->
      ${
        layers.lettuce
          ? `<path d="M40 77 Q58 70 76 77 T112 77 T148 77 T180 77" stroke="#4CA626" stroke-width="7" stroke-linecap="round" fill="none" />`
          : ''
      }
      ${layers.tomato ? `<rect x="48" y="81" width="124" height="6" rx="3" fill="#D92B2B" />` : ''}

      <!-- Huevo frito -->
      ${
        layers.egg
          ? `<g>
              <ellipse cx="110" cy="84" rx="56" ry="7" fill="#FFFFFF" />
              <ellipse cx="110" cy="81" rx="16" ry="7" fill="#FFB703" />
            </g>`
          : ''
      }

      <!-- Bacon ahumado -->
      ${
        layers.bacon
          ? `<path d="M42 90 Q76 84 110 90 T178 90" stroke="#7A2018" stroke-width="7" stroke-linecap="round" fill="none" />`
          : ''
      }

      <!-- Primer medallón + Queso fundido -->
      <rect x="44" y="93" width="132" height="19" rx="9" fill="#3B2014" />
      <polygon points="48,93 172,93 110,109" fill="${cheeseColor}" />

      <!-- Segundo medallón + Queso fundido -->
      <rect x="44" y="116" width="132" height="19" rx="9" fill="#321A10" />
      <polygon points="48,116 172,116 135,131 85,131" fill="${cheeseColor}" />

      <!-- Tercer medallón opcional (Triple) -->
      ${extraPattySVG}

      <!-- Pepinillos (7th Street) -->
      ${
        layers.pickles
          ? `<g fill="#4F772D">
              <rect x="52" y="${bottomBunY - 6}" width="32" height="5" rx="2.5" />
              <rect x="94" y="${bottomBunY - 6}" width="32" height="5" rx="2.5" />
              <rect x="136" y="${bottomBunY - 6}" width="32" height="5" rx="2.5" />
            </g>`
          : ''
      }

      <!-- Pan inferior -->
      <rect x="45" y="${bottomBunY}" width="130" height="18" rx="8" fill="#B5651D" />
    </svg>
  `;
}

/** Devuelve la foto real (si está activada) o la ilustración. Si la foto no existe, se cae a la ilustración. */
function visualHTML(item, isTriple, prefix) {
  if (SITE.usePhotos) {
    const src = `assets/burgers/${encodeURIComponent(item.id)}.${SITE.photoExtension || 'jpg'}`;
    return `<img class="item-photo" src="${src}" alt="${escapeHTML(item.name)}" loading="lazy"
      data-fallback-id="${escapeHTML(item.id)}" data-fallback-triple="${isTriple}" data-fallback-prefix="${prefix}" />`;
  }
  return createBurgerSVG(item, isTriple, prefix);
}

document.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('item-photo')) return;
    const item = findItem(img.dataset.fallbackId);
    if (!item) return;
    img.outerHTML = createBurgerSVG(item, img.dataset.fallbackTriple === 'true', img.dataset.fallbackPrefix || 'card');
  },
  true
);

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function renderHeroShowcase() {
  const burgers = MENU_ITEMS.filter((item) => item.isBurger);
  const current = burgers[state.heroIndex % burgers.length];

  const visualEl = document.getElementById('heroBurgerVisual');
  const nameEl = document.getElementById('heroBurgerName');
  const priceEl = document.getElementById('heroBurgerPrice');
  const descEl = document.getElementById('heroBurgerDesc');
  const dotsEl = document.getElementById('heroDots');

  if (!visualEl || !current) return;

  visualEl.innerHTML = visualHTML(current, false, 'hero');
  nameEl.textContent = current.name;
  priceEl.textContent = formatARS(current.basePrice);
  descEl.textContent = current.ingredients;

  dotsEl.innerHTML = burgers
    .map(
      (b, idx) =>
        `<button type="button" class="story-dot ${idx === state.heroIndex ? 'is-active' : ''}" data-hero-dot="${idx}" aria-label="Ver ${escapeHTML(b.name)}"></button>`
    )
    .join('');
}

// ---------------------------------------------------------------------------
// Carta
// ---------------------------------------------------------------------------

function cardHTML(item, animate = false) {
  const selectedSize = state.selectedSizes[item.id] || 'doble';
  const isTriple = item.isBurger && selectedSize === 'triple';
  const finalPrice = item.basePrice + (isTriple ? SITE.tripleExtraPrice : 0);

  const sizeSelectorHTML = item.isBurger
    ? `
      <div class="size-selector" role="group" aria-label="Tamaño de ${escapeHTML(item.name)}">
        <button type="button" class="size-btn ${!isTriple ? 'is-active' : ''}" data-size-id="${item.id}" data-size="doble" aria-pressed="${!isTriple}">
          Doble (x4 Queso)
        </button>
        <button type="button" class="size-btn ${isTriple ? 'is-active' : ''}" data-size-id="${item.id}" data-size="triple" aria-pressed="${isTriple}">
          Triple (+${formatARS(SITE.tripleExtraPrice)})
        </button>
      </div>
    `
    : '';

  return `
    <article class="burger-card${animate ? ' is-entering' : ''}" data-card-id="${item.id}">
      <div>
        <div class="burger-card__top">
          <span class="burger-card__badge">${escapeHTML(item.badge)}</span>
        </div>
        <div class="burger-card__visual">
          ${visualHTML(item, isTriple, 'card')}
        </div>
        <h3 class="burger-card__title">${escapeHTML(item.name)}</h3>
        <p class="burger-card__ingredients">${escapeHTML(item.ingredients)}</p>
      </div>

      <div>
        ${sizeSelectorHTML}
        <div class="burger-card__footer">
          <span class="burger-card__price">${formatARS(finalPrice)}</span>
          <button type="button" class="btn-add" data-add-id="${item.id}">+ Agregar</button>
        </div>
      </div>
    </article>
  `;
}

function renderMenuGrid() {
  const gridEl = document.getElementById('menuGrid');
  if (!gridEl) return;

  const query = state.search.trim().toLowerCase();

  const filtered = MENU_ITEMS.filter((item) => {
    const matchesCategory = state.filter === 'all' || item.category === state.filter;
    const matchesSearch =
      !query || item.name.toLowerCase().includes(query) || item.ingredients.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    gridEl.innerHTML = `
      <div class="menu-empty">
        <p>No encontramos productos con "<strong>${escapeHTML(state.search)}</strong>".</p>
        <p>Probá buscando por <em>bacon, provolone, cheddar, alioli</em> o <em>papas</em>.</p>
      </div>
    `;
    return;
  }

  gridEl.innerHTML = filtered.map((item) => cardHTML(item, true)).join('');
}

/** Cambia Doble/Triple actualizando solo esa tarjeta (sin redibujar toda la grilla). */
function updateSingleCard(itemId) {
  const item = findItem(itemId);
  const card = document.querySelector(`#menuGrid [data-card-id="${itemId}"]`);
  if (!item || !card) return;
  card.outerHTML = cardHTML(item, false);
}

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------

function flashAdded(btn) {
  if (!btn || btn.dataset.flashing) return;
  const original = btn.textContent;
  btn.dataset.flashing = '1';
  btn.textContent = '✓ Agregada';
  btn.classList.add('is-added');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('is-added');
    delete btn.dataset.flashing;
  }, 900);
}

function bumpCartBadge() {
  const badge = document.getElementById('cartCountBadge');
  if (!badge) return;
  badge.classList.remove('is-bump');
  void badge.offsetWidth; // reinicia la animación
  badge.classList.add('is-bump');
}

/** Pelotita que vuela desde el botón "Agregar" hasta el carrito. */
function flyToCart(fromEl) {
  const target = document.getElementById('openCartBtn');
  if (!fromEl || !target || prefersReducedMotion || !fromEl.isConnected) return;

  const a = fromEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dot = document.createElement('span');
  dot.className = 'fly-dot';
  dot.style.left = a.left + a.width / 2 - 8 + 'px';
  dot.style.top = a.top + a.height / 2 - 8 + 'px';
  document.body.appendChild(dot);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = dot.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.5 },
    ],
    { duration: 620, easing: 'cubic-bezier(0.5, -0.15, 0.75, 0.45)' }
  );
  anim.onfinish = () => {
    dot.remove();
    bumpCartBadge();
  };
}

function addToCart(itemId, forcedSize = null, sourceEl = null) {
  const item = findItem(itemId);
  if (!item) return;

  const size = item.isBurger ? forcedSize || state.selectedSizes[item.id] || 'doble' : 'unico';
  const unitPrice = item.basePrice + (size === 'triple' ? SITE.tripleExtraPrice : 0);
  const cartKey = `${item.id}__${size}`;

  const existing = state.cart.find((c) => c.key === cartKey);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      key: cartKey,
      id: item.id,
      name: item.name,
      sizeLabel: item.isBurger ? (size === 'triple' ? 'Triple (x6 Queso)' : 'Doble (x4 Queso)') : 'Porción / Unidad',
      unitPrice,
      qty: 1,
      note: '',
    });
  }

  saveCartToStorage();
  renderCart();
  flashAdded(sourceEl);
  flyToCart(sourceEl);
  if (prefersReducedMotion) bumpCartBadge();
  showToast(`✓ ${item.name} agregada al pedido`);
  track('add_to_cart', { item_id: item.id, item_name: item.name, value: unitPrice, currency: 'ARS' });
}

function updateCartQty(cartKey, delta) {
  const index = state.cart.findIndex((c) => c.key === cartKey);
  if (index === -1) return;

  state.cart[index].qty += delta;
  if (state.cart[index].qty <= 0) state.cart.splice(index, 1);

  saveCartToStorage();
  renderCart();
}

function removeFromCart(cartKey) {
  state.cart = state.cart.filter((c) => c.key !== cartKey);
  saveCartToStorage();
  renderCart();
}

function setCartNote(cartKey, value) {
  const line = state.cart.find((c) => c.key === cartKey);
  if (!line) return;
  line.note = value.slice(0, 140);
  saveCartToStorage(); // sin re-render, para no perder el foco mientras se escribe
}

function getTotals() {
  const subtotal = state.cart.reduce((acc, item) => acc + item.unitPrice * item.qty, 0);
  const isDelivery = state.deliveryMode === 'delivery';
  const feeKnown = isDelivery && typeof SITE.delivery?.fee === 'number';
  const shipping = feeKnown ? SITE.delivery.fee : 0;
  return { subtotal, isDelivery, feeKnown, shipping, total: subtotal + shipping };
}

function upsellHTML() {
  const hasBurger = state.cart.some((c) => findItem(c.id)?.isBurger);
  if (!hasBurger) return '';

  const inCart = new Set(state.cart.map((c) => c.id));
  const picks = (SITE.upsellIds || [])
    .map(findItem)
    .filter((m) => m && !inCart.has(m.id))
    .slice(0, 3);
  if (picks.length === 0) return '';

  return `
    <div class="upsell">
      <h4 class="upsell__title">Sumá algo más a tu pedido</h4>
      ${picks
        .map(
          (m) => `
        <div class="upsell__item">
          <span class="upsell__emoji" aria-hidden="true">${m.icon || '🍔'}</span>
          <span class="upsell__info"><strong>${escapeHTML(m.name)}</strong><small>${formatARS(m.basePrice)}</small></span>
          <button type="button" class="upsell__btn" data-add-id="${m.id}" aria-label="Agregar ${escapeHTML(m.name)}">+ Agregar</button>
        </div>`
        )
        .join('')}
    </div>
  `;
}

function renderCart() {
  const container = document.getElementById('cartItemsContainer');
  const badge = document.getElementById('cartCountBadge');
  const subtotalEl = document.getElementById('cartSubtotal');
  const totalEl = document.getElementById('cartTotal');
  const shippingRow = document.getElementById('cartShippingRow');
  const shippingEl = document.getElementById('cartShipping');

  const totalUnits = state.cart.reduce((acc, item) => acc + item.qty, 0);
  const totals = getTotals();

  if (badge) badge.textContent = String(totalUnits);
  if (subtotalEl) subtotalEl.textContent = formatARS(totals.subtotal);
  if (totalEl) totalEl.textContent = formatARS(totals.total);
  if (shippingRow) shippingRow.hidden = !totals.isDelivery;
  if (shippingEl) {
    shippingEl.textContent = totals.feeKnown ? (totals.shipping === 0 ? 'Sin cargo' : formatARS(totals.shipping)) : 'A confirmar por WhatsApp';
  }

  updateMobileBar(totalUnits, totals.total);

  if (!container) return;

  if (state.cart.length === 0) {
    const burgersCount = MENU_ITEMS.filter((i) => i.isBurger).length;
    container.innerHTML = `
      <div class="cart-empty">
        <p><strong>Tu pedido está vacío</strong></p>
        <p>Elegí cualquiera de nuestras ${burgersCount} burgers oficiales para empezar.</p>
      </div>
    `;
    return;
  }

  container.innerHTML =
    state.cart
      .map(
        (item) => `
        <div class="cart-item">
          <div class="cart-item__row">
            <div class="cart-item__info">
              <h4>${escapeHTML(item.name)}</h4>
              <span class="cart-item__meta">${escapeHTML(item.sizeLabel)} · ${formatARS(item.unitPrice * item.qty)}</span>
            </div>
            <div class="cart-item__controls">
              <button type="button" class="qty-btn" data-qty-key="${escapeHTML(item.key)}" data-delta="-1" aria-label="Restar unidad de ${escapeHTML(item.name)}">−</button>
              <strong aria-live="polite">${item.qty}</strong>
              <button type="button" class="qty-btn" data-qty-key="${escapeHTML(item.key)}" data-delta="1" aria-label="Sumar unidad de ${escapeHTML(item.name)}">+</button>
              <button type="button" class="qty-btn qty-btn--remove" data-remove-key="${escapeHTML(item.key)}" aria-label="Quitar ${escapeHTML(item.name)} del pedido">✕</button>
            </div>
          </div>
          <input type="text" class="cart-item__note" maxlength="140" data-note-key="${escapeHTML(item.key)}"
            value="${escapeHTML(item.note || '')}" placeholder="Aclaración (ej. sin pepinillos, punto de carne)" aria-label="Aclaración para ${escapeHTML(item.name)}" />
        </div>
      `
      )
      .join('') + upsellHTML();
}

// ---------------------------------------------------------------------------
// Barra de pedido fija en móvil
// ---------------------------------------------------------------------------

function isDrawerOpen() {
  return document.getElementById('cartDrawer')?.classList.contains('is-open') || false;
}

function updateMobileBar(totalUnits, totalAmount) {
  const bar = document.getElementById('mobileCartBar');
  if (!bar) return;

  const units = totalUnits ?? state.cart.reduce((acc, item) => acc + item.qty, 0);
  const amount = totalAmount ?? getTotals().total;
  const visible = units > 0 && !isDrawerOpen();

  bar.hidden = !visible;
  document.body.classList.toggle('has-cart-bar', visible);

  const countEl = document.getElementById('mobileCartCount');
  const totalEl = document.getElementById('mobileCartTotal');
  if (countEl) countEl.textContent = `${units} ${units === 1 ? 'producto' : 'productos'}`;
  if (totalEl) totalEl.textContent = formatARS(amount);
}

// ---------------------------------------------------------------------------
// Pedido por WhatsApp
// ---------------------------------------------------------------------------

function buildWhatsAppOrderText() {
  const name = document.getElementById('customerName')?.value.trim() || 'Sin nombre';
  const address = document.getElementById('customerAddress')?.value.trim();
  const payment = document.getElementById('paymentMethod')?.value || 'Efectivo';
  const notes = document.getElementById('orderNotes')?.value.trim();
  const totals = getTotals();

  const lines = [
    '🍔 *NUEVO PEDIDO — BUENARDA PARANÁ*',
    `👤 *Cliente:* ${name}`,
    totals.isDelivery
      ? `🛵 *Modalidad:* Delivery (${address || 'Dirección a confirmar'})`
      : '🏪 *Modalidad:* Retiro en Colón 696 - Paraná',
    `💳 *Pago:* ${payment}`,
    '',
    '*Detalle del pedido:*',
  ];

  state.cart.forEach((item) => {
    lines.push(`• ${item.qty}x ${item.name} (${item.sizeLabel}) — ${formatARS(item.unitPrice * item.qty)}`);
    if (item.note) lines.push(`   ↳ _${item.note}_`);
  });

  lines.push('');
  lines.push(`🧾 *Subtotal:* ${formatARS(totals.subtotal)}`);
  if (totals.isDelivery) {
    lines.push(
      `🛵 *Envío:* ${totals.feeKnown ? (totals.shipping === 0 ? 'Sin cargo' : formatARS(totals.shipping)) : 'a confirmar'}`
    );
  }
  lines.push(`💰 *TOTAL ESTIMADO:* ${formatARS(totals.total)}`);

  if (notes) lines.push(`📝 *Notas:* ${notes}`);

  return lines.join('\n');
}

function markInvalid(el, message) {
  el.classList.add('is-invalid');
  el.setAttribute('aria-invalid', 'true');
  el.focus();
  showToast(message);
}

function validateOrder() {
  const nameEl = document.getElementById('customerName');
  const addressEl = document.getElementById('customerAddress');

  [nameEl, addressEl].forEach((el) => {
    el?.classList.remove('is-invalid');
    el?.removeAttribute('aria-invalid');
  });

  if (nameEl && nameEl.value.trim().length < 2) {
    markInvalid(nameEl, 'Escribí tu nombre para el pedido');
    return false;
  }
  if (state.deliveryMode === 'delivery' && addressEl && addressEl.value.trim().length < 5) {
    markInvalid(addressEl, 'Escribí la dirección de entrega (calle y número)');
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Drawer del carrito (accesible: Esc, foco atrapado, inert)
// ---------------------------------------------------------------------------

let lastFocusedBeforeDrawer = null;

function openCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (!drawer || !overlay) return;

  lastFocusedBeforeDrawer = document.activeElement;
  overlay.hidden = false;
  drawer.inert = false;
  drawer.setAttribute('aria-hidden', 'false');
  drawer.classList.add('is-open');
  document.body.classList.add('no-scroll');
  document.getElementById('closeCartBtn')?.focus();
  updateMobileBar();
  track('open_cart', { items: state.cart.length });
}

function closeCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (!drawer || !overlay || !drawer.classList.contains('is-open')) return;

  overlay.hidden = true;
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.inert = true;
  document.body.classList.remove('no-scroll');
  updateMobileBar();
  if (lastFocusedBeforeDrawer && document.contains(lastFocusedBeforeDrawer)) lastFocusedBeforeDrawer.focus();
}

function trapFocusInDrawer(e) {
  const drawer = document.getElementById('cartDrawer');
  const focusable = [
    ...drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
  ].filter((el) => !el.disabled && !el.hidden && el.getClientRects().length > 0);
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

let toastTimer = null;
function showToast(message) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('is-visible');
  }, 2400);
}

// ---------------------------------------------------------------------------
// Video "Recorrido por el local"
// ---------------------------------------------------------------------------

/**
 * - Arranca solo (sin sonido) al entrar en pantalla y se pausa al salir.
 * - Respeta "reducir movimiento": en ese caso solo reproduce si el usuario lo pide.
 * - Si el usuario lo pausa a mano, no se vuelve a reproducir solo.
 */
function initTourVideo() {
  const player = document.getElementById('tourPlayer');
  const video = document.getElementById('tourVideo');
  if (!player || !video) return;

  const playBtn = document.getElementById('tourPlayBtn');
  const toggleBtn = document.getElementById('tourToggleBtn');
  const soundBtn = document.getElementById('tourSoundBtn');
  const soundLabel = document.getElementById('tourSoundLabel');
  const progress = document.getElementById('tourProgress');
  const progressFill = document.getElementById('tourProgressFill');

  let pausedByUser = false;

  const safePlay = () => {
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
  };

  const userToggle = () => {
    if (video.paused) {
      pausedByUser = false;
      safePlay();
    } else {
      pausedByUser = true;
      video.pause();
    }
  };

  const syncPlayState = () => {
    const playing = !video.paused && !video.ended;
    player.classList.toggle('is-playing', playing);
    toggleBtn.setAttribute('aria-label', playing ? 'Pausar video' : 'Reproducir video');
  };

  const syncSoundState = () => {
    const unmuted = !video.muted;
    player.classList.toggle('is-unmuted', unmuted);
    soundBtn.setAttribute('aria-pressed', String(unmuted));
    soundBtn.setAttribute('aria-label', unmuted ? 'Silenciar video' : 'Activar sonido');
    if (soundLabel) soundLabel.textContent = unmuted ? 'Silenciar' : 'Activar sonido';
  };

  playBtn.addEventListener('click', userToggle);
  toggleBtn.addEventListener('click', userToggle);
  video.addEventListener('click', userToggle);

  soundBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted) {
      track('tour_video_sound_on');
      if (video.paused) {
        pausedByUser = false;
        safePlay();
      }
    }
  });

  video.addEventListener('play', syncPlayState);
  video.addEventListener('pause', syncPlayState);
  video.addEventListener('ended', syncPlayState);
  video.addEventListener('volumechange', syncSoundState);

  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    progressFill.style.width = pct + '%';
    progress.setAttribute('aria-valuenow', String(Math.round(pct)));
  });

  progress.addEventListener('click', (e) => {
    if (!video.duration) return;
    const rect = progress.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
  });

  // Reproducir al entrar en pantalla, pausar al salir (ahorra datos y evita audio fuera de vista)
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (!prefersReducedMotion && !pausedByUser) safePlay();
          } else if (!video.paused) {
            video.pause();
          }
        });
      },
      { threshold: [0, 0.5] }
    );
    observer.observe(player);
  }

  syncPlayState();
  syncSoundState();
}

// ---------------------------------------------------------------------------
// Reseñas, animaciones de entrada y datos dinámicos
// ---------------------------------------------------------------------------

function renderReviews() {
  const section = document.getElementById('resenas');
  const list = document.getElementById('reviewsList');
  if (!section || !list) return;

  if (!Array.isArray(REVIEWS) || REVIEWS.length === 0) {
    section.hidden = true;
    return;
  }

  list.innerHTML = REVIEWS.map(
    (r) => `
      <figure class="review-card reveal">
        <blockquote>“${escapeHTML(r.text)}”</blockquote>
        <figcaption><strong>${escapeHTML(r.name)}</strong>${r.source ? ` · ${escapeHTML(r.source)}` : ''}</figcaption>
      </figure>`
  ).join('');
  section.hidden = false;
}

function initReveal() {
  const targets = document.querySelectorAll('.reveal:not(.is-visible)');
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  targets.forEach((el) => observer.observe(el));
}

function bindSiteData() {
  document.querySelectorAll('[data-bind="igShort"]').forEach((el) => {
    el.textContent = SITE.instagramFollowers.short;
  });
  document.querySelectorAll('[data-bind="igLong"]').forEach((el) => {
    el.textContent = SITE.instagramFollowers.long;
  });
}

function syncNavHeight() {
  const nav = document.getElementById('navbar');
  if (nav) document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');
}

// ---------------------------------------------------------------------------
// Inicialización
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initReveal(); // primero: así ninguna falla posterior deja contenido invisible
  bindSiteData();
  renderOpenStatus();
  setInterval(renderOpenStatus, 60 * 1000);
  renderHeroShowcase();
  renderMenuGrid();
  renderCart();
  renderReviews();
  initReveal(); // vuelve a observar las reseñas recién creadas
  initTourVideo();

  syncNavHeight();
  window.addEventListener('resize', syncNavHeight);
  if (document.fonts?.ready) document.fonts.ready.then(syncNavHeight);

  const burgersCount = MENU_ITEMS.filter((i) => i.isBurger).length;

  // Hero
  document.getElementById('prevHeroBurger')?.addEventListener('click', () => {
    state.heroIndex = (state.heroIndex - 1 + burgersCount) % burgersCount;
    renderHeroShowcase();
  });

  document.getElementById('nextHeroBurger')?.addEventListener('click', () => {
    state.heroIndex = (state.heroIndex + 1) % burgersCount;
    renderHeroShowcase();
  });

  document.getElementById('heroDots')?.addEventListener('click', (e) => {
    const dot = e.target.closest('[data-hero-dot]');
    if (!dot) return;
    state.heroIndex = Number(dot.dataset.heroDot);
    renderHeroShowcase();
  });

  document.getElementById('addHeroBurgerBtn')?.addEventListener('click', (e) => {
    const burgers = MENU_ITEMS.filter((i) => i.isBurger);
    const current = burgers[state.heroIndex % burgers.length];
    if (current) addToCart(current.id, 'doble', e.currentTarget);
  });

  // Filtros de categoría
  document.getElementById('filterTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-filter]');
    if (!tab) return;
    state.filter = tab.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach((btn) => btn.classList.remove('is-active'));
    tab.classList.add('is-active');
    renderMenuGrid();
  });

  // Búsqueda por texto
  document.getElementById('menuSearchInput')?.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderMenuGrid();
  });

  // Grilla de productos (Tamaño Doble/Triple y Agregar)
  document.getElementById('menuGrid')?.addEventListener('click', (e) => {
    const sizeBtn = e.target.closest('[data-size-id]');
    if (sizeBtn) {
      state.selectedSizes[sizeBtn.dataset.sizeId] = sizeBtn.dataset.size;
      updateSingleCard(sizeBtn.dataset.sizeId);
      return;
    }

    const addBtn = e.target.closest('[data-add-id]');
    if (addBtn) addToCart(addBtn.dataset.addId, null, addBtn);
  });

  // Abrir / cerrar carrito
  document.getElementById('openCartBtn')?.addEventListener('click', openCartDrawer);
  document.getElementById('mobileCartBar')?.addEventListener('click', openCartDrawer);
  document.getElementById('closeCartBtn')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCartDrawer);

  // Contenido del carrito: cantidades, quitar, sugerencias y aclaraciones
  const cartContainer = document.getElementById('cartItemsContainer');
  cartContainer?.addEventListener('click', (e) => {
    const qtyBtn = e.target.closest('[data-qty-key]');
    if (qtyBtn) {
      updateCartQty(qtyBtn.dataset.qtyKey, Number(qtyBtn.dataset.delta));
      return;
    }
    const removeBtn = e.target.closest('[data-remove-key]');
    if (removeBtn) {
      removeFromCart(removeBtn.dataset.removeKey);
      return;
    }
    const addBtn = e.target.closest('[data-add-id]');
    if (addBtn) addToCart(addBtn.dataset.addId, null, null);
  });
  cartContainer?.addEventListener('input', (e) => {
    const noteInput = e.target.closest('[data-note-key]');
    if (noteInput) setCartNote(noteInput.dataset.noteKey, noteInput.value);
  });

  // Datos del cliente (se recuerdan para el próximo pedido)
  const customer = loadCustomer();
  const nameEl = document.getElementById('customerName');
  const addressEl = document.getElementById('customerAddress');
  const paymentEl = document.getElementById('paymentMethod');
  if (nameEl && customer.name) nameEl.value = customer.name;
  if (addressEl && customer.address) addressEl.value = customer.address;
  if (paymentEl && customer.payment && [...paymentEl.options].some((o) => o.value === customer.payment)) {
    paymentEl.value = customer.payment;
  }
  [nameEl, addressEl, paymentEl].forEach((el) => {
    el?.addEventListener('input', () => {
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
      saveCustomer();
    });
    el?.addEventListener('change', saveCustomer);
  });

  // Retiro / Delivery
  document.querySelectorAll('.delivery-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.deliveryMode = btn.dataset.delivery;
      document.querySelectorAll('.delivery-btn').forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      if (addressEl) {
        addressEl.hidden = state.deliveryMode !== 'delivery';
        addressEl.classList.remove('is-invalid');
      }
      renderCart();
    });
  });

  // Enviar por WhatsApp
  document.getElementById('sendWhatsappBtn')?.addEventListener('click', () => {
    if (state.cart.length === 0) {
      showToast('Agregá al menos un producto al pedido');
      return;
    }
    if (!validateOrder()) return;

    const totals = getTotals();
    const text = buildWhatsAppOrderText();
    const url = `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(text)}`;
    track('send_whatsapp_order', {
      value: totals.total,
      currency: 'ARS',
      items: state.cart.reduce((acc, i) => acc + i.qty, 0),
      mode: state.deliveryMode,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  // Copiar detalle del pedido
  document.getElementById('copyOrderBtn')?.addEventListener('click', async () => {
    if (state.cart.length === 0) {
      showToast('Tu pedido está vacío');
      return;
    }
    try {
      await navigator.clipboard.writeText(buildWhatsAppOrderText());
      showToast('✓ Pedido copiado al portapapeles');
      track('copy_order');
    } catch {
      showToast('No se pudo copiar automáticamente');
    }
  });

  // Menú móvil
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');
  const setMobileMenu = (open) => {
    navLinks.classList.toggle('is-open', open);
    mobileBtn.setAttribute('aria-expanded', String(open));
  };
  mobileBtn?.addEventListener('click', () => setMobileMenu(!navLinks.classList.contains('is-open')));
  navLinks?.addEventListener('click', (e) => {
    if (e.target.closest('a')) setMobileMenu(false);
  });

  // Teclado: Esc cierra carrito / menú, Tab queda dentro del carrito mientras está abierto
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isDrawerOpen()) closeCartDrawer();
      else if (navLinks?.classList.contains('is-open')) {
        setMobileMenu(false);
        mobileBtn?.focus();
      }
    } else if (e.key === 'Tab' && isDrawerOpen()) {
      trapFocusInDrawer(e);
    }
  });
});
