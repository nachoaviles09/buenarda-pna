'use strict';

/**
 * BUENARDA (@buenardaparana) — Lógica de Carta, Pedido Grupal, Zonas, Ticket Térmico y Sync Sheets
 */

const STORAGE_KEY = 'buenarda_cart_v4';
const FORM_STORAGE_KEY = 'buenarda_checkout_v4';
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  filter: 'all',
  search: '',
  heroIndex: 0,
  selectedSizes: {}, // { [itemId]: 'doble' | 'triple' }
  cart: [], // [{ key, id, size, qty, person, note }]
  deliveryMode: 'retiro', // 'retiro' | 'delivery'
  deliveryZoneId: '',
  lastFocused: null,
};

let deliveryZones = Array.isArray(window.DELIVERY_ZONES) ? [...DELIVERY_ZONES] : [];

// ============================================================================
// UTILIDADES
// ============================================================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function formatARS(value) {
  return '$' + Math.round(Number(value) || 0).toLocaleString('es-AR');
}

function escapeHTML(str) {
  const map = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": ''',
  };
  return String(str ?? '').replace(/[&<>"']/g, (ch) => map[ch]);
}

function normalizeText(str) {
  return String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function track(eventName, params = {}) {
  try {
    if (typeof window.gtag === 'function') window.gtag('event', eventName, params);
    if (typeof window.fbq === 'function') window.fbq('trackCustom', eventName, params);
    window.dispatchEvent(new CustomEvent('buenarda:track', { detail: { name: eventName, params } }));
  } catch {
    // No interrumpir si no hay analytics configurado
  }
}

let toastTimer = null;
function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2600);
}

function getAllCatalogItems() {
  const list = [...MENU_ITEMS];
  if (SITE.promo && SITE.promo.active) {
    list.push({
      id: SITE.promo.id || 'promo-noche',
      name: SITE.promo.title || 'COMBO DE LA NOCHE',
      category: 'promos',
      badge: SITE.promo.badge || 'Promo',
      isBurger: false,
      isPromo: true,
      basePrice: Number(SITE.promo.price) || 0,
      ingredients: SITE.promo.subtitle || '',
      icon: SITE.promo.icon || '🔥',
      available: true,
    });
  }
  return list;
}

function getItemById(id) {
  return getAllCatalogItems().find((item) => item.id === id);
}

function isItemAvailable(item) {
  return Boolean(item) && item.available !== false;
}

function getUnitPrice(item, size) {
  if (!item) return 0;
  if (!item.isBurger) return item.basePrice;
  return size === 'triple' ? item.basePrice + SITE.tripleExtraPrice : item.basePrice;
}

function getSizeLabel(item, size) {
  if (!item || !item.isBurger) return item?.isPromo ? 'Combo Especial' : 'Porción / Unidad';
  return size === 'triple' ? 'Triple (x6 Queso)' : 'Doble (x4 Queso)';
}

function getSelectedZone() {
  if (!deliveryZones.length) return null;
  return deliveryZones.find((z) => z.id === state.deliveryZoneId) || deliveryZones[0];
}

function getShippingFee() {
  if (state.deliveryMode !== 'delivery') return 0;
  if (deliveryZones.length > 0) {
    const zone = getSelectedZone();
    return zone && typeof zone.fee === 'number' ? zone.fee : null;
  }
  return typeof SITE.delivery?.fee === 'number' ? SITE.delivery.fee : null;
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `rgba(245, 183, 0, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenHex(hex, amount = 26) {
  const clean = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#ffca28';
  const clamp = (n) => Math.max(0, Math.min(255, n));
  const r = clamp(parseInt(clean.slice(0, 2), 16) + amount);
  const g = clamp(parseInt(clean.slice(2, 4), 16) + amount);
  const b = clamp(parseInt(clean.slice(4, 6), 16) + amount);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function createOrderMeta(now = new Date()) {
  const num = Math.floor(1000 + Math.random() * 9000);
  const code = `BN-${num}`;

  const dateStr = new Intl.DateTimeFormat('es-AR', {
    timeZone: SITE.timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now);

  const timeStr = new Intl.DateTimeFormat('es-AR', {
    timeZone: SITE.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);

  return { code, dateStr, timeStr };
}

// ============================================================================
// IDENTIDAD DE MARCA Y TEMA DINÁMICO (PLANTILLA REUTILIZABLE)
// ============================================================================

function applyPrimaryColor(hexColor) {
  if (!hexColor || !/^#[0-9a-fA-F]{6}$/.test(hexColor.trim())) return;
  const color = hexColor.trim();
  const root = document.documentElement;
  root.style.setProperty('--cheddar', color);
  root.style.setProperty('--cheddar-hover', lightenHex(color, 24));
  root.style.setProperty('--cheddar-soft', hexToRgba(color, 0.14));
}

function applyBrandBindings() {
  const b = SITE.brand || {};
  const map = {
    brandName: b.name || 'BUENARDA',
    brandHandle: b.handle || '@buenardaparana',
    brandHandleUpper: (b.handle || '@buenardaparana').toUpperCase(),
    tagline: b.tagline || 'Hamburguesas de alta calidad | 100% Carne',
    cityUpper: (b.city || 'Paraná · Entre Ríos').toUpperCase(),
    streetOnly: b.streetOnly || 'Colón 696',
    streetOnlyUpper: (b.streetOnly || 'Colón 696').toUpperCase(),
    shortAddress: b.shortAddress || 'Colón 696 — Paraná',
    fullAddress: b.fullAddress || 'Colón 696, E3100 Paraná, Entre Ríos',
    marqueeLocation: (b.shortAddress || 'COLÓN 696 · PARANÁ').toUpperCase(),
    hoursLabel: SITE.hours?.label || 'Mié a Dom 20:00 a 00:00 hs',
    hoursFullLabel: SITE.hours?.fullLabel || 'Miércoles a Domingo · 20:00 a 00:00 hs',
    igShort: SITE.instagramFollowers?.short || '+17.5K',
    igLong: SITE.instagramFollowers?.long || '17,5 mil',
  };

  $$('[data-bind]').forEach((el) => {
    const key = el.dataset.bind;
    if (map[key] !== undefined) el.textContent = map[key];
  });

  $$('[data-bind-href]').forEach((el) => {
    const key = el.dataset.bindHref;
    if (b[key]) el.setAttribute('href', b[key]);
  });

  const mapFrame = $('#locationMapFrame');
  if (mapFrame && b.mapsEmbedUrl && mapFrame.src !== b.mapsEmbedUrl) {
    mapFrame.src = b.mapsEmbedUrl;
  }

  if (b.name) {
    document.title = `${b.name} | ${b.tagline || 'Hamburguesas de Alta Calidad'}`;
  }

  if (b.primaryColor) {
    applyPrimaryColor(b.primaryColor);
  }

  const burgersCount = $('#heroBurgersCount');
  if (burgersCount) {
    burgersCount.textContent = String(MENU_ITEMS.filter((i) => i.isBurger).length);
  }
}

function syncNavHeight() {
  const nav = $('#navbar');
  if (nav) {
    document.documentElement.style.setProperty('--nav-h', `${nav.offsetHeight}px`);
  }
}

// ============================================================================
// PROMO / COMBO DE LA NOCHE
// ============================================================================

function renderNightPromo() {
  const card = $('#nightPromoCard');
  if (!card) return;
  const promo = SITE.promo;
  if (!promo || !promo.active) {
    card.hidden = true;
    return;
  }

  card.hidden = false;
  const badgeEl = $('#nightPromoBadge');
  const titleEl = $('#nightPromoTitle');
  const subEl = $('#nightPromoSubtitle');
  const oldEl = $('#nightPromoOldPrice');
  const priceEl = $('#nightPromoPrice');

  if (badgeEl) badgeEl.textContent = promo.badge || '🔥 PROMO DE LA NOCHE';
  if (titleEl) titleEl.textContent = promo.title || 'COMBO DE LA NOCHE';
  if (subEl) subEl.textContent = promo.subtitle || '';
  if (priceEl) priceEl.textContent = formatARS(promo.price);

  if (oldEl) {
    if (promo.oldPrice && Number(promo.oldPrice) > Number(promo.price)) {
      oldEl.textContent = formatARS(promo.oldPrice);
      oldEl.hidden = false;
    } else {
      oldEl.hidden = true;
    }
  }
}

// ============================================================================
// ESTADO DE APERTURA EN TIEMPO REAL
// ============================================================================

function formatHour(h) {
  return String(h % 24).padStart(2, '0') + ':00';
}

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
    day: dayMap[get('weekday')] ?? date.getDay(),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function getOpenStatus(now = new Date()) {
  const { openDays, open, close } = SITE.hours;
  const { day, minutes } = getLocalParts(now);
  const isOpenDay = Array.isArray(openDays) && openDays.includes(day);

  if (isOpenDay && minutes >= open * 60 && minutes < close * 60) {
    return {
      isOpen: true,
      nextText: '',
      bannerText: `ABIERTO AHORA · TOMANDO PEDIDOS HASTA LAS ${formatHour(close)} HS`,
    };
  }

  let nextText = '';
  if (isOpenDay && minutes < open * 60) {
    nextText = `hoy a las ${formatHour(open)} hs`;
  } else {
    for (let i = 1; i <= 7; i += 1) {
      const d = (day + i) % 7;
      if (Array.isArray(openDays) && openDays.includes(d)) {
        nextText = i === 1 ? `mañana a las ${formatHour(open)} hs` : `el ${DAY_NAMES[d]} a las ${formatHour(open)} hs`;
        break;
      }
    }
  }

  return {
    isOpen: false,
    nextText,
    bannerText: nextText
      ? `CERRADO AHORA · ABRIMOS ${nextText.toUpperCase()}`
      : `CERRADO AHORA · ${(SITE.hours?.label || 'MIÉ A DOM · 20:00 A 00:00 HS').toUpperCase()}`,
  };
}

function updateOpenStatus() {
  const dot = $('#openStatusDot');
  const text = $('#openStatusText');
  const notice = $('#cartOpenNotice');
  if (!dot || !text) return;

  const status = getOpenStatus(new Date());
  dot.classList.toggle('is-open', status.isOpen);
  dot.classList.toggle('is-closed', !status.isOpen);
  text.textContent = status.bannerText;

  if (notice) {
    notice.hidden = status.isOpen;
    if (!status.isOpen) {
      notice.textContent = status.nextText
        ? `⏰ Ahora estamos cerrados (abrimos ${status.nextText}). Podés dejar armado tu pedido y lo confirmamos apenas abramos.`
        : `⏰ El local está cerrado en este momento (${SITE.hours?.fullLabel || 'Mié a Dom 20 a 00 hs'}). Podés dejar armado tu pedido igual.`;
    }
  }
}

// ============================================================================
// ILUSTRACIÓN VECTORIAL POR CAPAS + ANIMACIÓN SMASH + CORTE TRANSVERSAL
// ============================================================================

function renderBurgerSVG(layers = {}, size = 'doble') {
  const cheeseColors = {
    cheddar: { main: '#F5B700', dark: '#D69600' },
    'smoked-cheddar': { main: '#E07A16', dark: '#B85B06' },
    provolone: { main: '#F3EAD2', dark: '#D8C9A3' },
  };
  const cheese = cheeseColors[layers.cheese] || cheeseColors.cheddar;

  const sauceColors = {
    'thousand-island': '#F28B66',
    bbq: '#5C1E12',
    alioli: '#F7F2DC',
    buenarda: '#F29F38',
    royale: '#D93829',
  };
  const sauce = sauceColors[layers.sauce] || '#F5B700';

  const lettuceLayer = layers.lettuce
    ? `<path d="M36 132 Q55 124 72 132 Q90 140 110 131 Q130 123 148 132 Q166 139 184 131 L182 140 Q164 147 146 139 Q128 132 110 140 Q90 147 72 139 Q54 132 38 139 Z" fill="#4CAF50"/>`
    : '';

  const tomatoLayer = layers.tomato
    ? `<rect x="44" y="123" width="132" height="9" rx="4.5" fill="#E53935"/>`
    : '';

  const picklesLayer = layers.pickles
    ? `<g fill="#689F38">
        <ellipse cx="64" cy="126" rx="14" ry="4.2"/>
        <ellipse cx="110" cy="125" rx="15" ry="4.2"/>
        <ellipse cx="156" cy="126" rx="14" ry="4.2"/>
      </g>`
    : '';

  const baconLayer = layers.bacon
    ? `<path d="M40 103 Q64 95 88 103 T136 103 T180 102 L178 111 Q154 117 132 110 T86 110 T42 111 Z" fill="#A8322D"/>
       <path d="M45 106 Q68 100 90 106 T136 106 T175 105" stroke="#F4A896" stroke-width="2.2" fill="none"/>`
    : '';

  const eggLayer = layers.egg
    ? `<path d="M52 94 Q80 86 110 89 Q142 86 168 95 Q172 103 152 105 Q110 107 66 105 Q48 102 52 94 Z" fill="#FFFDF7"/>
       <ellipse cx="110" cy="95" rx="18" ry="7.5" fill="#FFB300"/>`
    : '';

  const onionLayer = layers.crispyOnion
    ? `<g stroke="#C67D28" stroke-width="2.6" fill="none" stroke-linecap="round">
        <path d="M52 96 C62 88, 74 98, 84 90 C94 84, 106 96, 118 89 C130 83, 142 96, 154 90 C162 86, 168 93, 172 96"/>
        <path d="M58 100 C70 92, 82 101, 96 94 C110 88, 124 100, 138 93 C150 88, 160 97, 166 99" stroke="#E29B42"/>
      </g>`
    : layers.caramelOnion
      ? `<path d="M48 97 Q78 89 110 95 Q142 90 172 97 Q166 104 110 103 Q54 104 48 97 Z" fill="#6D3B1E"/>`
      : layers.dicedOnion
        ? `<g fill="#F5F3EE" opacity="0.92">
            <rect x="62" y="94" width="7" height="5" rx="1.5"/>
            <rect x="82" y="92" width="7" height="5" rx="1.5"/>
            <rect x="104" y="94" width="7" height="5" rx="1.5"/>
            <rect x="126" y="92" width="7" height="5" rx="1.5"/>
            <rect x="148" y="94" width="7" height="5" rx="1.5"/>
          </g>`
        : '';

  // Medallón extra + queso fundido cuando el cliente elige Triple
  const extraTripleLayer =
    size === 'triple'
      ? `<g class="svg-extra-patty">
          <rect x="34" y="106" width="152" height="17" rx="8.5" fill="#4A2516"/>
          <path d="M38 106 L182 106 L176 116 L154 123 L136 113 L112 124 L88 113 L64 122 L44 114 Z" fill="${cheese.main}"/>
        </g>`
      : '';

  const topOffset = size === 'triple' ? -10 : 0;

  return `
    <svg viewBox="0 0 220 205" role="img" aria-hidden="true">
      <ellipse cx="110" cy="186" rx="78" ry="10" fill="rgba(0,0,0,0.55)"/>
      <!-- Pan inferior -->
      <path d="M40 160 H180 V168 C180 177 166 182 110 182 C54 182 40 177 40 168 Z" fill="#C97A2B"/>
      <rect x="40" y="157" width="140" height="6" rx="3" fill="#E39A48"/>

      ${lettuceLayer}
      ${tomatoLayer}
      ${picklesLayer}

      <!-- Medallón 1 -->
      <rect x="34" y="140" width="152" height="18" rx="9" fill="#4E2718"/>
      <path d="M38 140 L182 140 L175 150 L152 157 L130 147 L110 158 L88 147 L64 156 L44 148 Z" fill="${cheese.main}"/>

      <!-- Medallón 2 -->
      <rect x="33" y="122" width="154" height="18" rx="9" fill="#5A2E1C"/>
      <path d="M37 122 L183 122 L177 132 L156 140 L132 129 L110 141 L86 129 L62 139 L43 130 Z" fill="${cheese.main}"/>

      ${extraTripleLayer}

      <g transform="translate(0, ${topOffset})">
        ${baconLayer}
        ${eggLayer}
        ${onionLayer}

        <!-- Salsa -->
        <path d="M46 89 Q78 83 110 88 Q142 83 174 89 Q168 95 148 93 Q128 97 110 93 Q90 97 70 93 Q52 95 46 89 Z" fill="${sauce}"/>

        <!-- Pan superior -->
        <path d="M38 86 C38 46 68 32 110 32 C152 32 182 46 182 86 Z" fill="#D88732"/>
        <path d="M46 81 C48 51 74 39 110 39 C146 39 172 51 174 81 Z" fill="#E89D46" opacity="0.55"/>

        <!-- Semillas de sésamo -->
        <g fill="#FFF5DC">
          <ellipse cx="82" cy="52" rx="4.2" ry="2.1" transform="rotate(-18 82 52)"/>
          <ellipse cx="110" cy="46" rx="4.2" ry="2.1"/>
          <ellipse cx="138" cy="52" rx="4.2" ry="2.1" transform="rotate(18 138 52)"/>
          <ellipse cx="94" cy="64" rx="4.2" ry="2.1" transform="rotate(-10 94 64)"/>
          <ellipse cx="126" cy="64" rx="4.2" ry="2.1" transform="rotate(10 126 64)"/>
          <ellipse cx="68" cy="68" rx="3.8" ry="2" transform="rotate(-24 68 68)"/>
          <ellipse cx="152" cy="68" rx="3.8" ry="2" transform="rotate(24 152 68)"/>
        </g>
      </g>
    </svg>
  `;
}

function visualHTML(item, size = 'doble', includeBurst = false) {
  const burst = includeBurst ? `<span class="smash-burst" aria-hidden="true"></span>` : '';
  const fallbackMarkup = item.isBurger
    ? renderBurgerSVG(item.layers, size)
    : `<span style="font-size:4.2rem;line-height:1" aria-hidden="true">${escapeHTML(item.icon || '🍟')}</span>`;

  if (SITE.usePhotos) {
    const ext = SITE.photoExtension || 'jpg';
    const src = `assets/burgers/${encodeURIComponent(item.id)}.${ext}`;
    const cutSrc = `assets/burgers/${encodeURIComponent(item.id)}-corte.${ext}`;

    return `
      ${burst}
      <div class="photo-stack" data-photo-stack>
        <img
          src="${src}"
          alt="${escapeHTML(item.name)}"
          class="item-photo"
          loading="lazy"
          onerror="this.parentElement.outerHTML=this.dataset.fallback"
          data-fallback="${escapeHTML(fallbackMarkup)}"
        />
        <img
          src="${cutSrc}"
          alt="${escapeHTML(item.name)} corte transversal"
          class="item-photo item-photo--cut"
          loading="lazy"
          onerror="this.nextElementSibling?.remove(); this.remove();"
        />
        <span class="photo-cut-pill">🔪 Ver corte</span>
      </div>
    `;
  }

  return `${burst}${fallbackMarkup}`;
}

// ============================================================================
// HERO SHOWCASE (DESTACADAS)
// ============================================================================

function getHeroBurgers() {
  const availableBurgers = MENU_ITEMS.filter((i) => i.isBurger && isItemAvailable(i));
  return availableBurgers.length ? availableBurgers : MENU_ITEMS.filter((i) => i.isBurger);
}

function renderHeroShowcase() {
  const burgers = getHeroBurgers();
  if (!burgers.length) return;
  if (state.heroIndex >= burgers.length) state.heroIndex = 0;

  const current = burgers[state.heroIndex];
  const visualEl = $('#heroBurgerVisual');
  const nameEl = $('#heroBurgerName');
  const priceEl = $('#heroBurgerPrice');
  const descEl = $('#heroBurgerDesc');
  const dotsEl = $('#heroDots');
  const addBtn = $('#addHeroBurgerBtn');

  if (visualEl) visualEl.innerHTML = visualHTML(current, 'doble', false);
  if (nameEl) nameEl.textContent = current.name;
  if (priceEl) priceEl.textContent = formatARS(current.basePrice);
  if (descEl) descEl.textContent = current.ingredients;

  if (addBtn) {
    const soldOut = !isItemAvailable(current);
    addBtn.disabled = soldOut;
    addBtn.textContent = soldOut ? 'Agotado por hoy' : '+ Agregar al Pedido';
  }

  if (dotsEl) {
    dotsEl.innerHTML = burgers
      .map(
        (b, idx) => `
        <button
          type="button"
          class="story-dot ${idx === state.heroIndex ? 'is-active' : ''}"
          aria-label="Ver ${escapeHTML(b.name)}"
          aria-selected="${idx === state.heroIndex}"
          data-hero-dot="${idx}"
        ></button>`
      )
      .join('');
  }
}

// ============================================================================
// CARTA Y TARJETAS DE PRODUCTOS
// ============================================================================

function renderCardInner(item) {
  const soldOut = !isItemAvailable(item);
  const size = state.selectedSizes[item.id] || 'doble';
  const price = getUnitPrice(item, size);

  const sizeControls = item.isBurger
    ? `
      <div class="size-selector" role="group" aria-label="Tamaño de ${escapeHTML(item.name)}">
        <button
          type="button"
          class="size-btn ${size === 'doble' ? 'is-active' : ''}"
          data-size-item="${escapeHTML(item.id)}"
          data-size-val="doble"
          ${soldOut ? 'disabled' : ''}
        >
          Doble (x4 Queso)
        </button>
        <button
          type="button"
          class="size-btn ${size === 'triple' ? 'is-active' : ''}"
          data-size-item="${escapeHTML(item.id)}"
          data-size-val="triple"
          ${soldOut ? 'disabled' : ''}
        >
          Triple (+${formatARS(SITE.tripleExtraPrice)})
        </button>
      </div>
    `
    : '';

  return `
    <div>
      <div class="burger-card__top">
        <span class="burger-card__badge ${soldOut ? 'burger-card__badge--soldout' : ''}">
          ${soldOut ? 'Agotado por hoy' : escapeHTML(item.badge || 'Buenarda')}
        </span>
      </div>
      <div class="burger-card__visual">${visualHTML(item, size, true)}</div>
      <h3 class="burger-card__title">${escapeHTML(item.name)}</h3>
      <p class="burger-card__ingredients">${escapeHTML(item.ingredients)}</p>
    </div>
    <div>
      ${sizeControls}
      <div class="burger-card__footer">
        <span class="burger-card__price">${formatARS(price)}</span>
        <button
          type="button"
          class="btn-add"
          data-add-id="${escapeHTML(item.id)}"
          ${soldOut ? 'disabled' : ''}
        >
          ${soldOut ? 'Sin stock' : '+ Agregar'}
        </button>
      </div>
    </div>
  `;
}

function renderMenuGrid() {
  const grid = $('#menuGrid');
  if (!grid) return;

  const query = normalizeText(state.search);
  const filtered = MENU_ITEMS.filter((item) => {
    const matchesFilter = state.filter === 'all' || item.category === state.filter;
    if (!matchesFilter) return false;
    if (!query) return true;
    const haystack = normalizeText(`${item.name} ${item.ingredients} ${item.badge || ''}`);
    return haystack.includes(query);
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="menu-empty">
        <p>No encontramos productos que coincidan con "<strong>${escapeHTML(state.search)}</strong>".</p>
        <button type="button" class="btn btn--ghost btn--sm" id="resetFiltersBtn">Ver toda la carta</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (item) => `
      <article class="burger-card is-entering ${!isItemAvailable(item) ? 'is-sold-out' : ''}" data-card-id="${escapeHTML(item.id)}">
        ${renderCardInner(item)}
      </article>
    `
    )
    .join('');
}

function updateSingleCard(itemId, { smashTrigger = false } = {}) {
  const item = getItemById(itemId);
  const card = document.querySelector(`[data-card-id="${CSS.escape(itemId)}"]`);
  if (!item || !card) return;

  card.innerHTML = renderCardInner(item);

  if (smashTrigger) {
    card.classList.remove('is-smashing');
    void card.offsetWidth;
    card.classList.add('is-smashing');
    clearTimeout(card._smashTimer);
    card._smashTimer = setTimeout(() => {
      card.classList.remove('is-smashing');
    }, 680);
  }
}

// ============================================================================
// CARRITO, PEDIDO GRUPAL, ZONAS DE DELIVERY Y ALIAS
// ============================================================================

function saveCart() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
  } catch {
    // Ignorar si el almacenamiento está bloqueado
  }
}

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.cart = parsed
        .filter((entry) => entry && entry.id && Number(entry.qty) > 0)
        .map((entry) => ({
          key: entry.key || `${entry.id}__${entry.size || 'doble'}`,
          id: entry.id,
          size: entry.size || 'doble',
          qty: Number(entry.qty) || 1,
          person: typeof entry.person === 'string' ? entry.person : '',
          note: typeof entry.note === 'string' ? entry.note : '',
        }));
    }
  } catch {
    state.cart = [];
  }
}

function saveCheckoutPrefs() {
  try {
    const payload = {
      deliveryMode: state.deliveryMode,
      deliveryZoneId: state.deliveryZoneId,
      customerName: $('#customerName')?.value || '',
      customerAddress: $('#customerAddress')?.value || '',
      paymentMethod: $('#paymentMethod')?.value || 'Efectivo',
    };
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignorar
  }
}

function loadCheckoutPrefs() {
  try {
    const raw = localStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.deliveryMode === 'delivery' || saved.deliveryMode === 'retiro') {
      state.deliveryMode = saved.deliveryMode;
    }
    if (saved.deliveryZoneId) state.deliveryZoneId = saved.deliveryZoneId;
    if ($('#customerName') && saved.customerName) $('#customerName').value = saved.customerName;
    if ($('#customerAddress') && saved.customerAddress) $('#customerAddress').value = saved.customerAddress;
    const paymentEl = $('#paymentMethod');
    if (paymentEl && saved.paymentMethod && [...paymentEl.options].some((o) => o.value === saved.paymentMethod)) {
      paymentEl.value = saved.paymentMethod;
    }
  } catch {
    // Ignorar
  }
}

function renderDeliveryZones() {
  const select = $('#deliveryZoneSelect');
  if (!select) return;

  if (!deliveryZones.length) {
    select.innerHTML = '';
    return;
  }

  if (!deliveryZones.some((z) => z.id === state.deliveryZoneId)) {
    state.deliveryZoneId = deliveryZones[0].id;
  }

  select.innerHTML = deliveryZones
    .map((z) => {
      const priceLabel = typeof z.fee === 'number' ? (z.fee === 0 ? 'Sin cargo' : formatARS(z.fee)) : 'A confirmar';
      return `<option value="${escapeHTML(z.id)}" ${z.id === state.deliveryZoneId ? 'selected' : ''}>📍 ${escapeHTML(z.name)} — ${priceLabel}</option>`;
    })
    .join('');
}

function syncDeliveryUI() {
  const isDelivery = state.deliveryMode === 'delivery';
  $$('.delivery-btn').forEach((btn) => {
    const active = btn.dataset.delivery === state.deliveryMode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  const addrInput = $('#customerAddress');
  const zoneSelect = $('#deliveryZoneSelect');
  const shippingRow = $('#cartShippingRow');

  if (addrInput) addrInput.hidden = !isDelivery;
  if (zoneSelect) zoneSelect.hidden = !isDelivery || deliveryZones.length === 0;
  if (shippingRow) shippingRow.hidden = !isDelivery;
}

function syncAliasCard() {
  const paymentSelect = $('#paymentMethod');
  const aliasCard = $('#aliasCard');
  if (!paymentSelect || !aliasCard) return;

  const isTransfer = normalizeText(paymentSelect.value).includes('transferencia');
  const alias = SITE.payment?.alias || '';

  if (!isTransfer || !alias) {
    aliasCard.hidden = true;
    return;
  }

  aliasCard.hidden = false;
  const valEl = $('#aliasValueText');
  const holderEl = $('#aliasHolderText');
  if (valEl) valEl.textContent = alias;
  if (holderEl) {
    holderEl.textContent = SITE.payment?.holder ? `Titular: ${SITE.payment.holder}` : '';
  }
}

function flyToCart(sourceEl) {
  if (!sourceEl || prefersReducedMotion || !sourceEl.isConnected) return;
  const target = $('#openCartBtn') || $('#mobileCartBar');
  if (!target) return;

  const startRect = sourceEl.getBoundingClientRect();
  const endRect = target.getBoundingClientRect();
  if (!startRect.width || !endRect.width) return;

  const dot = document.createElement('span');
  dot.className = 'fly-dot';
  dot.style.left = `${startRect.left + startRect.width / 2 - 8}px`;
  dot.style.top = `${startRect.top + startRect.height / 2 - 8}px`;
  document.body.appendChild(dot);

  const dx = endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2);
  const dy = endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2);

  const anim = dot.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.45 },
    ],
    { duration: 600, easing: 'cubic-bezier(0.5, -0.15, 0.75, 0.45)' }
  );

  anim.onfinish = () => {
    dot.remove();
    bumpCartBadge();
  };
}

function bumpCartBadge() {
  const badge = $('#cartCountBadge');
  if (!badge) return;
  badge.classList.remove('is-bump');
  void badge.offsetWidth;
  badge.classList.add('is-bump');
}

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

function addToCart(itemId, forcedSize = null, sourceEl = null) {
  const item = getItemById(itemId);
  if (!item) return;

  if (!isItemAvailable(item)) {
    showToast(`${item.name} está agotado por hoy`);
    return;
  }

  const size = item.isBurger ? forcedSize || state.selectedSizes[item.id] || 'doble' : 'unico';
  const key = `${item.id}__${size}`;

  const existing = state.cart.find((line) => line.key === key);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      key,
      id: item.id,
      size,
      qty: 1,
      person: '',
      note: '',
    });
  }

  saveCart();
  renderCart();
  flashAdded(sourceEl);
  flyToCart(sourceEl);
  if (prefersReducedMotion) bumpCartBadge();
  showToast(`✓ ${item.name} agregada al pedido`);
  track('add_to_cart', {
    item_id: item.id,
    item_name: item.name,
    value: getUnitPrice(item, size),
    currency: 'ARS',
  });
}

function updateCartQty(key, delta) {
  const idx = state.cart.findIndex((line) => line.key === key);
  if (idx === -1) return;

  if (delta > 0) {
    const item = getItemById(state.cart[idx].id);
    if (item && !isItemAvailable(item)) {
      showToast(`${item.name} está agotado por hoy`);
      return;
    }
  }

  state.cart[idx].qty += delta;
  if (state.cart[idx].qty <= 0) {
    state.cart.splice(idx, 1);
  }

  saveCart();
  renderCart();
}

function removeFromCart(key) {
  state.cart = state.cart.filter((line) => line.key !== key);
  saveCart();
  renderCart();
}

function setCartField(key, field, value) {
  const line = state.cart.find((l) => l.key === key);
  if (!line) return;
  line[field] = value.slice(0, field === 'person' ? 40 : 140);
  saveCart();
}

function getCartTotals() {
  const subtotal = state.cart.reduce((sum, line) => {
    const item = getItemById(line.id);
    if (!item) return sum;
    return sum + getUnitPrice(item, line.size) * line.qty;
  }, 0);

  const isDelivery = state.deliveryMode === 'delivery';
  const shippingFee = getShippingFee();
  const knownShipping = isDelivery && typeof shippingFee === 'number' ? shippingFee : 0;

  return {
    subtotal,
    isDelivery,
    shippingFee,
    knownShipping,
    total: subtotal + knownShipping,
  };
}

function upsellHTML() {
  const hasBurger = state.cart.some((line) => getItemById(line.id)?.isBurger);
  if (!hasBurger) return '';

  const inCart = new Set(state.cart.map((line) => line.id));
  const picks = (SITE.upsellIds || [])
    .map(getItemById)
    .filter((item) => item && isItemAvailable(item) && !inCart.has(item.id))
    .slice(0, 3);

  if (!picks.length) return '';

  return `
    <div class="upsell">
      <h4 class="upsell__title">Sumá algo más a tu pedido</h4>
      ${picks
        .map(
          (item) => `
          <div class="upsell__item">
            <span class="upsell__emoji" aria-hidden="true">${escapeHTML(item.icon || '🍟')}</span>
            <div class="upsell__info">
              <strong>${escapeHTML(item.name)}</strong>
              <small>${formatARS(item.basePrice)}</small>
            </div>
            <button type="button" class="upsell__btn" data-add-id="${escapeHTML(item.id)}">+ Agregar</button>
          </div>
        `
        )
        .join('')}
    </div>
  `;
}

function renderCart() {
  const container = $('#cartItemsContainer');
  const badge = $('#cartCountBadge');
  const subtotalEl = $('#cartSubtotal');
  const shippingEl = $('#cartShipping');
  const totalEl = $('#cartTotal');

  const totalUnits = state.cart.reduce((sum, line) => sum + line.qty, 0);
  const totals = getCartTotals();

  if (badge) badge.textContent = String(totalUnits);
  if (subtotalEl) subtotalEl.textContent = formatARS(totals.subtotal);
  if (totalEl) totalEl.textContent = formatARS(totals.total);

  if (shippingEl) {
    if (!totals.isDelivery) {
      shippingEl.textContent = 'Sin cargo (Retiro)';
    } else if (typeof totals.shippingFee === 'number') {
      shippingEl.textContent = totals.shippingFee === 0 ? 'Sin cargo' : formatARS(totals.shippingFee);
    } else {
      shippingEl.textContent = 'A confirmar por WhatsApp';
    }
  }

  updateMobileBar(totalUnits, totals.total);

  if (!container) return;

  if (!state.cart.length) {
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
      .map((line) => {
        const item = getItemById(line.id);
        if (!item) return '';
        const soldOut = !isItemAvailable(item);
        const unitPrice = getUnitPrice(item, line.size);
        const sizeLabel = getSizeLabel(item, line.size);

        return `
          <div class="cart-item ${soldOut ? 'is-sold-out' : ''}">
            <div class="cart-item__row">
              <div class="cart-item__info">
                <h4>${escapeHTML(item.name)}</h4>
                <span class="cart-item__meta">${escapeHTML(sizeLabel)} · ${formatARS(unitPrice * line.qty)}</span>
                ${soldOut ? '<span class="cart-item__soldout-tag">⚠️ Agotado por hoy — quitalo para continuar</span>' : ''}
              </div>
              <div class="cart-item__controls">
                <button type="button" class="qty-btn" data-qty-key="${escapeHTML(line.key)}" data-delta="-1" aria-label="Restar unidad de ${escapeHTML(item.name)}">−</button>
                <strong aria-live="polite">${line.qty}</strong>
                <button type="button" class="qty-btn" data-qty-key="${escapeHTML(line.key)}" data-delta="1" aria-label="Sumar unidad de ${escapeHTML(item.name)}" ${soldOut ? 'disabled' : ''}>+</button>
                <button type="button" class="qty-btn qty-btn--remove" data-remove-key="${escapeHTML(line.key)}" aria-label="Quitar ${escapeHTML(item.name)}">✕</button>
              </div>
            </div>
            <div class="cart-item__inputs">
              <input
                type="text"
                class="cart-item__person"
                maxlength="40"
                data-field="person"
                data-line-key="${escapeHTML(line.key)}"
                value="${escapeHTML(line.person || '')}"
                placeholder="👤 ¿Para quién es?"
                aria-label="¿Para quién es ${escapeHTML(item.name)}?"
              />
              <input
                type="text"
                class="cart-item__note"
                maxlength="140"
                data-field="note"
                data-line-key="${escapeHTML(line.key)}"
                value="${escapeHTML(line.note || '')}"
                placeholder="📝 Aclaración (ej. sin pepinillos)"
                aria-label="Aclaración para ${escapeHTML(item.name)}"
              />
            </div>
          </div>
        `;
      })
      .join('') + upsellHTML();
}

function isDrawerOpen() {
  return $('#cartDrawer')?.classList.contains('is-open') || false;
}

function updateMobileBar(totalUnits, totalAmount) {
  const bar = $('#mobileCartBar');
  if (!bar) return;

  const units = totalUnits ?? state.cart.reduce((sum, line) => sum + line.qty, 0);
  const amount = totalAmount ?? getCartTotals().total;
  const visible = units > 0 && !isDrawerOpen();

  bar.hidden = !visible;
  document.body.classList.toggle('has-cart-bar', visible);

  const countEl = $('#mobileCartCount');
  const totalEl = $('#mobileCartTotal');
  if (countEl) countEl.textContent = `${units} ${units === 1 ? 'producto' : 'productos'}`;
  if (totalEl) totalEl.textContent = formatARS(amount);
}

function openCartDrawer() {
  const drawer = $('#cartDrawer');
  const overlay = $('#cartOverlay');
  if (!drawer || !overlay) return;

  state.lastFocused = document.activeElement;
  overlay.hidden = false;
  drawer.inert = false;
  drawer.setAttribute('aria-hidden', 'false');
  drawer.classList.add('is-open');
  document.body.classList.add('no-scroll');
  $('#closeCartBtn')?.focus();
  updateMobileBar();
  track('open_cart', { items: state.cart.length });
}

function closeCartDrawer() {
  const drawer = $('#cartDrawer');
  const overlay = $('#cartOverlay');
  if (!drawer || !overlay || !drawer.classList.contains('is-open')) return;

  overlay.hidden = true;
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.inert = true;
  document.body.classList.remove('no-scroll');
  updateMobileBar();
  if (state.lastFocused && document.contains(state.lastFocused)) {
    state.lastFocused.focus();
  }
}

function trapFocusInDrawer(e) {
  const drawer = $('#cartDrawer');
  if (!drawer) return;
  const focusable = [
    ...drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
  ].filter((el) => !el.disabled && !el.hidden && el.getClientRects().length > 0);
  if (!focusable.length) return;

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

// ============================================================================
// PEDIDO WHATSAPP, REGISTRO EN SHEETS Y TICKET TÉRMICO ANIMADO
// ============================================================================

function buildWhatsAppOrderText(meta = createOrderMeta()) {
  const name = $('#customerName')?.value.trim() || 'Sin nombre';
  const address = $('#customerAddress')?.value.trim() || '';
  const payment = $('#paymentMethod')?.value || 'Efectivo';
  const notes = $('#orderNotes')?.value.trim() || '';
  const totals = getCartTotals();
  const zone = totals.isDelivery ? getSelectedZone() : null;

  const deliveryLine = totals.isDelivery
    ? `🛵 *Modalidad:* Delivery${zone ? ` (${zone.name})` : ''} — ${address || 'Dirección a confirmar'}`
    : `🏪 *Modalidad:* Retiro en ${SITE.brand?.shortAddress || 'Colón 696 — Paraná'}`;

  const lines = [
    `🍔 *PEDIDO #${meta.code} — ${(SITE.brand?.name || 'BUENARDA').toUpperCase()}*`,
    `🕒 *Hora:* ${meta.timeStr} hs (${meta.dateStr})`,
    `👤 *Cliente:* ${name}`,
    deliveryLine,
    `💳 *Pago:* ${payment}`,
    '',
    '*Detalle del pedido:*',
  ];

  const hasGroupNames = state.cart.some((line) => line.person && line.person.trim() !== '');

  if (hasGroupNames) {
    const groups = new Map();
    state.cart.forEach((line) => {
      const person = line.person?.trim() || 'Para compartir / Sin asignar';
      if (!groups.has(person)) groups.set(person, []);
      groups.get(person).push(line);
    });

    groups.forEach((groupLines, person) => {
      const personSubtotal = groupLines.reduce((acc, l) => {
        const item = getItemById(l.id);
        return acc + (item ? getUnitPrice(item, l.size) * l.qty : 0);
      }, 0);

      lines.push(`\n👤 *${person}* (${formatARS(personSubtotal)}):`);
      groupLines.forEach((l) => {
        const item = getItemById(l.id);
        if (!item) return;
        const unitPrice = getUnitPrice(item, l.size);
        lines.push(`• ${l.qty}x ${item.name} (${getSizeLabel(item, l.size)}) — ${formatARS(unitPrice * l.qty)}`);
        if (l.note) lines.push(`   ↳ _${l.note}_`);
      });
    });
  } else {
    state.cart.forEach((l) => {
      const item = getItemById(l.id);
      if (!item) return;
      const unitPrice = getUnitPrice(item, l.size);
      lines.push(`• ${l.qty}x ${item.name} (${getSizeLabel(item, l.size)}) — ${formatARS(unitPrice * l.qty)}`);
      if (l.note) lines.push(`   ↳ _${l.note}_`);
    });
  }

  lines.push('');
  lines.push(`🧾 *Subtotal:* ${formatARS(totals.subtotal)}`);
  if (totals.isDelivery) {
    const shipText =
      typeof totals.shippingFee === 'number'
        ? totals.shippingFee === 0
          ? 'Sin cargo'
          : formatARS(totals.shippingFee)
        : 'A confirmar';
    lines.push(`🛵 *Envío:* ${shipText}`);
  }
  lines.push(`💰 *TOTAL ESTIMADO:* ${formatARS(totals.total)}`);

  if (normalizeText(payment).includes('transferencia') && SITE.payment?.alias) {
    lines.push(`📲 *Alias transferido:* ${SITE.payment.alias} _(adjunto comprobante)_`);
  }
  if (notes) lines.push(`📝 *Notas:* ${notes}`);

  return lines.join('\n');
}

function logOrderToSheet(meta) {
  const scriptUrl = SITE.appsScriptUrl?.trim();
  if (!scriptUrl) return;

  const name = $('#customerName')?.value.trim() || 'Sin nombre';
  const address = $('#customerAddress')?.value.trim() || '';
  const payment = $('#paymentMethod')?.value || 'Efectivo';
  const notes = $('#orderNotes')?.value.trim() || '';
  const totals = getCartTotals();
  const zone = totals.isDelivery ? getSelectedZone() : null;

  let burgersDoble = 0;
  let burgersTriple = 0;
  let totalUnidades = 0;

  const productos = state.cart
    .map((line) => {
      const item = getItemById(line.id);
      if (!item) return '';
      totalUnidades += line.qty;
      if (item.isBurger && line.size === 'doble') burgersDoble += line.qty;
      if (item.isBurger && line.size === 'triple') burgersTriple += line.qty;

      const suffix = !item.isBurger ? '' : ` [${line.size.toUpperCase()}]`;
      const personTag = line.person ? ` [Para: ${line.person}]` : '';
      const noteTag = line.note ? ` (${line.note})` : '';
      return `${line.qty}x ${item.name}${suffix}${personTag}${noteTag}`;
    })
    .filter(Boolean)
    .join(' | ');

  const fullAddress = totals.isDelivery
    ? `${zone ? `[${zone.name}] ` : ''}${address}`
    : SITE.brand?.shortAddress || 'Colón 696 — Paraná';

  const payload = {
    codigo: meta.code,
    fecha: meta.dateStr,
    hora: meta.timeStr,
    cliente: name,
    modalidad: totals.isDelivery ? 'Delivery' : 'Retiro en local',
    direccion: fullAddress,
    pago: payment,
    productos,
    burgersDoble,
    burgersTriple,
    totalUnidades,
    subtotal: totals.subtotal,
    envio: totals.knownShipping,
    total: totals.total,
    notas: notes,
  };

  try {
    fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // Nunca interrumpir el pedido
  }
}

function openTicketModal(meta, whatsappUrl) {
  const overlay = $('#ticketOverlay');
  if (!overlay) return;

  const name = $('#customerName')?.value.trim() || 'Sin nombre';
  const address = $('#customerAddress')?.value.trim() || '';
  const payment = $('#paymentMethod')?.value || 'Efectivo';
  const totals = getCartTotals();
  const zone = totals.isDelivery ? getSelectedZone() : null;

  $('#ticketBrand').textContent = (SITE.brand?.name || 'BUENARDA').toUpperCase();
  $('#ticketAddress').textContent = SITE.brand?.fullAddress || 'Colón 696 · Paraná, Entre Ríos';
  $('#ticketCode').textContent = `#${meta.code}`;
  $('#ticketDateTime').textContent = `${meta.dateStr} · ${meta.timeStr} hs`;

  const modeText = totals.isDelivery
    ? `Delivery${zone ? ` · ${zone.name}` : ''} (${address})`
    : `Retiro en ${SITE.brand?.streetOnly || 'Colón 696'}`;

  $('#ticketCustomerInfo').innerHTML = `
    <div><strong>Cliente:</strong> ${escapeHTML(name)}</div>
    <div><strong>Entrega:</strong> ${escapeHTML(modeText)}</div>
    <div><strong>Pago:</strong> ${escapeHTML(payment)}</div>
  `;

  $('#ticketItemsList').innerHTML = state.cart
    .map((line) => {
      const item = getItemById(line.id);
      if (!item) return '';
      const lineTotal = getUnitPrice(item, line.size) * line.qty;
      return `
        <div class="ticket-row">
          <div class="ticket-row__main">
            ${line.person ? `<span class="ticket-row__person">${escapeHTML(line.person)}</span>` : ''}
            <strong>${line.qty}x ${escapeHTML(item.name)}</strong>
            <span class="ticket-row__sub">${escapeHTML(getSizeLabel(item, line.size))}${line.note ? ` · ${escapeHTML(line.note)}` : ''}</span>
          </div>
          <span class="ticket-row__price">${formatARS(lineTotal)}</span>
        </div>
      `;
    })
    .join('');

  const shipText = !totals.isDelivery
    ? 'Sin cargo'
    : typeof totals.shippingFee === 'number'
      ? totals.shippingFee === 0
        ? 'Sin cargo'
        : formatARS(totals.shippingFee)
      : 'A confirmar';

  $('#ticketTotalsList').innerHTML = `
    <div class="ticket-total-row"><span>Subtotal</span><span>${formatARS(totals.subtotal)}</span></div>
    ${totals.isDelivery ? `<div class="ticket-total-row"><span>Envío</span><span>${shipText}</span></div>` : ''}
    <div class="ticket-total-row ticket-total-row--grand"><span>TOTAL</span><span>${formatARS(totals.total)}</span></div>
  `;

  // Reinicia la animación de impresión térmica y sello
  const ticketPaper = $('#thermalTicket');
  const stamp = $('#ticketStamp');
  if (ticketPaper) {
    ticketPaper.style.animation = 'none';
    void ticketPaper.offsetWidth;
    ticketPaper.style.animation = '';
  }
  if (stamp) {
    stamp.style.animation = 'none';
    void stamp.offsetWidth;
    stamp.style.animation = '';
  }

  const reopenBtn = $('#ticketReopenWaBtn');
  if (reopenBtn) reopenBtn.href = whatsappUrl;

  closeCartDrawer();
  overlay.hidden = false;
  document.body.classList.add('no-scroll');
  reopenBtn?.focus();
}

function closeTicketModal() {
  const overlay = $('#ticketOverlay');
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  document.body.classList.remove('no-scroll');
}

function markInvalid(el, message) {
  el.classList.add('is-invalid');
  el.setAttribute('aria-invalid', 'true');
  el.focus();
  showToast(message);
}

function validateOrder() {
  const soldOutLine = state.cart.find((line) => {
    const item = getItemById(line.id);
    return item && !isItemAvailable(item);
  });
  if (soldOutLine) {
    const item = getItemById(soldOutLine.id);
    showToast(`Quitá "${item?.name || soldOutLine.id}" porque se agotó por hoy`);
    return false;
  }

  const nameEl = $('#customerName');
  const addressEl = $('#customerAddress');

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

// ============================================================================
// SINCRONIZACIÓN EN VIVO CON GOOGLE SHEETS (Config, Carta y Envios)
// ============================================================================

function toCsvUrl(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return '';
  if (url.includes('/pubhtml')) {
    const base = url.replace('/pubhtml', '/pub');
    return base.includes('output=csv') ? base : `${base}${base.includes('?') ? '&' : '?'}output=csv`;
  }
  return url;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => normalizeText(h));

  return rows
    .slice(1)
    .filter((r) => r.some((cell) => cell !== ''))
    .map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] ?? '';
      });
      return obj;
    });
}

function parsePrice(raw) {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : NaN;
}

function parseBooleanFlag(raw, defaultValue = true) {
  const val = normalizeText(raw);
  if (!val) return defaultValue;
  if (['no', 'false', '0', 'agotado', 'sin stock', 'inactivo'].includes(val)) return false;
  if (['si', 'true', '1', 'disponible', 'ok', 'activo'].includes(val)) return true;
  return defaultValue;
}

function applyConfigRows(rows) {
  rows.forEach((r) => {
    const key = normalizeText(r.clave || r.key || '');
    const val = String(r.valor || r.value || '').trim();
    if (!key) return;

    if (key === 'precio_triple') {
      const n = parsePrice(val);
      if (Number.isFinite(n)) SITE.tripleExtraPrice = n;
    } else if (key === 'costo_envio') {
      if (!val || normalizeText(val) === 'confirmar') {
        SITE.delivery = { ...(SITE.delivery || {}), fee: null };
      } else {
        const n = parsePrice(val);
        if (Number.isFinite(n)) SITE.delivery = { ...(SITE.delivery || {}), fee: n };
      }
    } else if (key === 'whatsapp') {
      const digits = val.replace(/[^\d]/g, '');
      if (digits.length >= 10) SITE.whatsappNumber = digits;
    } else if (key === 'usar_fotos') {
      SITE.usePhotos = parseBooleanFlag(val, SITE.usePhotos);
    } else if (key === 'color_primario') {
      SITE.brand.primaryColor = val;
    } else if (key === 'nombre_marca' && val) {
      SITE.brand.name = val;
    } else if (key === 'usuario_ig' && val) {
      SITE.brand.handle = val.startsWith('@') ? val : `@${val}`;
    } else if (key === 'direccion' && val) {
      SITE.brand.fullAddress = val;
      SITE.brand.shortAddress = val;
      SITE.brand.streetOnly = val.split(',')[0].trim();
    } else if (key === 'alias_pago' && val) {
      SITE.payment.alias = val;
    } else if (key === 'titular_pago' && val) {
      SITE.payment.holder = val;
    } else if (key === 'promo_activa') {
      SITE.promo.active = parseBooleanFlag(val, SITE.promo.active);
    } else if (key === 'promo_etiqueta' && val) {
      SITE.promo.badge = val;
    } else if (key === 'promo_titulo' && val) {
      SITE.promo.title = val;
    } else if ((key === 'promo_texto' || key === 'promo_subtitulo') && val) {
      SITE.promo.subtitle = val;
    } else if (key === 'promo_precio') {
      const n = parsePrice(val);
      if (Number.isFinite(n) && n > 0) SITE.promo.price = n;
    } else if (key === 'promo_precio_anterior') {
      const n = parsePrice(val);
      SITE.promo.oldPrice = Number.isFinite(n) && n > 0 ? n : null;
    } else if (key === 'promo_id' && val) {
      SITE.promo.id = val;
    } else if (key === 'hora_apertura') {
      const h = Number(val);
      if (Number.isFinite(h) && h >= 0 && h <= 23) SITE.hours.open = h;
    } else if (key === 'hora_cierre') {
      const h = Number(val);
      if (Number.isFinite(h) && h >= 1 && h <= 24) SITE.hours.close = h;
    } else if (key === 'dias_abiertos' && val) {
      const days = val
        .split(',')
        .map((d) => Number(d.trim()))
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      if (days.length > 0) SITE.hours.openDays = days;
    }
  });
}

function applyShippingRows(rows) {
  const parsed = rows
    .filter((r) => (r.zona || r.nombre) && parseBooleanFlag(r.activo ?? r.activa, true))
    .map((r, idx) => {
      const rawCost = String(r.costo ?? r.precio ?? '').trim();
      const isConfirm = !rawCost || normalizeText(rawCost) === 'confirmar';
      const n = isConfirm ? null : parsePrice(rawCost);
      const name = String(r.zona || r.nombre).trim();
      const slug = normalizeText(name).replace(/[^a-z0-9]+/g, '-') || `zona-${idx + 1}`;
      return {
        id: String(r.id || slug).trim(),
        name,
        fee: Number.isFinite(n) ? n : null,
      };
    });

  if (parsed.length > 0) {
    deliveryZones = parsed;
    if (!deliveryZones.some((z) => z.id === state.deliveryZoneId)) {
      state.deliveryZoneId = deliveryZones[0].id;
    }
  }
}

function applyMenuRows(rows) {
  if (!rows.length) return;

  rows.forEach((r) => {
    const id = String(r.id || '').trim();
    if (!id) return;

    const existing = MENU_ITEMS.find((entry) => entry.id === id);
    const parsedPrice = parsePrice(r.precio);
    const available = parseBooleanFlag(r.disponible, true);

    if (existing) {
      if (r.nombre) existing.name = r.nombre;
      if (r.categoria) existing.category = normalizeText(r.categoria);
      if (r.etiqueta) existing.badge = r.etiqueta;
      if (Number.isFinite(parsedPrice) && parsedPrice > 0) existing.basePrice = parsedPrice;
      if (r.ingredientes) existing.ingredients = r.ingredientes;
      if (r.icono) existing.icon = r.icono;
      existing.available = available;
    } else {
      const isBurger = parseBooleanFlag(r.es_burger, normalizeText(r.categoria) !== 'extras');
      MENU_ITEMS.push({
        id,
        name: r.nombre || id.toUpperCase(),
        category: normalizeText(r.categoria) || (isBurger ? 'especiales' : 'extras'),
        badge: r.etiqueta || 'Nueva',
        isBurger,
        icon: r.icono || (isBurger ? '🍔' : '🍟'),
        layers: isBurger ? { cheese: 'cheddar', sauce: 'buenarda' } : undefined,
        basePrice: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 10000,
        ingredients: r.ingredientes || '',
        available,
      });
    }
  });
}

async function syncFromSheets() {
  const menuUrl = toCsvUrl(SITE.sheet?.menuCsvUrl);
  const configUrl = toCsvUrl(SITE.sheet?.configCsvUrl);
  const shippingUrl = toCsvUrl(SITE.sheet?.shippingCsvUrl);
  if (!menuUrl && !configUrl && !shippingUrl) return;

  const fetchCSV = async (url) => {
    if (!url) return null;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.trim().startsWith('<')) return null; // Evita parsear HTML si la pestaña no es pública
    return parseCSV(text);
  };

  const [configRes, menuRes, shippingRes] = await Promise.allSettled([
    fetchCSV(configUrl),
    fetchCSV(menuUrl),
    fetchCSV(shippingUrl),
  ]);

  let updated = false;
  if (configRes.status === 'fulfilled' && configRes.value) {
    applyConfigRows(configRes.value);
    updated = true;
  }
  if (menuRes.status === 'fulfilled' && menuRes.value) {
    applyMenuRows(menuRes.value);
    updated = true;
  }
  if (shippingRes.status === 'fulfilled' && shippingRes.value) {
    applyShippingRows(shippingRes.value);
    updated = true;
  }

  if (updated) {
    applyBrandBindings();
    updateOpenStatus();
    renderNightPromo();
    renderDeliveryZones();
    syncDeliveryUI();
    syncAliasCard();
    renderHeroShowcase();
    renderMenuGrid();
    renderCart();
  }
}

// ============================================================================
// VIDEO "RECORRIDO POR EL LOCAL"
// ============================================================================

function initTourVideo() {
  const player = $('#tourPlayer');
  const video = $('#tourVideo');
  if (!player || !video) return;

  const sourceEl = $('#tourVideoSource');
  const errorEl = $('#tourError');
  const playBtn = $('#tourPlayBtn');
  const toggleBtn = $('#tourToggleBtn');
  const soundBtn = $('#tourSoundBtn');
  const soundLabel = $('#tourSoundLabel');
  const progress = $('#tourProgress');
  const progressFill = $('#tourProgressFill');

  let pausedByUser = false;

  const showVideoError = () => {
    player.classList.add('has-error');
    if (errorEl) errorEl.hidden = false;
  };

  const clearVideoError = () => {
    player.classList.remove('has-error');
    if (errorEl) errorEl.hidden = true;
  };

  sourceEl?.addEventListener('error', showVideoError);
  video.addEventListener('error', showVideoError);
  video.addEventListener('loadeddata', clearVideoError);

  if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
    showVideoError();
  }

  const safePlay = () => {
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
  };

  if (prefersReducedMotion) video.pause();

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
    toggleBtn?.setAttribute('aria-label', playing ? 'Pausar video' : 'Reproducir video');
  };

  const syncSoundState = () => {
    const unmuted = !video.muted;
    player.classList.toggle('is-unmuted', unmuted);
    soundBtn?.setAttribute('aria-pressed', String(unmuted));
    soundBtn?.setAttribute('aria-label', unmuted ? 'Silenciar video' : 'Activar sonido');
    if (soundLabel) soundLabel.textContent = unmuted ? 'Silenciar' : 'Activar sonido';
  };

  playBtn?.addEventListener('click', userToggle);
  toggleBtn?.addEventListener('click', userToggle);
  video.addEventListener('click', userToggle);

  soundBtn?.addEventListener('click', () => {
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
  video.addEventListener('playing', syncPlayState);
  video.addEventListener('pause', syncPlayState);
  video.addEventListener('ended', syncPlayState);
  video.addEventListener('volumechange', syncSoundState);

  video.addEventListener('timeupdate', () => {
    if (!video.duration || !progressFill || !progress) return;
    const pct = (video.currentTime / video.duration) * 100;
    progressFill.style.width = `${pct}%`;
    progress.setAttribute('aria-valuenow', String(Math.round(pct)));
  });

  progress?.addEventListener('click', (e) => {
    if (!video.duration) return;
    const rect = progress.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
  });

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

// ============================================================================
// RESEÑAS Y ANIMACIONES DE ENTRADA
// ============================================================================

function renderReviews() {
  const section = $('#resenas');
  const list = $('#reviewsList');
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
      </figure>
    `
  ).join('');
  section.hidden = false;
}

function initReveal() {
  const targets = $$('.reveal:not(.is-visible)');
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

// ============================================================================
// INICIALIZACIÓN Y EVENTOS
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  loadCheckoutPrefs();

  applyBrandBindings();
  updateOpenStatus();
  setInterval(updateOpenStatus, 60 * 1000);

  renderNightPromo();
  renderDeliveryZones();
  syncDeliveryUI();
  syncAliasCard();
  renderHeroShowcase();
  renderMenuGrid();
  renderCart();
  renderReviews();
  initReveal();
  initTourVideo();
  syncFromSheets();

  syncNavHeight();
  window.addEventListener('resize', syncNavHeight);
  if (document.fonts?.ready) document.fonts.ready.then(syncNavHeight);

  // Hero Showcase
  $('#prevHeroBurger')?.addEventListener('click', () => {
    const count = getHeroBurgers().length;
    if (!count) return;
    state.heroIndex = (state.heroIndex - 1 + count) % count;
    renderHeroShowcase();
  });

  $('#nextHeroBurger')?.addEventListener('click', () => {
    const count = getHeroBurgers().length;
    if (!count) return;
    state.heroIndex = (state.heroIndex + 1) % count;
    renderHeroShowcase();
  });

  $('#heroDots')?.addEventListener('click', (e) => {
    const dot = e.target.closest('[data-hero-dot]');
    if (!dot) return;
    state.heroIndex = Number(dot.dataset.heroDot);
    renderHeroShowcase();
  });

  $('#addHeroBurgerBtn')?.addEventListener('click', (e) => {
    const burgers = getHeroBurgers();
    const current = burgers[state.heroIndex % burgers.length];
    if (current) addToCart(current.id, 'doble', e.currentTarget);
  });

  // Botón de Promo / Combo de la Noche
  $('#addPromoBtn')?.addEventListener('click', (e) => {
    if (!SITE.promo?.active) return;
    const promoId = SITE.promo.id || 'promo-noche';
    addToCart(promoId, 'unico', e.currentTarget);
  });

  // Filtros y búsqueda de carta
  $('#filterTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-filter]');
    if (!tab) return;
    state.filter = tab.dataset.filter;
    $$('.filter-tab').forEach((btn) => btn.classList.remove('is-active'));
    tab.classList.add('is-active');
    renderMenuGrid();
  });

  $('#menuSearchInput')?.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderMenuGrid();
  });

  // Interacciones en la grilla (Doble/Triple con animación Smash + Agregar + Reset filtros)
  $('#menuGrid')?.addEventListener('click', (e) => {
    const resetBtn = e.target.closest('#resetFiltersBtn');
    if (resetBtn) {
      state.filter = 'all';
      state.search = '';
      const searchInput = $('#menuSearchInput');
      if (searchInput) searchInput.value = '';
      $$('.filter-tab').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.filter === 'all'));
      renderMenuGrid();
      return;
    }

    const sizeBtn = e.target.closest('[data-size-item]');
    if (sizeBtn && !sizeBtn.disabled) {
      const id = sizeBtn.dataset.sizeItem;
      const nextSize = sizeBtn.dataset.sizeVal;
      const prevSize = state.selectedSizes[id] || 'doble';
      state.selectedSizes[id] = nextSize;
      updateSingleCard(id, { smashTrigger: nextSize === 'triple' && prevSize !== 'triple' });
      return;
    }

    const addBtn = e.target.closest('[data-add-id]');
    if (addBtn && !addBtn.disabled) {
      addToCart(addBtn.dataset.addId, null, addBtn);
    }
  });

  // Mantener presionado en móvil para ver corte transversal de foto
  document.addEventListener('pointerdown', (e) => {
    const stack = e.target.closest('[data-photo-stack]');
    if (stack) stack.classList.add('is-cut-preview');
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => {
    document.addEventListener(evt, () => {
      $$('[data-photo-stack].is-cut-preview').forEach((el) => el.classList.remove('is-cut-preview'));
    });
  });

  // Abrir / cerrar carrito
  $('#openCartBtn')?.addEventListener('click', openCartDrawer);
  $('#mobileCartBar')?.addEventListener('click', openCartDrawer);
  $('#closeCartBtn')?.addEventListener('click', closeCartDrawer);
  $('#cartOverlay')?.addEventListener('click', closeCartDrawer);

  // Acciones dentro del carrito
  const cartContainer = $('#cartItemsContainer');
  cartContainer?.addEventListener('click', (e) => {
    const qtyBtn = e.target.closest('[data-qty-key]');
    if (qtyBtn && !qtyBtn.disabled) {
      updateCartQty(qtyBtn.dataset.qtyKey, Number(qtyBtn.dataset.delta));
      return;
    }

    const removeBtn = e.target.closest('[data-remove-key]');
    if (removeBtn) {
      removeFromCart(removeBtn.dataset.removeKey);
      return;
    }

    const addBtn = e.target.closest('[data-add-id]');
    if (addBtn) {
      addToCart(addBtn.dataset.addId, null, null);
    }
  });

  cartContainer?.addEventListener('input', (e) => {
    const input = e.target.closest('[data-line-key]');
    if (input) {
      setCartField(input.dataset.lineKey, input.dataset.field || 'note', input.value);
    }
  });

  // Modalidad Retiro / Delivery
  $$('.delivery-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.deliveryMode = btn.dataset.delivery;
      $('#customerAddress')?.classList.remove('is-invalid');
      syncDeliveryUI();
      saveCheckoutPrefs();
      renderCart();
    });
  });

  // Zona de delivery, nombre, dirección y medio de pago
  $('#deliveryZoneSelect')?.addEventListener('change', (e) => {
    state.deliveryZoneId = e.target.value;
    saveCheckoutPrefs();
    renderCart();
  });

  ['#customerName', '#customerAddress', '#paymentMethod'].forEach((selector) => {
    const el = $(selector);
    el?.addEventListener('input', () => {
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
      saveCheckoutPrefs();
    });
    el?.addEventListener('change', () => {
      saveCheckoutPrefs();
      if (el.id === 'paymentMethod') syncAliasCard();
    });
  });

  // Copiar Alias bancario en 1 toque
  $('#copyAliasBtn')?.addEventListener('click', async (e) => {
    const alias = SITE.payment?.alias || '';
    if (!alias) return;
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(alias);
      btn.textContent = '✓ ¡Copiado!';
      btn.classList.add('is-copied');
      showToast(`✓ Alias "${alias}" copiado al portapapeles`);
      setTimeout(() => {
        btn.textContent = '📋 Copiar Alias';
        btn.classList.remove('is-copied');
      }, 2000);
    } catch {
      showToast(`Alias: ${alias}`);
    }
  });

  // Enviar por WhatsApp + Registrar venta en Sheets + Ticket Térmico Animado
  $('#sendWhatsappBtn')?.addEventListener('click', () => {
    if (!state.cart.length) {
      showToast('Agregá al menos un producto al pedido');
      return;
    }
    if (!validateOrder()) return;

    const meta = createOrderMeta();
    const totals = getCartTotals();
    const text = buildWhatsAppOrderText(meta);
    const url = `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(text)}`;

    logOrderToSheet(meta);
    openTicketModal(meta, url);

    track('send_whatsapp_order', {
      order_id: meta.code,
      value: totals.total,
      currency: 'ARS',
      items: state.cart.reduce((acc, i) => acc + i.qty, 0),
      mode: state.deliveryMode,
    });

    window.open(url, '_blank', 'noopener,noreferrer');
  });

  // Cerrar Ticket Térmico
  $('#closeTicketBtn')?.addEventListener('click', closeTicketModal);
  $('#ticketOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'ticketOverlay') closeTicketModal();
  });

  // Copiar detalle del pedido
  $('#copyOrderBtn')?.addEventListener('click', async () => {
    if (!state.cart.length) {
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
  const mobileBtn = $('#mobileMenuBtn');
  const navLinks = $('#navLinks');
  const setMobileMenu = (open) => {
    if (!navLinks || !mobileBtn) return;
    navLinks.classList.toggle('is-open', open);
    mobileBtn.setAttribute('aria-expanded', String(open));
  };

  mobileBtn?.addEventListener('click', () => setMobileMenu(!navLinks?.classList.contains('is-open')));
  navLinks?.addEventListener('click', (e) => {
    if (e.target.closest('a')) setMobileMenu(false);
  });

  // Accesibilidad por teclado
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const ticketOverlay = $('#ticketOverlay');
      if (ticketOverlay && !ticketOverlay.hidden) {
        closeTicketModal();
      } else if (isDrawerOpen()) {
        closeCartDrawer();
      } else if (navLinks?.classList.contains('is-open')) {
        setMobileMenu(false);
        mobileBtn?.focus();
      }
    } else if (e.key === 'Tab' && isDrawerOpen()) {
      trapFocusInDrawer(e);
    }
  });
});