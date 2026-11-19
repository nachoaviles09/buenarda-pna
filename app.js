'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // 1. ESTADO GLOBAL
  // ==========================================================================
  const state = {
    items: Array.isArray(MENU_ITEMS) ? MENU_ITEMS.map((item) => ({ ...item, available: true })) : [],
    zones: Array.isArray(DELIVERY_ZONES) ? [...DELIVERY_ZONES] : [],
    cart: loadCartFromStorage(),
    selectedSizes: {}, // { [itemId]: 'doble' | 'triple' }
    activeCategory: 'all',
    searchQuery: '',
    heroIndex: 0,
    deliveryMode: 'retiro', // 'retiro' | 'delivery'
    selectedZoneId: DELIVERY_ZONES?.[0]?.id || '',
    paymentMethod: 'Efectivo',
    cashChangeType: 'justo', // 'justo' | 'cambio'
    cashPayAmount: '',
  };

  // ==========================================================================
  // 2. UTILIDADES
  // ==========================================================================
  const $ = (sel, parent = document) => parent.querySelector(sel);
  const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

  function formatARS(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'A confirmar';
    return '$' + Math.round(Number(value)).toLocaleString('es-AR');
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, ''');
  }

  let toastTimer = null;
  function showToast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2800);
  }

  function loadCartFromStorage() {
    try {
      const raw = localStorage.getItem('buenarda_cart_v2');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveCartToStorage() {
    try {
      localStorage.setItem('buenarda_cart_v2', JSON.stringify(state.cart));
    } catch {
      // Ignorar errores de cuota
    }
  }

  function cartHasPromo() {
    return state.cart.some((entry) => Boolean(entry.isPromo || entry.cashOnly));
  }

  function getItemUnitPrice(item, size = 'doble') {
    const base = Number(item.basePrice) || 0;
    if (item.isBurger && size === 'triple') {
      return base + (Number(SITE.tripleExtraPrice) || 0);
    }
    return base;
  }

  function getShippingCost() {
    if (state.deliveryMode !== 'delivery') return 0;
    if (state.zones.length > 0) {
      const zone = state.zones.find((z) => z.id === state.selectedZoneId) || state.zones[0];
      return zone ? zone.fee : null;
    }
    return SITE.delivery?.fee ?? null;
  }

  function getSelectedZoneName() {
    if (state.deliveryMode !== 'delivery' || state.zones.length === 0) return '';
    const zone = state.zones.find((z) => z.id === state.selectedZoneId) || state.zones[0];
    return zone ? zone.name : '';
  }

  // ==========================================================================
  // 3. ILUSTRACIONES SVG Y FOTOS REALES
  // ==========================================================================
  function buildBurgerSVG(layers = {}, size = 'doble') {
    const isTriple = size === 'triple';
    const cheeseColor =
      layers.cheese === 'provolone'
        ? '#f4eedc'
        : layers.cheese === 'smoked-cheddar'
          ? '#e89611'
          : '#f5b700';

    const extraPatty = isTriple
      ? `
      <g class="svg-extra-patty">
        <rect x="44" y="96" width="132" height="19" rx="9" fill="#4a2511" stroke="#2b1307" stroke-width="2"/>
        <polygon points="48,96 172,96 164,107 132,102 108,110 82,102 56,107" fill="${cheeseColor}"/>
      </g>`
      : '';

    const yOffset = isTriple ? 14 : 0;

    return `
      <svg viewBox="0 0 220 175" width="190" height="150" aria-hidden="true">
        <ellipse cx="110" cy="162" rx="74" ry="8" fill="rgba(0,0,0,0.45)"/>
        <!-- Pan inferior -->
        <path d="M46 ${132 + yOffset} H174 C174 ${146 + yOffset}, 162 ${152 + yOffset}, 110 ${152 + yOffset} C58 ${152 + yOffset}, 46 ${146 + yOffset}, 46 ${132 + yOffset} Z" fill="#d98a36" stroke="#8a4b14" stroke-width="2"/>
        ${layers.pickles ? `<g fill="#4d8c3a"><ellipse cx="78" cy="${129 + yOffset}" rx="15" ry="4"/><ellipse cx="112" cy="${130 + yOffset}" rx="16" ry="4"/><ellipse cx="144" cy="${129 + yOffset}" rx="15" ry="4"/></g>` : ''}
        <!-- Medallón 2 -->
        <rect x="42" y="${113 + yOffset}" width="136" height="20" rx="10" fill="#4a2511" stroke="#2b1307" stroke-width="2"/>
        <polygon points="46,${113 + yOffset} 174,${113 + yOffset} 162,${125 + yOffset} 126,${119 + yOffset} 104,${127 + yOffset} 76,${119 + yOffset} 54,${125 + yOffset}" fill="${cheeseColor}"/>
        ${extraPatty}
        <!-- Medallón 1 -->
        <rect x="44" y="92" width="132" height="20" rx="10" fill="#542a14" stroke="#2b1307" stroke-width="2"/>
        <polygon points="48,92 172,92 160,104 128,98 106,106 78,98 56,104" fill="${cheeseColor}"/>
        ${layers.bacon ? `<path d="M50 86 Q72 79 92 86 T134 86 T170 86" fill="none" stroke="#9e2a2b" stroke-width="7" stroke-linecap="round"/><path d="M54 86 Q74 81 92 86 T134 86 T166 86" fill="none" stroke="#e07a5f" stroke-width="2" stroke-linecap="round"/>` : ''}
        ${layers.egg ? `<ellipse cx="110" cy="82" rx="44" ry="8" fill="#ffffff"/><circle cx="110" cy="80" r="11" fill="#ffb703"/>` : ''}
        ${layers.tomato ? `<rect x="54" y="75" width="112" height="6" rx="3" fill="#d62828"/>` : ''}
        ${layers.lettuce ? `<path d="M46 74 Q62 66 78 74 T110 74 T142 74 T174 74" fill="none" stroke="#52b788" stroke-width="6" stroke-linecap="round"/>` : ''}
        ${layers.crispyOnion ? `<path d="M56 75 Q80 65 110 74 Q140 65 164 75" fill="none" stroke="#c97a2b" stroke-width="5" stroke-dasharray="6 4" stroke-linecap="round"/>` : ''}
        ${layers.caramelOnion ? `<path d="M58 76 Q110 68 162 76" fill="none" stroke="#6f3618" stroke-width="5" stroke-linecap="round"/>` : ''}
        <!-- Pan superior -->
        <path d="M44 72 C44 34, 176 34, 176 72 Z" fill="#e5983e" stroke="#8a4b14" stroke-width="2"/>
        <ellipse cx="92" cy="48" rx="3" ry="1.6" fill="#fff3c4" transform="rotate(-15 92 48)"/>
        <ellipse cx="114" cy="44" rx="3" ry="1.6" fill="#fff3c4" transform="rotate(10 114 44)"/>
        <ellipse cx="134" cy="51" rx="3" ry="1.6" fill="#fff3c4" transform="rotate(20 134 51)"/>
        <ellipse cx="76" cy="56" rx="3" ry="1.6" fill="#fff3c4" transform="rotate(-25 76 56)"/>
      </svg>
    `;
  }

  function renderItemVisual(item, size = 'doble') {
    if (SITE.usePhotos && item.isBurger) {
      const ext = SITE.photoExtension || 'jpg';
      const src = `assets/burgers/${item.id}.${ext}`;
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.name)}" class="item-photo" loading="lazy" />`;
    }
    if (item.isBurger) {
      return buildBurgerSVG(item.layers, size);
    }
    return `<span class="extra-emoji" aria-hidden="true">${escapeHtml(item.icon || '🍔')}</span>`;
  }

  // ==========================================================================
  // 4. DATOS DE MARCA, HORARIOS Y BANNER PROMO
  // ==========================================================================
  function applyBrandBindings() {
    const b = SITE.brand || {};
    $$('[data-bind="brandName"]').forEach((el) => (el.textContent = b.name || 'BUENARDA'));
    $$('[data-bind="brandHandle"]').forEach((el) => (el.textContent = b.handle || '@buenardaparana'));
    $$('[data-bind="brandAddress"]').forEach((el) => (el.textContent = b.shortAddress || 'Colón 696, Paraná'));
    $$('[data-bind="igShort"]').forEach((el) => (el.textContent = SITE.instagramFollowers?.short || '+17.5K'));
    $$('[data-bind="igLong"]').forEach((el) => (el.textContent = SITE.instagramFollowers?.long || '17,5 mil'));
    $$('[data-bind="igLink"]').forEach((el) => {
      if (b.instagramUrl) el.href = b.instagramUrl;
    });
    $$('[data-bind="mapsLink"]').forEach((el) => {
      if (b.mapsUrl) el.href = b.mapsUrl;
    });

    if (b.primaryColor) {
      document.documentElement.style.setProperty('--cheddar', b.primaryColor);
    }

    const hoursEl = $('#hoursSummaryText');
    if (hoursEl && SITE.hours?.fullLabel) hoursEl.textContent = SITE.hours.fullLabel;

    const policyPublicEl = $('#shippingPolicyPublicText');
    if (policyPublicEl && SITE.shippingPolicy) policyPublicEl.textContent = SITE.shippingPolicy;

    const policyCartEl = $('#shippingRuleCartText');
    if (policyCartEl && SITE.shippingPolicy) {
      policyCartEl.textContent = SITE.shippingPolicy.replace(/^ENVIOS:\s*/i, '');
    }

    const aliasText = $('#transferAliasText');
    if (aliasText && SITE.payment?.alias) aliasText.textContent = SITE.payment.alias;

    const holderText = $('#transferHolderText');
    if (holderText) {
      holderText.textContent = SITE.payment?.holder ? `Titular: ${SITE.payment.holder}` : '';
    }
  }

  function updateOpenStatus() {
    const dot = $('#openStatusDot');
    const text = $('#openStatusText');
    const notice = $('#cartOpenNotice');
    if (!dot || !text) return;

    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: SITE.timeZone || 'America/Argentina/Buenos_Aires',
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);

    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value || 'Wed';
    const hourVal = Number(parts.find((p) => p.type === 'hour')?.value || 0);
    const dayNum = dayMap[weekdayStr] ?? 3;

    const openDays = SITE.hours?.openDays || [3, 4, 5, 6, 0];
    const openH = Number(SITE.hours?.open ?? 20);
    const closeH = Number(SITE.hours?.close ?? 24);
    const isOpen = openDays.includes(dayNum) && hourVal >= openH && hourVal < closeH;

    dot.classList.toggle('is-open', isOpen);
    dot.classList.toggle('is-closed', !isOpen);
    text.textContent = isOpen
      ? `ABIERTO AHORA · HASTA LAS ${closeH === 24 ? '00:00' : closeH + ':00'} HS`
      : `CERRADO · ABRIMOS ${SITE.hours?.label || 'MIÉ A DOM 20:00 HS'}`;

    if (notice) {
      if (!isOpen) {
        notice.hidden = false;
        notice.textContent = `⏰ En este momento el local está cerrado (${SITE.hours?.label || 'Mié a Dom 20 a 00 hs'}). Igual podés dejar tu pedido programado por WhatsApp.`;
      } else {
        notice.hidden = true;
      }
    }
  }

  function renderNightPromo() {
    const card = $('#nightPromoCard');
    if (!card) return;
    const p = SITE.promo;
    if (!p || !p.active) {
      card.hidden = true;
      return;
    }

    card.hidden = false;
    $('#promoBadge').textContent = p.badge || '💵 PROMO OFICIAL · SOLO EFECTIVO';
    $('#promoTitle').textContent = p.title || '';
    $('#promoText').textContent = p.subtitle || '';
    $('#promoPrice').textContent = formatARS(p.price);

    const oldEl = $('#promoOldPrice');
    if (oldEl) {
      if (p.oldPrice && Number(p.oldPrice) > Number(p.price)) {
        oldEl.hidden = false;
        oldEl.textContent = formatARS(p.oldPrice);
      } else {
        oldEl.hidden = true;
      }
    }
  }

  // ==========================================================================
  // 5. VITRINA HERO (SHOWCASE)
  // ==========================================================================
  function getHeroBurgers() {
    const burgers = state.items.filter((i) => i.isBurger && i.available !== false);
    return burgers.length > 0 ? burgers : state.items.slice(0, 4);
  }

  function renderHeroShowcase() {
    const burgers = getHeroBurgers();
    if (burgers.length === 0) return;

    state.heroIndex = ((state.heroIndex % burgers.length) + burgers.length) % burgers.length;
    const current = burgers[state.heroIndex];

    $('#heroBurgerVisual').innerHTML = renderItemVisual(current, 'doble');
    $('#heroBurgerName').textContent = current.name;
    $('#heroBurgerPrice').textContent = formatARS(current.basePrice);
    $('#heroBurgerDesc').textContent = current.ingredients;

    const dotsWrap = $('#heroDots');
    dotsWrap.innerHTML = burgers
      .map(
        (b, idx) =>
          `<button type="button" class="story-dot ${idx === state.heroIndex ? 'is-active' : ''}" data-hero-idx="${idx}" aria-label="Ver ${escapeHtml(b.name)}"></button>`
      )
      .join('');
  }

  // ==========================================================================
  // 6. CARTA OFICIAL Y PROMOS
  // ==========================================================================
  function renderMenu() {
    const grid = $('#menuGrid');
    if (!grid) return;

    const q = state.searchQuery.trim().toLowerCase();
    const filtered = state.items.filter((item) => {
      const matchCat = state.activeCategory === 'all' || item.category === state.activeCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.ingredients && item.ingredients.toLowerCase().includes(q)) ||
        (item.badge && item.badge.toLowerCase().includes(q))
      );
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="menu-empty">No encontramos productos con "${escapeHtml(state.searchQuery)}". Probá con otro término.</div>`;
      return;
    }

    grid.innerHTML = filtered
      .map((item) => {
        const size = state.selectedSizes[item.id] || 'doble';
        const price = getItemUnitPrice(item, size);
        const isSoldOut = item.available === false;
        const isCashOnly = Boolean(item.cashOnly || item.isPromo);

        const sizeSelectorHtml = item.isBurger
          ? `
          <div class="size-selector" role="group" aria-label="Tamaño de ${escapeHtml(item.name)}">
            <button type="button" class="size-btn ${size === 'doble' ? 'is-active' : ''}" data-action="size" data-id="${escapeHtml(item.id)}" data-size="doble" ${isSoldOut ? 'disabled' : ''}>
              Doble · ${formatARS(item.basePrice)}
            </button>
            <button type="button" class="size-btn ${size === 'triple' ? 'is-active' : ''}" data-action="size" data-id="${escapeHtml(item.id)}" data-size="triple" ${isSoldOut ? 'disabled' : ''}>
              Triple · +${formatARS(SITE.tripleExtraPrice)}
            </button>
          </div>`
          : '';

        const cashOnlyHtml = isCashOnly
          ? `<span class="burger-card__cash-tag">💵 Válido solo en efectivo</span>`
          : '';

        const fixedNoteHtml = item.isBurger
          ? `<span class="burger-card__fixed-note">🚫 Sale tal cual carta · Sin modificaciones</span>`
          : '';

        return `
          <article class="burger-card ${item.isPromo ? 'burger-card--promo' : ''} ${isSoldOut ? 'is-sold-out' : ''}" data-card-id="${escapeHtml(item.id)}">
            <div class="burger-card__top">
              <span class="burger-card__badge">${escapeHtml(isSoldOut ? 'Agotado por hoy' : item.badge || 'Buenarda')}</span>
              <span class="burger-card__price">${formatARS(price)}</span>
            </div>

            <div class="burger-card__visual">
              <span class="smash-burst" aria-hidden="true"></span>
              ${renderItemVisual(item, size)}
            </div>

            <div class="burger-card__body">
              <h3 class="burger-card__title">${escapeHtml(item.name)}</h3>
              <p class="burger-card__ingredients">${escapeHtml(item.ingredients)}</p>
              ${cashOnlyHtml}
              ${fixedNoteHtml}
            </div>

            <div class="burger-card__footer">
              ${sizeSelectorHtml}
              <button
                type="button"
                class="btn btn--primary btn--full"
                data-action="add"
                data-id="${escapeHtml(item.id)}"
                ${isSoldOut ? 'disabled' : ''}
              >
                ${isSoldOut ? 'Agotado por hoy' : '+ Agregar al Pedido'}
              </button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // ==========================================================================
  // 7. CARRITO, REGLA SOLO EFECTIVO EN PROMOS Y CAMBIO/PAGO JUSTO
  // ==========================================================================
  function addToCart(itemId, forcedSize = null) {
    const item = state.items.find((i) => i.id === itemId);
    if (!item || item.available === false) return;

    const size = item.isBurger ? forcedSize || state.selectedSizes[item.id] || 'doble' : 'unica';
    const unitPrice = getItemUnitPrice(item, size);
    const isPromo = Boolean(item.isPromo || item.cashOnly);

    const existingIndex = state.cart.findIndex(
      (entry) => entry.id === item.id && entry.size === size && !entry.person && !entry.note
    );

    if (existingIndex >= 0) {
      state.cart[existingIndex].qty += 1;
    } else {
      state.cart.push({
        uid: `${item.id}-${size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        id: item.id,
        name: item.name,
        size,
        isBurger: Boolean(item.isBurger),
        isPromo,
        cashOnly: isPromo,
        unitPrice,
        qty: 1,
        person: '',
        note: '',
      });
    }

    saveCartToStorage();
    renderCart();

    if (isPromo) {
      showToast(`💵 ${item.name} agregada (Promo válida solo en efectivo)`);
    } else {
      showToast(`🍔 ${item.name} agregada a tu pedido`);
    }
  }

  function syncPaymentConstraints() {
    const hasPromo = cartHasPromo();
    const paymentSelect = $('#paymentMethod');
    const promoCashNotice = $('#promoCashNotice');
    const aliasCard = $('#aliasCard');
    const cashChangeBox = $('#cashChangeBox');
    const cashAmountInput = $('#cashPayAmount');

    if (paymentSelect) {
      const nonCashOptions = $$('option', paymentSelect).filter((opt) => opt.value !== 'Efectivo');
      nonCashOptions.forEach((opt) => {
        opt.disabled = hasPromo;
      });

      if (hasPromo && paymentSelect.value !== 'Efectivo') {
        paymentSelect.value = 'Efectivo';
        state.paymentMethod = 'Efectivo';
      } else {
        state.paymentMethod = paymentSelect.value;
      }
    }

    if (promoCashNotice) {
      promoCashNotice.hidden = !hasPromo;
    }

    if (aliasCard) {
      aliasCard.hidden = state.paymentMethod !== 'Transferencia';
    }

    if (cashChangeBox) {
      cashChangeBox.hidden = state.paymentMethod !== 'Efectivo';
    }

    if (cashAmountInput) {
      cashAmountInput.hidden = !(state.paymentMethod === 'Efectivo' && state.cashChangeType === 'cambio');
    }
  }

  function renderDeliveryZones() {
    const select = $('#deliveryZoneSelect');
    if (!select) return;
    if (state.zones.length === 0) {
      select.innerHTML = '';
      return;
    }
    if (!state.selectedZoneId) {
      state.selectedZoneId = state.zones[0].id;
    }
    select.innerHTML = state.zones
      .map(
        (z) =>
          `<option value="${escapeHtml(z.id)}" ${z.id === state.selectedZoneId ? 'selected' : ''}>${escapeHtml(z.name)} — ${formatARS(z.fee)}</option>`
      )
      .join('');
  }

  function renderCart() {
    const container = $('#cartItemsContainer');
    const countBadge = $('#cartCountBadge');
    const mobileBar = $('#mobileCartBar');
    const mobileCount = $('#mobileCartCount');
    const mobileTotal = $('#mobileCartTotal');

    const totalQty = state.cart.reduce((acc, it) => acc + it.qty, 0);
    const subtotal = state.cart.reduce((acc, it) => acc + it.unitPrice * it.qty, 0);
    const shipping = getShippingCost();
    const grandTotal = subtotal + (typeof shipping === 'number' ? shipping : 0);

    if (countBadge) countBadge.textContent = String(totalQty);
    if (mobileBar) mobileBar.hidden = totalQty === 0;
    if (mobileCount) mobileCount.textContent = `${totalQty} ${totalQty === 1 ? 'producto' : 'productos'}`;
    if (mobileTotal) mobileTotal.textContent = formatARS(grandTotal);

    if (container) {
      if (state.cart.length === 0) {
        container.innerHTML = `
          <div class="cart-empty">
            <p>Tu pedido está vacío.</p>
            <small>Elegí una burger o una promo oficial de la carta para empezar.</small>
          </div>
        `;
      } else {
        const itemsHtml = state.cart
          .map((entry) => {
            const sizeLabel = entry.isBurger ? (entry.size === 'triple' ? 'Triple' : 'Doble') : '';
            const cashTag = entry.isPromo ? '<span class="cart-item__cash">Solo efectivo</span>' : '';
            return `
              <div class="cart-item" data-uid="${escapeHtml(entry.uid)}">
                <div class="cart-item__row">
                  <div class="cart-item__info">
                    <strong>${escapeHtml(entry.name)} ${sizeLabel ? `<small>(${sizeLabel})</small>` : ''}</strong>
                    <div class="cart-item__meta">
                      <span>${formatARS(entry.unitPrice * entry.qty)}</span>
                      ${cashTag}
                    </div>
                  </div>
                  <div class="qty-control">
                    <button type="button" data-cart-action="dec" data-uid="${escapeHtml(entry.uid)}" aria-label="Quitar uno">−</button>
                    <span>${entry.qty}</span>
                    <button type="button" data-cart-action="inc" data-uid="${escapeHtml(entry.uid)}" aria-label="Sumar uno">+</button>
                  </div>
                </div>
                <div class="cart-item__inputs">
                  <input
                    type="text"
                    class="cart-item__person"
                    data-cart-field="person"
                    data-uid="${escapeHtml(entry.uid)}"
                    value="${escapeHtml(entry.person || '')}"
                    placeholder="👤 ¿Para quién es?"
                  />
                  <input
                    type="text"
                    class="cart-item__note"
                    data-cart-field="note"
                    data-uid="${escapeHtml(entry.uid)}"
                    value="${escapeHtml(entry.note || '')}"
                    placeholder="📝 Etiqueta / bolsa (sin modif. de ingredientes)"
                  />
                </div>
              </div>
            `;
          })
          .join('');

        // Sugerencias de acompañamiento
        const upsells = (SITE.upsellIds || [])
          .map((id) => state.items.find((i) => i.id === id && i.available !== false))
          .filter(Boolean);

        const upsellHtml =
          upsells.length > 0
            ? `
            <div class="upsell">
              <span class="upsell__title">🍟 Sumá papas o bebida</span>
              <div class="upsell__list">
                ${upsells
                  .map(
                    (u) => `
                  <button type="button" class="upsell__chip" data-action="add" data-id="${escapeHtml(u.id)}">
                    + ${escapeHtml(u.name)} (${formatARS(u.basePrice)})
                  </button>`
                  )
                  .join('')}
              </div>
            </div>`
            : '';

        container.innerHTML = itemsHtml + upsellHtml;
      }
    }

    // Mostrar/ocultar campos de Delivery
    const isDelivery = state.deliveryMode === 'delivery';
    const shippingRuleBox = $('#shippingRuleBox');
    const zoneWrap = $('#deliveryZoneWrap');
    const addressInput = $('#customerAddress');
    const shippingRow = $('#cartShippingRow');

    if (shippingRuleBox) shippingRuleBox.hidden = !isDelivery;
    if (zoneWrap) zoneWrap.hidden = !(isDelivery && state.zones.length > 0);
    if (addressInput) addressInput.hidden = !isDelivery;
    if (shippingRow) shippingRow.hidden = !isDelivery;

    $('#cartSubtotal').textContent = formatARS(subtotal);
    if (isDelivery) {
      $('#cartShipping').textContent = formatARS(shipping);
    }
    $('#cartTotal').textContent = formatARS(grandTotal);

    syncPaymentConstraints();
  }

  function openCart() {
    const drawer = $('#cartDrawer');
    const overlay = $('#cartOverlay');
    if (!drawer || !overlay) return;
    overlay.hidden = false;
    drawer.removeAttribute('inert');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    const drawer = $('#cartDrawer');
    const overlay = $('#cartOverlay');
    if (!drawer || !overlay) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  // ==========================================================================
  // 8. ARMADO DE COMANDA, WHATSAPP, TICKET TÉRMICO Y REGISTRO EN SHEETS
  // ==========================================================================
  function generateOrderCode() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `#BN-${num}`;
  }

  function getFormattedDateTime() {
    const now = new Date();
    const date = now.toLocaleDateString('es-AR', {
      timeZone: SITE.timeZone || 'America/Argentina/Buenos_Aires',
    });
    const time = now.toLocaleTimeString('es-AR', {
      timeZone: SITE.timeZone || 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
    });
    return { date, time: `${time} hs` };
  }

  function getPaymentSummaryText() {
    if (state.paymentMethod === 'Efectivo') {
      if (state.cashChangeType === 'cambio') {
        const amount = ($('#cashPayAmount')?.value || '').trim();
        return amount ? `Efectivo (Necesita cambio — abona con ${amount})` : 'Efectivo (Necesita cambio)';
      }
      return 'Efectivo (Abona Justo)';
    }
    return state.paymentMethod;
  }

  function validateCheckout() {
    if (state.cart.length === 0) {
      showToast('Agregá al menos un producto antes de enviar.');
      return false;
    }

    const name = ($('#customerName')?.value || '').trim();
    if (!name) {
      showToast('Por favor ingresá tu nombre.');
      $('#customerName')?.focus();
      return false;
    }

    if (state.deliveryMode === 'delivery') {
      const addr = ($('#customerAddress')?.value || '').trim();
      if (!addr) {
        showToast('Ingresá tu dirección de entrega.');
        $('#customerAddress')?.focus();
        return false;
      }
    }

    if (cartHasPromo() && state.paymentMethod !== 'Efectivo') {
      state.paymentMethod = 'Efectivo';
      syncPaymentConstraints();
      showToast('Las promos oficiales son válidas únicamente en efectivo.');
      return false;
    }

    if (state.paymentMethod === 'Efectivo' && state.cashChangeType === 'cambio') {
      const amount = ($('#cashPayAmount')?.value || '').trim();
      if (!amount) {
        showToast('Aclarás que necesitás cambio: indicá con cuánto abonás.');
        $('#cashPayAmount')?.focus();
        return false;
      }
    }

    return true;
  }

  function buildOrderPayload() {
    const code = generateOrderCode();
    const { date, time } = getFormattedDateTime();
    const customer = ($('#customerName')?.value || '').trim();
    const address = ($('#customerAddress')?.value || '').trim();
    const zoneName = getSelectedZoneName();
    const notes = ($('#orderNotes')?.value || '').trim();
    const paymentDetail = getPaymentSummaryText();

    const subtotal = state.cart.reduce((acc, it) => acc + it.unitPrice * it.qty, 0);
    const shipping = getShippingCost();
    const total = subtotal + (typeof shipping === 'number' ? shipping : 0);

    let burgersDoble = 0;
    let burgersTriple = 0;
    let totalUnidades = 0;

    state.cart.forEach((it) => {
      totalUnidades += it.qty;
      if (it.isBurger) {
        if (it.size === 'triple') burgersTriple += it.qty;
        else burgersDoble += it.qty;
      }
    });

    const lines = [];
    lines.push(`*🍔 NUEVO PEDIDO ${SITE.brand?.name || 'BUENARDA'} (${code})*`);
    lines.push(`📅 ${date} · ${time}`);
    lines.push(`👤 *Cliente:* ${customer}`);

    if (state.deliveryMode === 'delivery') {
      lines.push(`🛵 *Modalidad:* Delivery`);
      if (zoneName) lines.push(`🗺️ *Zona:* ${zoneName}`);
      lines.push(`📍 *Dirección:* ${address}`);
      lines.push(`📌 _Envío ubicación en el chat_`);
    } else {
      lines.push(`🏪 *Modalidad:* Retiro en Local (${SITE.brand?.streetOnly || 'Colón 696'})`);
    }

    lines.push(`💳 *Pago:* ${paymentDetail}`);
    lines.push('');
    lines.push('*📋 DETALLE DEL PEDIDO (Sin modificaciones):*');

    // Agrupar por persona si cargaron nombres
    const hasPersons = state.cart.some((it) => (it.person || '').trim().length > 0);
    if (hasPersons) {
      const groups = {};
      state.cart.forEach((it) => {
        const key = (it.person || '').trim() || 'General';
        if (!groups[key]) groups[key] = [];
        groups[key].push(it);
      });

      Object.entries(groups).forEach(([person, items]) => {
        const personTotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
        lines.push(`👤 *${person}* (${formatARS(personTotal)}):`);
        items.forEach((it) => {
          const sizeTxt = it.isBurger ? ` (${it.size === 'triple' ? 'Triple' : 'Doble'})` : '';
          const promoTxt = it.isPromo ? ' [PROMO EFECTIVO]' : '';
          const noteTxt = it.note ? ` — _${it.note}_` : '';
          lines.push(`  • ${it.qty}x ${it.name}${sizeTxt}${promoTxt} — ${formatARS(it.unitPrice * it.qty)}${noteTxt}`);
        });
      });
    } else {
      state.cart.forEach((it) => {
        const sizeTxt = it.isBurger ? ` (${it.size === 'triple' ? 'Triple' : 'Doble'})` : '';
        const promoTxt = it.isPromo ? ' [PROMO EFECTIVO]' : '';
        const noteTxt = it.note ? ` — _${it.note}_` : '';
        lines.push(`• ${it.qty}x ${it.name}${sizeTxt}${promoTxt} — ${formatARS(it.unitPrice * it.qty)}${noteTxt}`);
      });
    }

    if (notes) {
      lines.push('');
      lines.push(`📝 *Aclaración:* ${notes}`);
    }

    lines.push('');
    lines.push(`Subtotal: ${formatARS(subtotal)}`);
    if (state.deliveryMode === 'delivery') {
      lines.push(`Envío: ${formatARS(shipping)}`);
    }
    lines.push(`*TOTAL: ${formatARS(total)}*`);

    const whatsappText = lines.join('\n');
    const whatsappUrl = `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(whatsappText)}`;

    const productsSummary = state.cart
      .map((it) => `${it.qty}x ${it.name}${it.isBurger ? ` (${it.size})` : ''}`)
      .join(' | ');

    return {
      code,
      date,
      time,
      customer,
      modeLabel:
        state.deliveryMode === 'delivery'
          ? `Delivery · ${address}${zoneName ? ` (${zoneName})` : ''}`
          : `Retiro en Local (${SITE.brand?.streetOnly || 'Colón 696'})`,
      paymentDetail,
      subtotal,
      shipping,
      total,
      whatsappText,
      whatsappUrl,
      sheetRow: {
        codigo: code,
        fecha: date,
        hora: time,
        cliente: customer,
        modalidad: state.deliveryMode === 'delivery' ? 'Delivery' : 'Retiro',
        direccion: state.deliveryMode === 'delivery' ? `${address}${zoneName ? ` - ${zoneName}` : ''}` : 'Local',
        pago: paymentDetail,
        productos: productsSummary,
        burgersDoble,
        burgersTriple,
        totalUnidades,
        subtotal,
        envio: typeof shipping === 'number' ? shipping : 0,
        total,
        notas: notes,
      },
    };
  }

  function logSaleToSheets(sheetRow) {
    if (!SITE.appsScriptUrl) return;
    try {
      fetch(SITE.appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(sheetRow),
      });
    } catch {
      // Silencioso para no bloquear la apertura de WhatsApp
    }
  }

  function showTicketModal(order) {
    const overlay = $('#ticketOverlay');
    if (!overlay) return;

    $('#ticketBrand').textContent = SITE.brand?.name || 'BUENARDA';
    $('#ticketCode').textContent = order.code;
    $('#ticketDateTime').textContent = `${order.date} · ${order.time}`;
    $('#ticketCustomer').textContent = order.customer;
    $('#ticketMode').textContent = order.modeLabel;
    $('#ticketPayment').textContent = order.paymentDetail;

    $('#ticketItems').innerHTML = state.cart
      .map((it) => {
        const sizeTxt = it.isBurger ? (it.size === 'triple' ? 'Triple' : 'Doble') : '';
        const personTag = it.person ? `<span class="ticket-row__person">${escapeHtml(it.person)}</span>` : '';
        const subParts = [sizeTxt, it.isPromo ? 'Solo Efectivo' : '', it.note].filter(Boolean).join(' · ');
        return `
          <div class="ticket-row">
            <div class="ticket-row__main">
              ${personTag}<strong>${it.qty}x ${escapeHtml(it.name)}</strong>
              ${subParts ? `<span class="ticket-row__sub">${escapeHtml(subParts)}</span>` : ''}
            </div>
            <span class="ticket-row__price">${formatARS(it.unitPrice * it.qty)}</span>
          </div>
        `;
      })
      .join('');

    $('#ticketSubtotal').textContent = formatARS(order.subtotal);
    const shipRow = $('#ticketShippingRow');
    if (shipRow) {
      shipRow.hidden = state.deliveryMode !== 'delivery';
      $('#ticketShipping').textContent = formatARS(order.shipping);
    }
    $('#ticketTotal').textContent = formatARS(order.total);

    const waLink = $('#ticketWhatsappLink');
    if (waLink) waLink.href = order.whatsappUrl;

    closeCart();
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeTicketModal() {
    const overlay = $('#ticketOverlay');
    if (!overlay) return;
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  // ==========================================================================
  // 9. SINCRONIZACIÓN OPCIONAL CON GOOGLE SHEETS (CSV)
  // ==========================================================================
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && next === '\n') i++;
        row.push(current.trim());
        if (row.some((cell) => cell !== '')) rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.length > 0 || row.length > 0) {
      row.push(current.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
    }
    return rows;
  }

  async function syncFromGoogleSheets() {
    try {
      if (SITE.sheet?.configCsvUrl && SITE.sheet.configCsvUrl.includes('output=csv')) {
        const res = await fetch(SITE.sheet.configCsvUrl);
        if (res.ok) {
          const rows = parseCsv(await res.text());
          rows.slice(1).forEach(([k, v]) => {
            if (!k) return;
            const key = k.toLowerCase().trim();
            const val = (v || '').trim();
            if (key === 'precio_triple' && !Number.isNaN(Number(val))) SITE.tripleExtraPrice = Number(val);
            if (key === 'whatsapp' && val) SITE.whatsappNumber = val.replace(/\D/g, '');
            if (key === 'alias_pago' && val) SITE.payment.alias = val;
            if (key === 'titular_pago' && val) SITE.payment.holder = val;
            if (key === 'usar_fotos') SITE.usePhotos = ['si', 'sí', 'true', '1'].includes(val.toLowerCase());
            if (key === 'promo_activa') SITE.promo.active = ['si', 'sí', 'true', '1'].includes(val.toLowerCase());
            if (key === 'promo_titulo' && val) SITE.promo.title = val;
            if (key === 'promo_subtitulo' && val) SITE.promo.subtitle = val;
            if (key === 'promo_precio' && !Number.isNaN(Number(val))) SITE.promo.price = Number(val);
            if (key === 'promo_precio_anterior' && !Number.isNaN(Number(val))) SITE.promo.oldPrice = Number(val);
          });
          applyBrandBindings();
          renderNightPromo();
        }
      }

      if (SITE.sheet?.menuCsvUrl && SITE.sheet.menuCsvUrl.includes('output=csv')) {
        const res = await fetch(SITE.sheet.menuCsvUrl);
        if (res.ok) {
          const rows = parseCsv(await res.text());
          const headers = (rows[0] || []).map((h) => h.toLowerCase().trim());
          const idxId = headers.indexOf('id');
          const idxPrecio = headers.indexOf('precio');
          const idxDisp = headers.indexOf('disponible');
          const idxNombre = headers.indexOf('nombre');
          const idxIng = headers.indexOf('ingredientes');

          if (idxId >= 0) {
            rows.slice(1).forEach((cols) => {
              const id = (cols[idxId] || '').trim();
              const target = state.items.find((it) => it.id === id);
              if (!target) return;
              if (idxNombre >= 0 && cols[idxNombre]) target.name = cols[idxNombre].trim();
              if (idxPrecio >= 0 && cols[idxPrecio] && !Number.isNaN(Number(cols[idxPrecio]))) {
                target.basePrice = Number(cols[idxPrecio]);
              }
              if (idxIng >= 0 && cols[idxIng]) target.ingredients = cols[idxIng].trim();
              if (idxDisp >= 0 && cols[idxDisp]) {
                const d = cols[idxDisp].toLowerCase().trim();
                target.available = !['no', 'agotado', 'false', '0'].includes(d);
              }
            });
          }
        }
      }
    } catch {
      // Si falla la red, usa los valores locales de menu-data.js
    } finally {
      renderHeroShowcase();
      renderMenu();
      renderCart();
    }
  }

  // ==========================================================================
  // 10. EVENTOS E INTERACCIONES
  // ==========================================================================
  // Menú móvil
  $('#mobileMenuBtn')?.addEventListener('click', () => {
    const nav = $('#navLinks');
    const btn = $('#mobileMenuBtn');
    const open = nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
  });

  $$('#navLinks a').forEach((link) => {
    link.addEventListener('click', () => {
      $('#navLinks')?.classList.remove('is-open');
      $('#mobileMenuBtn')?.setAttribute('aria-expanded', 'false');
    });
  });

  // Hero showcase controls
  $('#prevHeroBurger')?.addEventListener('click', () => {
    state.heroIndex -= 1;
    renderHeroShowcase();
  });

  $('#nextHeroBurger')?.addEventListener('click', () => {
    state.heroIndex += 1;
    renderHeroShowcase();
  });

  $('#heroDots')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-hero-idx]');
    if (!btn) return;
    state.heroIndex = Number(btn.dataset.heroIdx) || 0;
    renderHeroShowcase();
  });

  $('#addHeroBurgerBtn')?.addEventListener('click', () => {
    const current = getHeroBurgers()[state.heroIndex];
    if (current) addToCart(current.id, 'doble');
  });

  // Botón promo destacada
  $('#promoActionBtn')?.addEventListener('click', () => {
    if (SITE.promo?.id) {
      addToCart(SITE.promo.id);
      openCart();
    }
  });

  // Filtros y búsqueda de carta
  $('#filterTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    $$('.filter-tab').forEach((t) => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    state.activeCategory = tab.dataset.filter || 'all';
    renderMenu();
  });

  $('#menuSearchInput')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value || '';
    renderMenu();
  });

  // Clicks en tarjetas de carta (Doble/Triple + Agregar)
  $('#menuGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'size') {
      state.selectedSizes[id] = btn.dataset.size;
      renderMenu();
      const card = $(`.burger-card[data-card-id="${id}"]`);
      if (card) {
        card.classList.remove('is-smashing');
        void card.offsetWidth;
        card.classList.add('is-smashing');
      }
    } else if (action === 'add') {
      addToCart(id);
    }
  });

  // Abrir / cerrar carrito
  $('#openCartBtn')?.addEventListener('click', openCart);
  $('#mobileCartBar')?.addEventListener('click', openCart);
  $('#closeCartBtn')?.addEventListener('click', closeCart);
  $('#cartOverlay')?.addEventListener('click', closeCart);

  // Interacciones dentro del carrito
  $('#cartItemsContainer')?.addEventListener('click', (e) => {
    const qtyBtn = e.target.closest('[data-cart-action]');
    if (qtyBtn) {
      const uid = qtyBtn.dataset.uid;
      const idx = state.cart.findIndex((it) => it.uid === uid);
      if (idx >= 0) {
        if (qtyBtn.dataset.cartAction === 'inc') state.cart[idx].qty += 1;
        else {
          state.cart[idx].qty -= 1;
          if (state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
        }
        saveCartToStorage();
        renderCart();
      }
      return;
    }

    const upsellBtn = e.target.closest('[data-action="add"]');
    if (upsellBtn) {
      addToCart(upsellBtn.dataset.id);
    }
  });

  $('#cartItemsContainer')?.addEventListener('input', (e) => {
    const input = e.target.closest('[data-cart-field]');
    if (!input) return;
    const entry = state.cart.find((it) => it.uid === input.dataset.uid);
    if (!entry) return;
    entry[input.dataset.cartField] = input.value;
    saveCartToStorage();
  });

  // Toggle Retiro / Delivery
  $$('.delivery-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.delivery-btn').forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      state.deliveryMode = btn.dataset.delivery || 'retiro';
      renderCart();
    });
  });

  $('#deliveryZoneSelect')?.addEventListener('change', (e) => {
    state.selectedZoneId = e.target.value;
    renderCart();
  });

  $('#paymentMethod')?.addEventListener('change', (e) => {
    state.paymentMethod = e.target.value;
    syncPaymentConstraints();
  });

  $('#cashChangeType')?.addEventListener('change', (e) => {
    state.cashChangeType = e.target.value;
    syncPaymentConstraints();
  });

  // Copiar Alias en 1 toque
  $('#copyAliasBtn')?.addEventListener('click', async () => {
    const alias = SITE.payment?.alias || 'buenarda.parana.mp';
    try {
      await navigator.clipboard.writeText(alias);
      const btn = $('#copyAliasBtn');
      btn.classList.add('is-copied');
      btn.textContent = '✓ Alias copiado';
      showToast(`Alias "${alias}" copiado al portapapeles`);
      setTimeout(() => {
        btn.classList.remove('is-copied');
        btn.textContent = '📋 Copiar Alias';
      }, 2200);
    } catch {
      showToast(`Alias: ${alias}`);
    }
  });

  // Enviar pedido por WhatsApp + Ticket térmico + Sheets
  $('#sendWhatsappBtn')?.addEventListener('click', () => {
    if (!validateCheckout()) return;
    const order = buildOrderPayload();
    logSaleToSheets(order.sheetRow);
    showTicketModal(order);
    window.open(order.whatsappUrl, '_blank', 'noopener,noreferrer');
  });

  $('#copyOrderBtn')?.addEventListener('click', async () => {
    if (!validateCheckout()) return;
    const order = buildOrderPayload();
    try {
      await navigator.clipboard.writeText(order.whatsappText);
      showToast('Detalle del pedido copiado al portapapeles');
    } catch {
      showToast('No se pudo copiar automáticamente');
    }
  });

  $('#closeTicketBtn')?.addEventListener('click', closeTicketModal);

  // Reproductor de video del local
  const video = $('#tourVideo');
  const player = $('#tourPlayer');
  if (video && player) {
    const togglePlay = () => {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    $('#tourPlayBtn')?.addEventListener('click', togglePlay);
    $('#tourToggleBtn')?.addEventListener('click', togglePlay);

    video.addEventListener('play', () => player.classList.add('is-playing'));
    video.addEventListener('pause', () => player.classList.remove('is-playing'));
    video.addEventListener('timeupdate', () => {
      const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
      const fill = $('#tourProgressFill');
      if (fill) fill.style.width = `${pct}%`;
    });
    video.addEventListener('error', () => {
      const err = $('#tourError');
      if (err) err.hidden = false;
    });

    $('#tourSoundBtn')?.addEventListener('click', () => {
      video.muted = !video.muted;
      player.classList.toggle('is-unmuted', !video.muted);
      const label = $('#tourSoundLabel');
      if (label) label.textContent = video.muted ? 'Activar sonido' : 'Silenciar';
    });
  }

  // ==========================================================================
  // 11. INICIALIZACIÓN
  // ==========================================================================
  applyBrandBindings();
  updateOpenStatus();
  setInterval(updateOpenStatus, 60000);
  renderNightPromo();
  renderDeliveryZones();
  renderHeroShowcase();
  renderMenu();
  renderCart();
  syncFromGoogleSheets();
});