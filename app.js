'use strict';

/**
 * BUENARDA (@buenardaparana) - Lógica de Carta, Renderizado SVG y Carrito WhatsApp
 * Local: Colón 696, Paraná, Entre Ríos · Miércoles a Domingo
 */

const WHATSAPP_NUMBER = '5493434717233'; // Reemplazar con el número oficial de WhatsApp de Buenarda Paraná
const TRIPLE_EXTRA_PRICE = 2400;

const MENU_ITEMS = [
  {
    id: '7th-street',
    name: '7TH STREET',
    category: 'clasicas',
    badge: 'Top Ventas',
    isBurger: true,
    basePrice: 11800,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO CHEDDAR AMERICANO X4, PEPINILLOS, CEBOLLA FRESCA BRUNOISE, SALSA THOUSAND ISLAND.',
    layers: {
      cheese: 'cheddar',
      pickles: true,
      dicedOnion: true,
      sauce: 'thousand-island',
    },
  },
  {
    id: 'egg-bacon',
    name: 'EGG BACON',
    category: 'bacon',
    badge: 'Bomba',
    isBurger: true,
    basePrice: 12900,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO CHEDDAR X4, BACON AHUMADO, HUEVO FRITO, SALSA BARBACOA.',
    layers: {
      cheese: 'cheddar',
      bacon: true,
      egg: true,
      sauce: 'bbq',
    },
  },
  {
    id: 'caramel-bacon',
    name: 'CARAMEL BACON',
    category: 'bacon',
    badge: 'Cheddar Ahumado',
    isBurger: true,
    basePrice: 12900,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO CHEDDAR AHUMADO X4, BACON AHUMADO, CEBOLLA CARAMEL, SALSA BARBACOA.',
    layers: {
      cheese: 'smoked-cheddar',
      bacon: true,
      caramelOnion: true,
      sauce: 'bbq',
    },
  },
  {
    id: 'bbq-crispy',
    name: 'BBQ CRISPY',
    category: 'especiales',
    badge: 'Crocante',
    isBurger: true,
    basePrice: 12200,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO CHEDDAR X4, CEBOLLA CRISPY, SALSA BARBACOA.',
    layers: {
      cheese: 'cheddar',
      crispyOnion: true,
      sauce: 'bbq',
    },
  },
  {
    id: 'americana',
    name: 'AMERICANA',
    category: 'especiales',
    badge: 'Con Provolone',
    isBurger: true,
    basePrice: 12800,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO PROVOLONE X4, LECHUGA, TOMATE, CEBOLLA, HUEVO FRITO, SALSA THOUSAND ISLAND.',
    layers: {
      cheese: 'provolone',
      lettuce: true,
      tomato: true,
      dicedOnion: true,
      egg: true,
      sauce: 'thousand-island',
    },
  },
  {
    id: 'crispy-bacon',
    name: 'CRISPY BACON',
    category: 'bacon',
    badge: 'Salsa Alioli',
    isBurger: true,
    basePrice: 12900,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO CHEDDAR SMOKED X4, BACON AHUMADO, CEBOLLA CRISPY, SALSA ALIOLI.',
    layers: {
      cheese: 'smoked-cheddar',
      bacon: true,
      crispyOnion: true,
      sauce: 'alioli',
    },
  },
  {
    id: 'bacon-cheese-burger',
    name: 'BACON CHEESE BURGER',
    category: 'bacon',
    badge: 'Salsa Buenarda',
    isBurger: true,
    basePrice: 12500,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO CHEDDAR X4, BACON AHUMADO, SALSA BUENARDA.',
    layers: {
      cheese: 'cheddar',
      bacon: true,
      sauce: 'buenarda',
    },
  },
  {
    id: 'cheese-burger',
    name: 'CHEESE BURGER',
    category: 'clasicas',
    badge: 'Clásica',
    isBurger: true,
    basePrice: 10900,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO CHEDDAR X4, SALSA ROYALE (CEBOLLA FRESCA EN DADOS CON KETCHUP).',
    layers: {
      cheese: 'cheddar',
      dicedOnion: true,
      sauce: 'royale',
    },
  },
  {
    id: 'papas-clasicas',
    name: 'PAPAS BUENARDA',
    category: 'extras',
    badge: 'Acompañamiento',
    isBurger: false,
    basePrice: 4800,
    ingredients: 'PORCIÓN ABUNDANTE DE PAPAS BASTÓN DORADAS Y CROCANTES.',
    icon: '🍟',
  },
  {
    id: 'papas-cheddar-bacon',
    name: 'PAPAS CHEDDAR & BACON',
    category: 'extras',
    badge: 'Para Compartir',
    isBurger: false,
    basePrice: 6900,
    ingredients: 'PAPAS FRITAS CROCANTES BAÑADAS EN CHEDDAR FUNDIDO Y BACON AHUMADO.',
    icon: '🧀',
  },
  {
    id: 'gaseosa-lata',
    name: 'GASEOSA LATA 354ML',
    category: 'extras',
    badge: 'Bebida Fría',
    isBurger: false,
    basePrice: 2500,
    ingredients: 'COCA-COLA, COCA-COLA SIN AZÚCAR, SPRITE O FANTA BIEN FRÍA.',
    icon: '🥤',
  },
  {
    id: 'cerveza-lata',
    name: 'CERVEZA RUBIA LATA 473ML',
    category: 'extras',
    badge: '+18 · Fría',
    isBurger: false,
    basePrice: 3600,
    ingredients: 'CERVEZA LAGER HELADA IDEAL PARA ACOMPAÑAR TU BURGER.',
    icon: '🍺',
  },
];

// Estado global de la aplicación
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
    const saved = localStorage.getItem('buenarda_cart_v1');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem('buenarda_cart_v1', JSON.stringify(state.cart));
  } catch {
    // Ignorar errores de almacenamiento privado
  }
}

function formatARS(amount) {
  return '$' + amount.toLocaleString('es-AR');
}

/**
 * Genera una ilustración SVG detallada con los ingredientes exactos de cada burger
 */
function createBurgerSVG(item, isTriple = false) {
  if (!item.isBurger) {
    return `<div style="font-size: 4.5rem; line-height: 1;">${item.icon || '🍔'}</div>`;
  }

  const layers = item.layers || {};
  const cheeseColor =
    layers.cheese === 'provolone'
      ? '#F4EFE6'
      : layers.cheese === 'smoked-cheddar'
        ? '#F6E2B3'
        : '#F5B700';

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
    <svg viewBox="0 0 220 ${viewBoxHeight}" role="img" aria-label="${item.name}">
      <defs>
        <linearGradient id="bunGrad-${item.id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#D9822B" />
          <stop offset="100%" stop-color="#9E5216" />
        </linearGradient>
      </defs>

      <!-- Pan superior -->
      <path d="M42 64 C42 28 178 28 178 64 Z" fill="url(#bunGrad-${item.id})" />
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
      ${
        layers.tomato
          ? `<rect x="48" y="81" width="124" height="6" rx="3" fill="#D92B2B" />`
          : ''
      }

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

/**
 * Renderiza la tarjeta destacada interactiva del Hero
 */
function renderHeroShowcase() {
  const burgers = MENU_ITEMS.filter((item) => item.isBurger);
  const current = burgers[state.heroIndex % burgers.length];

  const visualEl = document.getElementById('heroBurgerVisual');
  const nameEl = document.getElementById('heroBurgerName');
  const priceEl = document.getElementById('heroBurgerPrice');
  const descEl = document.getElementById('heroBurgerDesc');
  const dotsEl = document.getElementById('heroDots');

  if (!visualEl || !current) return;

  visualEl.innerHTML = createBurgerSVG(current, false);
  nameEl.textContent = current.name;
  priceEl.textContent = formatARS(current.basePrice);
  descEl.textContent = current.ingredients;

  dotsEl.innerHTML = burgers
    .map(
      (b, idx) =>
        `<button type="button" class="story-dot ${idx === state.heroIndex ? 'is-active' : ''}" data-hero-dot="${idx}" aria-label="Ver ${b.name}"></button>`
    )
    .join('');
}

/**
 * Renderiza el catálogo filtrado de hamburguesas y acompañamientos
 */
function renderMenuGrid() {
  const gridEl = document.getElementById('menuGrid');
  if (!gridEl) return;

  const query = state.search.trim().toLowerCase();

  const filtered = MENU_ITEMS.filter((item) => {
    const matchesCategory = state.filter === 'all' || item.category === state.filter;
    const matchesSearch =
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.ingredients.toLowerCase().includes(query);
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

  gridEl.innerHTML = filtered
    .map((item) => {
      const selectedSize = state.selectedSizes[item.id] || 'doble';
      const isTriple = item.isBurger && selectedSize === 'triple';
      const finalPrice = item.basePrice + (isTriple ? TRIPLE_EXTRA_PRICE : 0);

      const sizeSelectorHTML = item.isBurger
        ? `
          <div class="size-selector" role="group" aria-label="Tamaño de ${item.name}">
            <button type="button" class="size-btn ${!isTriple ? 'is-active' : ''}" data-size-id="${item.id}" data-size="doble">
              Doble (x4 Queso)
            </button>
            <button type="button" class="size-btn ${isTriple ? 'is-active' : ''}" data-size-id="${item.id}" data-size="triple">
              Triple (+${formatARS(TRIPLE_EXTRA_PRICE)})
            </button>
          </div>
        `
        : '';

      return `
        <article class="burger-card">
          <div>
            <div class="burger-card__top">
              <span class="burger-card__badge">${item.badge}</span>
            </div>
            <div class="burger-card__visual">
              ${createBurgerSVG(item, isTriple)}
            </div>
            <h3 class="burger-card__title">${item.name}</h3>
            <p class="burger-card__ingredients">${item.ingredients}</p>
          </div>

          <div>
            ${sizeSelectorHTML}
            <div class="burger-card__footer">
              <span class="burger-card__price">${formatARS(finalPrice)}</span>
              <button type="button" class="btn-add" data-add-id="${item.id}">
                + Agregar
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

/**
 * Agrega un ítem al carrito y actualiza UI
 */
function addToCart(itemId, forcedSize = null) {
  const item = MENU_ITEMS.find((entry) => entry.id === itemId);
  if (!item) return;

  const size = item.isBurger ? forcedSize || state.selectedSizes[item.id] || 'doble' : 'unico';
  const unitPrice = item.basePrice + (size === 'triple' ? TRIPLE_EXTRA_PRICE : 0);
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
    });
  }

  saveCartToStorage();
  renderCart();
  showToast(`✓ ${item.name} agregada al pedido`);
}

function updateCartQty(cartKey, delta) {
  const index = state.cart.findIndex((c) => c.key === cartKey);
  if (index === -1) return;

  state.cart[index].qty += delta;
  if (state.cart[index].qty <= 0) {
    state.cart.splice(index, 1);
  }

  saveCartToStorage();
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartItemsContainer');
  const badge = document.getElementById('cartCountBadge');
  const subtotalEl = document.getElementById('cartSubtotal');
  const totalEl = document.getElementById('cartTotal');

  const totalUnits = state.cart.reduce((acc, item) => acc + item.qty, 0);
  const totalAmount = state.cart.reduce((acc, item) => acc + item.unitPrice * item.qty, 0);

  if (badge) badge.textContent = String(totalUnits);
  if (subtotalEl) subtotalEl.textContent = formatARS(totalAmount);
  if (totalEl) totalEl.textContent = formatARS(totalAmount);

  if (!container) return;

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <p><strong>Tu pedido está vacío</strong></p>
        <p>Elegí cualquiera de nuestras 8 burgers oficiales para empezar.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.cart
    .map(
      (item) => `
        <div class="cart-item">
          <div class="cart-item__info">
            <h4>${item.name}</h4>
            <span class="cart-item__meta">${item.sizeLabel} · ${formatARS(item.unitPrice * item.qty)}</span>
          </div>
          <div class="cart-item__controls">
            <button type="button" class="qty-btn" data-qty-key="${item.key}" data-delta="-1" aria-label="Restar unidad">−</button>
            <strong>${item.qty}</strong>
            <button type="button" class="qty-btn" data-qty-key="${item.key}" data-delta="1" aria-label="Sumar unidad">+</button>
          </div>
        </div>
      `
    )
    .join('');
}

function buildWhatsAppOrderText() {
  const name = document.getElementById('customerName')?.value.trim() || 'Cliente Web';
  const address = document.getElementById('customerAddress')?.value.trim();
  const payment = document.getElementById('paymentMethod')?.value || 'Efectivo';
  const notes = document.getElementById('orderNotes')?.value.trim();

  const lines = [
    '🍔 *NUEVO PEDIDO — BUENARDA PARANÁ*',
    `👤 *Cliente:* ${name}`,
    state.deliveryMode === 'delivery'
      ? `🛵 *Modalidad:* Delivery (${address || 'Dirección a confirmar'})`
      : '🏪 *Modalidad:* Retiro en Colón 696 - Paraná',
    `💳 *Pago:* ${payment}`,
    '',
    '*Detalle del pedido:*',
  ];

  state.cart.forEach((item) => {
    lines.push(`• ${item.qty}x ${item.name} (${item.sizeLabel}) — ${formatARS(item.unitPrice * item.qty)}`);
  });

  const total = state.cart.reduce((acc, item) => acc + item.unitPrice * item.qty, 0);
  lines.push('');
  lines.push(`💰 *TOTAL ESTIMADO:* ${formatARS(total)}`);

  if (notes) {
    lines.push(`📝 *Notas:* ${notes}`);
  }

  return lines.join('\n');
}

function openCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (!drawer || !overlay) return;
  overlay.hidden = false;
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
}

function closeCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (!drawer || !overlay) return;
  overlay.hidden = true;
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
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

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * Reproductor del video "Recorrido por el local".
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

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    playBtn.setAttribute('aria-label', 'Reproducir video');
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
    if (!video.muted && video.paused) {
      pausedByUser = false;
      safePlay();
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
            if (!reduceMotion && !pausedByUser) safePlay();
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

/**
 * Inicialización de eventos
 */
document.addEventListener('DOMContentLoaded', () => {
  renderHeroShowcase();
  renderMenuGrid();
  renderCart();

  const burgersCount = MENU_ITEMS.filter((i) => i.isBurger).length;

  // Controles del Hero Showcase
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

  document.getElementById('addHeroBurgerBtn')?.addEventListener('click', () => {
    const burgers = MENU_ITEMS.filter((i) => i.isBurger);
    const current = burgers[state.heroIndex % burgers.length];
    if (current) addToCart(current.id, 'doble');
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

  // Delegación en la grilla de productos (Tamaño Doble/Triple y Agregar)
  document.getElementById('menuGrid')?.addEventListener('click', (e) => {
    const sizeBtn = e.target.closest('[data-size-id]');
    if (sizeBtn) {
      state.selectedSizes[sizeBtn.dataset.sizeId] = sizeBtn.dataset.size;
      renderMenuGrid();
      return;
    }

    const addBtn = e.target.closest('[data-add-id]');
    if (addBtn) {
      addToCart(addBtn.dataset.addId);
    }
  });

  // Abrir / Cerrar carrito
  document.getElementById('openCartBtn')?.addEventListener('click', openCartDrawer);
  document.getElementById('closeCartBtn')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCartDrawer);

  // Cantidades en el carrito
  document.getElementById('cartItemsContainer')?.addEventListener('click', (e) => {
    const qtyBtn = e.target.closest('[data-qty-key]');
    if (!qtyBtn) return;
    updateCartQty(qtyBtn.dataset.qtyKey, Number(qtyBtn.dataset.delta));
  });

  // Toggle Retiro / Delivery
  document.querySelectorAll('.delivery-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.deliveryMode = btn.dataset.delivery;
      document.querySelectorAll('.delivery-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const addressInput = document.getElementById('customerAddress');
      if (addressInput) {
        addressInput.hidden = state.deliveryMode !== 'delivery';
      }
    });
  });

  // Enviar por WhatsApp
  document.getElementById('sendWhatsappBtn')?.addEventListener('click', () => {
    if (state.cart.length === 0) {
      showToast('Agregá al menos un producto al pedido');
      return;
    }
    const text = buildWhatsAppOrderText();
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  // Copiar detalle del pedido
  document.getElementById('copyOrderBtn')?.addEventListener('click', async () => {
    if (state.cart.length === 0) {
      showToast('Tu pedido está vacío');
      return;
    }
    const text = buildWhatsAppOrderText();
    try {
      await navigator.clipboard.writeText(text);
      showToast('✓ Pedido copiado al portapapeles');
    } catch {
      showToast('No se pudo copiar automáticamente');
    }
  });

  initTourVideo();

  // Menú móvil
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');
  mobileBtn?.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    mobileBtn.setAttribute('aria-expanded', String(isOpen));
  });
});
