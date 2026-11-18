'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Garantizar que ninguna sección quede invisible aunque ocurra un error externo
  const forceRevealAll = () => {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
  };

  try {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08 }
      );
      document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
      setTimeout(forceRevealAll, 900);
    } else {
      forceRevealAll();
    }
  } catch (err) {
    forceRevealAll();
  }

  // 2. Configuración segura con respaldos (funciona con cualquier versión de menu-data.js)
  const rawSite = typeof SITE !== 'undefined' && SITE ? SITE : {};
  const config = {
    brand: Object.assign(
      {
        name: 'BUENARDA',
        handle: '@buenardaparana',
        tagline: 'Hamburguesas de alta calidad | 100% Carne',
        city: 'Paraná · Entre Ríos',
        streetOnly: 'Colón 696',
        shortAddress: 'Colón 696 — Paraná',
        fullAddress: 'Colón 696, E3100 Paraná, Entre Ríos',
        instagramUrl: 'https://www.instagram.com/buenardaparana/',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Colon+696+Parana+Entre+Rios',
        primaryColor: '#F5B700',
      },
      rawSite.brand || {}
    ),
    sheet: Object.assign(
      {
        menuCsvUrl: '',
        configCsvUrl: '',
        shippingCsvUrl: '',
      },
      rawSite.sheet || {}
    ),
    appsScriptUrl: rawSite.appsScriptUrl || '',
    whatsappNumber: String(rawSite.whatsappNumber || '5493434717233').replace(/\D/g, ''),
    tripleExtraPrice: Number(rawSite.tripleExtraPrice) || 2400,
    timeZone: rawSite.timeZone || 'America/Argentina/Buenos_Aires',
    hours: Object.assign(
      {
        openDays: [3, 4, 5, 6, 0],
        open: 20,
        close: 24,
        label: 'Mié a Dom 20:00 a 00:00 hs',
        fullLabel: 'Miércoles a Domingo · 20:00 a 00:00 hs',
      },
      rawSite.hours || {}
    ),
    delivery: Object.assign({ fee: null }, rawSite.delivery || {}),
    payment: Object.assign(
      {
        alias: 'buenarda.parana.mp',
        holder: 'Buenarda Paraná',
      },
      rawSite.payment || {}
    ),
    promo: Object.assign(
      {
        active: false,
        id: 'promo-noche',
        badge: '🔥 PROMO DE LA NOCHE',
        title: 'COMBO BUENARDA NIGHT',
        subtitle: '',
        price: 0,
        oldPrice: 0,
        icon: '🔥',
      },
      rawSite.promo || {}
    ),
    instagramFollowers: Object.assign(
      { short: '+17.5K', long: '17,5 mil' },
      rawSite.instagramFollowers || {}
    ),
    usePhotos: Boolean(rawSite.usePhotos),
    photoExtension: rawSite.photoExtension || 'jpg',
    upsellIds: Array.isArray(rawSite.upsellIds)
      ? rawSite.upsellIds
      : ['papas-clasicas', 'papas-cheddar-bacon', 'gaseosa-lata'],
  };

  let menuItems =
    typeof MENU_ITEMS !== 'undefined' && Array.isArray(MENU_ITEMS)
      ? MENU_ITEMS.map((item) => Object.assign({ available: true }, item))
      : [];

  let deliveryZones =
    typeof DELIVERY_ZONES !== 'undefined' && Array.isArray(DELIVERY_ZONES)
      ? DELIVERY_ZONES.slice()
      : [];

  const reviewsListData =
    typeof REVIEWS !== 'undefined' && Array.isArray(REVIEWS) ? REVIEWS : [];

  const state = {
    filter: 'all',
    query: '',
    heroIndex: 0,
    cardSizes: {},
    cart: [],
    deliveryMode: 'retiro',
    selectedZoneId: deliveryZones[0] ? deliveryZones[0].id : '',
    lastOrderUrl: '',
  };

  // Cargar carrito guardado si existe
  try {
    const savedCart = JSON.parse(localStorage.getItem('buenarda_cart_v1') || '[]');
    if (Array.isArray(savedCart)) {
      state.cart = savedCart;
    }
  } catch (e) {
    state.cart = [];
  }

  const saveCart = () => {
    try {
      localStorage.setItem('buenarda_cart_v1', JSON.stringify(state.cart));
    } catch (e) {
      // Ignorar si el navegador bloquea storage
    }
  };

  // Utilidades seguras
  const $ = (id) => document.getElementById(id);

  const escapeHTML = (str) =>
    String(str == null ? '' : str)
      .replace(/&/g, '\u0026amp;')
      .replace(/</g, '\u0026lt;')
      .replace(/>/g, '\u0026gt;')
      .replace(/"/g, '\u0026quot;')
      .replace(/'/g, '\u0026#39;');

  const formatARS = (amount) => {
    const n = Math.round(Number(amount) || 0);
    return '$' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const isYes = (val) => {
    const clean = String(val == null ? '' : val)
      .trim()
      .toLowerCase();
    return clean === 'si' || clean === 'sí' || clean === 'true' || clean === '1' || clean === 'activo';
  };

  const isNo = (val) => {
    const clean = String(val == null ? '' : val)
      .trim()
      .toLowerCase();
    return clean === 'no' || clean === 'false' || clean === '0' || clean === 'agotado';
  };

  let toastTimer = null;
  const showToast = (msg) => {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  };

  const copyText = async (text, okMsg) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg || 'Copiado al portapapeles');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(okMsg || 'Copiado al portapapeles');
    }
  };

  // Aplicar datos de marca y textos dinámicos
  const applyBrandBindings = () => {
    if (config.brand.primaryColor) {
      document.documentElement.style.setProperty('--accent', config.brand.primaryColor);
    }

    document.querySelectorAll('[data-bind="brandName"]').forEach((el) => {
      el.textContent = config.brand.name;
    });
    document.querySelectorAll('[data-bind="brandHandle"]').forEach((el) => {
      el.textContent = config.brand.handle;
    });
    document.querySelectorAll('[data-bind="brandAddress"]').forEach((el) => {
      el.textContent = config.brand.fullAddress || config.brand.shortAddress;
    });
    document.querySelectorAll('[data-bind="igShort"]').forEach((el) => {
      el.textContent = config.instagramFollowers.short;
    });
    document.querySelectorAll('[data-bind="igLong"]').forEach((el) => {
      el.textContent = config.instagramFollowers.long;
    });
    document.querySelectorAll('[data-bind="igLink"]').forEach((el) => {
      if (config.brand.instagramUrl) el.setAttribute('href', config.brand.instagramUrl);
    });
    document.querySelectorAll('[data-bind="mapsLink"]').forEach((el) => {
      if (config.brand.mapsUrl) el.setAttribute('href', config.brand.mapsUrl);
    });

    const hoursSummary = $('hoursSummaryText');
    if (hoursSummary && config.hours.fullLabel) {
      hoursSummary.textContent = config.hours.fullLabel;
    }

    const aliasEl = $('transferAliasText');
    const holderEl = $('transferHolderText');
    const ticketAliasEl = $('ticketAliasText');
    if (aliasEl) aliasEl.textContent = config.payment.alias;
    if (ticketAliasEl) ticketAliasEl.textContent = config.payment.alias;
    if (holderEl) {
      holderEl.textContent = config.payment.holder ? 'Titular: ' + config.payment.holder : '';
    }
  };

  // Estado Abierto / Cerrado según horario local
  const getLocalClock = () => {
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: config.timeZone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now);

      const map = {};
      parts.forEach((p) => {
        map[p.type] = p.value;
      });
      const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return {
        day: dayMap[map.weekday] != null ? dayMap[map.weekday] : now.getDay(),
        hour: Number(map.hour) % 24,
        minute: Number(map.minute) || 0,
      };
    } catch (e) {
      const now = new Date();
      return { day: now.getDay(), hour: now.getHours(), minute: now.getMinutes() };
    }
  };

  const isStoreOpen = () => {
    const { day, hour } = getLocalClock();
    const openDays = Array.isArray(config.hours.openDays) ? config.hours.openDays : [3, 4, 5, 6, 0];
    const openH = Number(config.hours.open) || 20;
    const closeH = Number(config.hours.close) || 24;
    if (!openDays.includes(day)) return false;
    if (closeH > openH) {
      return hour >= openH && hour < closeH;
    }
    return hour >= openH || hour < closeH;
  };

  const updateOpenStatus = () => {
    const open = isStoreOpen();
    const dot = $('openStatusDot');
    const text = $('openStatusText');
    const notice = $('cartOpenNotice');

    if (dot) {
      dot.classList.toggle('is-open', open);
      dot.classList.toggle('is-closed', !open);
    }
    if (text) {
      text.textContent = open
        ? 'ABIERTO AHORA · TOMANDO PEDIDOS'
        : 'CERRADO AHORA · ' + (config.hours.label || 'Mié a Dom 20:00 a 00:00 hs');
    }
    if (notice) {
      if (open) {
        notice.hidden = true;
      } else {
        notice.hidden = false;
        notice.textContent =
          'Ahora estamos cerrados (' +
          (config.hours.label || 'Mié a Dom 20:00 a 00:00 hs') +
          '). Podés dejar tu pedido programado por WhatsApp.';
      }
    }
  };

  // Ilustración vectorial de cada burger (y soporte para fotos reales)
  const buildBurgerSVG = (item, size) => {
    const layers = item.layers || {};
    const isTriple = size === 'triple';
    const cheeseColor =
      layers.cheese === 'provolone'
        ? '#f5edd6'
        : layers.cheese === 'smoked-cheddar'
        ? '#e88b25'
        : '#f5b700';

    const sauceColor =
      layers.sauce === 'bbq'
        ? '#5c1d12'
        : layers.sauce === 'alioli'
        ? '#f3ebd3'
        : layers.sauce === 'royale'
        ? '#c93829'
        : layers.sauce === 'buenarda'
        ? '#e07a22'
        : '#e89b6b';

    return (
      '<svg class="burger-svg" viewBox="0 0 260 190" role="img" aria-label="' +
      escapeHTML(item.name) +
      '">' +
      '<ellipse cx="130" cy="174" rx="84" ry="10" fill="rgba(0,0,0,0.45)"/>' +
      // Pan inferior
      '<path d="M56 144 Q56 164 130 164 Q204 164 204 144 Z" fill="#c97a2b"/>' +
      '<rect x="54" y="138" width="152" height="10" rx="5" fill="#dea04c"/>' +
      // Lechuga / tomate si lleva
      (layers.lettuce
        ? '<path d="M48 136 Q68 128 88 136 T128 136 T168 136 T212 136 L208 142 L52 142 Z" fill="#4aa848"/>'
        : '') +
      (layers.tomato
        ? '<rect x="64" y="130" width="132" height="7" rx="3.5" fill="#d93b2b"/>'
        : '') +
      // Medallón 1 + queso
      '<rect x="52" y="118" width="156" height="16" rx="8" fill="#4a2514"/>' +
      '<path d="M56 118 L204 118 L194 130 L176 121 L156 132 L130 121 L104 131 L82 121 L64 129 Z" fill="' +
      cheeseColor +
      '"/>' +
      // Medallón 2 + queso
      '<rect x="54" y="99" width="152" height="16" rx="8" fill="#572c18"/>' +
      '<path d="M58 99 L202 99 L190 112 L168 102 L144 113 L122 102 L96 112 L74 102 Z" fill="' +
      cheeseColor +
      '"/>' +
      // Medallón 3 extra si es Triple
      (isTriple
        ? '<g class="smash-extra-layer">' +
          '<rect x="55" y="80" width="150" height="16" rx="8" fill="#4f2715"/>' +
          '<path d="M59 80 L201 80 L188 92 L164 83 L138 93 L112 83 L86 92 Z" fill="' +
          cheeseColor +
          '"/>' +
          '</g>'
        : '') +
      // Toppings (bacon, huevo, pepinillos, cebollas)
      (layers.bacon
        ? '<path d="M62 ' +
          (isTriple ? 74 : 93) +
          ' Q95 ' +
          (isTriple ? 68 : 87) +
          ' 130 ' +
          (isTriple ? 74 : 93) +
          ' T198 ' +
          (isTriple ? 74 : 93) +
          '" stroke="#9e2a22" stroke-width="7" stroke-linecap="round" fill="none"/>'
        : '') +
      (layers.egg
        ? '<ellipse cx="130" cy="' +
          (isTriple ? 71 : 90) +
          '" rx="44" ry="7" fill="#fffdf7"/>' +
          '<ellipse cx="130" cy="' +
          (isTriple ? 69 : 88) +
          '" rx="15" ry="6" fill="#f7a81b"/>'
        : '') +
      (layers.pickles
        ? '<ellipse cx="92" cy="' +
          (isTriple ? 73 : 92) +
          '" rx="16" ry="4" fill="#5b8c2a"/>' +
          '<ellipse cx="166" cy="' +
          (isTriple ? 73 : 92) +
          '" rx="16" ry="4" fill="#5b8c2a"/>'
        : '') +
      // Salsa superior
      '<path d="M68 ' +
      (isTriple ? 67 : 86) +
      ' Q130 ' +
      (isTriple ? 60 : 79) +
      ' 192 ' +
      (isTriple ? 67 : 86) +
      '" stroke="' +
      sauceColor +
      '" stroke-width="6" stroke-linecap="round" fill="none"/>' +
      // Pan superior brioche
      '<path d="M56 ' +
      (isTriple ? 65 : 84) +
      ' C56 ' +
      (isTriple ? 22 : 40) +
      ', 204 ' +
      (isTriple ? 22 : 40) +
      ', 204 ' +
      (isTriple ? 65 : 84) +
      ' Z" fill="#d98732"/>' +
      '<path d="M72 ' +
      (isTriple ? 50 : 68) +
      ' C86 ' +
      (isTriple ? 32 : 50) +
      ', 174 ' +
      (isTriple ? 32 : 50) +
      ', 188 ' +
      (isTriple ? 50 : 68) +
      '" stroke="rgba(255,235,190,0.45)" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      // Semillas de sésamo
      '<ellipse cx="105" cy="' +
      (isTriple ? 41 : 59) +
      '" rx="4" ry="2" fill="#f7e3b5"/>' +
      '<ellipse cx="132" cy="' +
      (isTriple ? 37 : 55) +
      '" rx="4" ry="2" fill="#f7e3b5"/>' +
      '<ellipse cx="158" cy="' +
      (isTriple ? 42 : 60) +
      '" rx="4" ry="2" fill="#f7e3b5"/>' +
      '</svg>'
    );
  };

  const renderVisualHTML = (item, size) => {
    if (!item.isBurger) {
      return '<div class="item-emoji-visual" aria-hidden="true">' + escapeHTML(item.icon || '🍟') + '</div>';
    }
    if (config.usePhotos) {
      const ext = config.photoExtension || 'jpg';
      const mainSrc = 'assets/burgers/' + encodeURIComponent(item.id) + '.' + ext;
      const cutSrc = 'assets/burgers/' + encodeURIComponent(item.id) + '-corte.' + ext;
      return (
        '<div class="photo-visual">' +
        '<img class="photo-main" src="' +
        mainSrc +
        '" alt="' +
        escapeHTML(item.name) +
        '" loading="lazy" onerror="this.parentElement.innerHTML=this.dataset.fallback" data-fallback="' +
        escapeHTML(buildBurgerSVG(item, size)) +
        '"/>' +
        '<img class="photo-cut" src="' +
        cutSrc +
        '" alt="" aria-hidden="true" loading="lazy" onerror="this.remove()"/>' +
        '</div>'
      );
    }
    return buildBurgerSVG(item, size);
  };

  // Promo de la noche
  const renderPromoBanner = () => {
    const banner = $('promoBanner');
    if (!banner) return;
    if (!config.promo || !config.promo.active || !config.promo.title) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    if ($('promoBadge')) $('promoBadge').textContent = config.promo.badge || '🔥 PROMO DE LA NOCHE';
    if ($('promoTitle')) $('promoTitle').textContent = config.promo.title;
    if ($('promoText')) $('promoText').textContent = config.promo.subtitle || '';
    if ($('promoPrice')) {
      const priceStr = Number(config.promo.price) > 0 ? formatARS(config.promo.price) : '';
      const oldStr =
        Number(config.promo.oldPrice) > 0
          ? ' <del style="opacity:.6;font-size:.85em">' + formatARS(config.promo.oldPrice) + '</del>'
          : '';
      $('promoPrice').innerHTML = priceStr + oldStr;
    }
  };

  // Vitrina Hero
  const getHeroBurgers = () => {
    const burgers = menuItems.filter((i) => i.isBurger && i.available !== false);
    return burgers.length ? burgers : menuItems.filter((i) => i.isBurger);
  };

  const renderHeroShowcase = () => {
    const burgers = getHeroBurgers();
    if (!burgers.length) return;
    if (state.heroIndex >= burgers.length) state.heroIndex = 0;
    if (state.heroIndex < 0) state.heroIndex = burgers.length - 1;

    const current = burgers[state.heroIndex];
    if ($('heroBurgerName')) $('heroBurgerName').textContent = current.name;
    if ($('heroBurgerPrice')) $('heroBurgerPrice').textContent = formatARS(current.basePrice);
    if ($('heroBurgerDesc')) $('heroBurgerDesc').textContent = current.ingredients || '';
    if ($('heroBurgerVisual')) $('heroBurgerVisual').innerHTML = renderVisualHTML(current, 'doble');

    const dots = $('heroDots');
    if (dots) {
      dots.innerHTML = burgers
        .map(
          (b, idx) =>
            '<button type="button" class="story-dot' +
            (idx === state.heroIndex ? ' is-active' : '') +
            '" data-hero-idx="' +
            idx +
            '" aria-label="Ver ' +
            escapeHTML(b.name) +
            '"></button>'
        )
        .join('');
    }
  };

  // Grilla de Carta
  const getItemUnitPrice = (item, size) => {
    const base = Number(item.basePrice) || 0;
    if (item.isBurger && size === 'triple') {
      return base + config.tripleExtraPrice;
    }
    return base;
  };

  const renderMenu = () => {
    const grid = $('menuGrid');
    if (!grid) return;

    const q = state.query.trim().toLowerCase();
    const filtered = menuItems.filter((item) => {
      const catOk = state.filter === 'all' || item.category === state.filter;
      if (!catOk) return false;
      if (!q) return true;
      const haystack = (
        (item.name || '') +
        ' ' +
        (item.ingredients || '') +
        ' ' +
        (item.badge || '')
      ).toLowerCase();
      return haystack.includes(q);
    });

    if (!filtered.length) {
      grid.innerHTML =
        '<div class="menu-empty"><p>No encontramos productos con ese filtro.</p></div>';
      return;
    }

    grid.innerHTML = filtered
      .map((item) => {
        const isSoldOut = item.available === false;
        const size = item.isBurger ? state.cardSizes[item.id] || 'doble' : 'unico';
        const price = getItemUnitPrice(item, size);

        const sizeSelector = item.isBurger
          ? '<div class="size-toggle" role="group" aria-label="Tamaño de medallones">' +
            '<button type="button" class="size-btn' +
            (size === 'doble' ? ' is-active' : '') +
            '" data-size-id="' +
            escapeHTML(item.id) +
            '" data-size="doble"' +
            (isSoldOut ? ' disabled' : '') +
            '>Doble (x2)</button>' +
            '<button type="button" class="size-btn' +
            (size === 'triple' ? ' is-active' : '') +
            '" data-size-id="' +
            escapeHTML(item.id) +
            '" data-size="triple"' +
            (isSoldOut ? ' disabled' : '') +
            '>Triple (+' +
            formatARS(config.tripleExtraPrice) +
            ')</button>' +
            '</div>'
          : '';

        return (
          '<article class="burger-card' +
          (isSoldOut ? ' is-sold-out' : '') +
          '" data-card-id="' +
          escapeHTML(item.id) +
          '">' +
          '<div class="burger-card__top">' +
          '<span class="burger-card__badge">' +
          escapeHTML(item.badge || (item.isBurger ? 'Smash' : 'Extra')) +
          '</span>' +
          (isSoldOut
            ? '<span class="burger-card__badge burger-card__badge--soldout">Agotado por hoy</span>'
            : '') +
          '</div>' +
          '<div class="burger-card__visual">' +
          renderVisualHTML(item, size) +
          '</div>' +
          '<div class="burger-card__body">' +
          '<h3 class="burger-card__title">' +
          escapeHTML(item.name) +
          '</h3>' +
          '<p class="burger-card__desc">' +
          escapeHTML(item.ingredients || '') +
          '</p>' +
          sizeSelector +
          '<div class="burger-card__footer">' +
          '<strong class="burger-card__price">' +
          formatARS(price) +
          '</strong>' +
          '<button type="button" class="btn-add" data-add-id="' +
          escapeHTML(item.id) +
          '"' +
          (isSoldOut ? ' disabled' : '') +
          '>' +
          (isSoldOut ? 'Sin Stock' : '+ Agregar') +
          '</button>' +
          '</div>' +
          '</div>' +
          '</article>'
        );
      })
      .join('');
  };

  // Carrito y Checkout
  const addToCart = (itemId, forcedSize) => {
    const item = menuItems.find((i) => i.id === itemId);
    if (!item) return;
    if (item.available === false) {
      showToast('Este producto está agotado por hoy.');
      return;
    }

    const size = item.isBurger ? forcedSize || state.cardSizes[item.id] || 'doble' : 'unico';
    const unitPrice = getItemUnitPrice(item, size);

    const existing = state.cart.find(
      (c) => c.id === item.id && c.size === size && !c.person && !c.note
    );

    if (existing) {
      existing.qty += 1;
    } else {
      state.cart.push({
        uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        id: item.id,
        name: item.name,
        isBurger: Boolean(item.isBurger),
        size,
        unitPrice,
        qty: 1,
        person: '',
        note: '',
      });
    }

    saveCart();
    renderCart();
    showToast('Agregado: ' + item.name + (item.isBurger ? ' (' + size.toUpperCase() + ')' : ''));
  };

  const addPromoToCart = () => {
    if (!config.promo || !config.promo.active) return;
    const promoId = config.promo.id || 'promo-noche';
    const existing = state.cart.find((c) => c.id === promoId);
    if (existing) {
      existing.qty += 1;
    } else {
      state.cart.push({
        uid: 'promo-' + Date.now().toString(36),
        id: promoId,
        name: config.promo.title,
        isBurger: false,
        size: 'promo',
        unitPrice: Number(config.promo.price) || 0,
        qty: 1,
        person: '',
        note: config.promo.subtitle || '',
      });
    }
    saveCart();
    renderCart();
    openCart();
  };

  const getShippingCost = () => {
    if (state.deliveryMode !== 'delivery') return 0;
    if (deliveryZones.length > 0) {
      const z = deliveryZones.find((zone) => zone.id === state.selectedZoneId) || deliveryZones[0];
      if (!z) return null;
      return z.fee == null || z.fee === '' ? null : Number(z.fee);
    }
    return config.delivery.fee == null ? null : Number(config.delivery.fee);
  };

  const renderDeliveryZones = () => {
    const select = $('deliveryZone');
    if (!select) return;
    if (!deliveryZones.length) {
      select.innerHTML = '<option value="">Envío a confirmar por WhatsApp</option>';
      return;
    }
    if (!deliveryZones.some((z) => z.id === state.selectedZoneId)) {
      state.selectedZoneId = deliveryZones[0].id;
    }
    select.innerHTML = deliveryZones
      .map((z) => {
        const feeText = z.fee == null ? 'A confirmar' : formatARS(z.fee);
        return (
          '<option value="' +
          escapeHTML(z.id) +
          '"' +
          (z.id === state.selectedZoneId ? ' selected' : '') +
          '>' +
          escapeHTML(z.name) +
          ' (' +
          feeText +
          ')</option>'
        );
      })
      .join('');
  };

  const renderCart = () => {
    const container = $('cartItemsContainer');
    const totalUnits = state.cart.reduce((acc, c) => acc + c.qty, 0);
    const subtotal = state.cart.reduce((acc, c) => acc + c.unitPrice * c.qty, 0);

    if ($('cartCountBadge')) $('cartCountBadge').textContent = String(totalUnits);

    const mobileBar = $('mobileCartBar');
    if (mobileBar) {
      mobileBar.hidden = totalUnits === 0;
      if ($('mobileCartCount')) {
        $('mobileCartCount').textContent =
          totalUnits + (totalUnits === 1 ? ' producto' : ' productos');
      }
      if ($('mobileCartTotal')) $('mobileCartTotal').textContent = formatARS(subtotal);
    }

    if (container) {
      if (!state.cart.length) {
        container.innerHTML =
          '<div class="cart-empty">' +
          '<p>Tu pedido está vacío.</p>' +
          '<small>Elegí tus burgers en la carta para armar la comanda.</small>' +
          '</div>';
      } else {
        const itemsHtml = state.cart
          .map((c) => {
            const sizeLabel =
              c.size === 'triple' ? ' · TRIPLE' : c.size === 'doble' ? ' · DOBLE' : '';
            return (
              '<div class="cart-item" data-uid="' +
              escapeHTML(c.uid) +
              '">' +
              '<div class="cart-item__head">' +
              '<div>' +
              '<strong>' +
              escapeHTML(c.name) +
              sizeLabel +
              '</strong>' +
              '<div class="cart-item__unit">' +
              formatARS(c.unitPrice) +
              ' c/u</div>' +
              '</div>' +
              '<div class="qty-controls">' +
              '<button type="button" class="qty-btn" data-qty-act="dec" data-uid="' +
              escapeHTML(c.uid) +
              '">−</button>' +
              '<span>' +
              c.qty +
              '</span>' +
              '<button type="button" class="qty-btn" data-qty-act="inc" data-uid="' +
              escapeHTML(c.uid) +
              '">+</button>' +
              '</div>' +
              '</div>' +
              '<div class="cart-item__extras">' +
              '<input type="text" class="cart-item__input" data-field="person" data-uid="' +
              escapeHTML(c.uid) +
              '" value="' +
              escapeHTML(c.person || '') +
              '" placeholder="👤 ¿Para quién es? (opcional)"/>' +
              '<input type="text" class="cart-item__input" data-field="note" data-uid="' +
              escapeHTML(c.uid) +
              '" value="' +
              escapeHTML(c.note || '') +
              '" placeholder="📝 Aclaración (ej. sin pepinillos)"/>' +
              '</div>' +
              '</div>'
            );
          })
          .join('');

        // Sugerencias de acompañamientos
        const upsells = config.upsellIds
          .map((id) => menuItems.find((m) => m.id === id && m.available !== false))
          .filter((m) => m && !state.cart.some((c) => c.id === m.id));

        const upsellHtml = upsells.length
          ? '<div class="cart-upsell">' +
            '<small>¿SUMÁS PAPAS O BEBIDA?</small>' +
            '<div class="cart-upsell__list">' +
            upsells
              .map(
                (u) =>
                  '<button type="button" class="upsell-chip" data-add-id="' +
                  escapeHTML(u.id) +
                  '">+ ' +
                  escapeHTML(u.name) +
                  ' (' +
                  formatARS(u.basePrice) +
                  ')</button>'
              )
              .join('') +
            '</div>' +
            '</div>'
          : '';

        container.innerHTML = itemsHtml + upsellHtml;
      }
    }

    const shipping = getShippingCost();
    const shippingRow = $('cartShippingRow');
    if (shippingRow) {
      shippingRow.hidden = state.deliveryMode !== 'delivery';
    }
    if ($('cartShipping')) {
      $('cartShipping').textContent = shipping == null ? 'A confirmar' : formatARS(shipping);
    }
    if ($('cartSubtotal')) $('cartSubtotal').textContent = formatARS(subtotal);
    if ($('cartTotal')) {
      const grandTotal = subtotal + (typeof shipping === 'number' ? shipping : 0);
      $('cartTotal').textContent =
        formatARS(grandTotal) + (state.deliveryMode === 'delivery' && shipping == null ? ' + envío' : '');
    }
  };

  const openCart = () => {
    const drawer = $('cartDrawer');
    const overlay = $('cartOverlay');
    if (!drawer || !overlay) return;
    overlay.hidden = false;
    drawer.removeAttribute('inert');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  const closeCart = () => {
    const drawer = $('cartDrawer');
    const overlay = $('cartOverlay');
    if (!drawer || !overlay) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    overlay.hidden = true;
    document.body.style.overflow = '';
  };

  // Armado de pedido WhatsApp, Ticket y Registro en Google Sheets
  const getOrderTimestamp = () => {
    const now = new Date();
    const code = '#BN-' + Math.floor(1000 + Math.random() * 9000);
    try {
      const fecha = new Intl.DateTimeFormat('es-AR', {
        timeZone: config.timeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(now);
      const hora = new Intl.DateTimeFormat('es-AR', {
        timeZone: config.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
      return { code, fecha, hora: hora + ' hs' };
    } catch (e) {
      return {
        code,
        fecha: now.toLocaleDateString('es-AR'),
        hora: now.toTimeString().slice(0, 5) + ' hs',
      };
    }
  };

  const buildOrderPayload = () => {
    const customer = ($('customerName') ? $('customerName').value : '').trim();
    const address = ($('customerAddress') ? $('customerAddress').value : '').trim();
    const payment = $('paymentMethod') ? $('paymentMethod').value : 'Efectivo';
    const notes = ($('orderNotes') ? $('orderNotes').value : '').trim();
    const { code, fecha, hora } = getOrderTimestamp();

    const subtotal = state.cart.reduce((acc, c) => acc + c.unitPrice * c.qty, 0);
    const shipping = getShippingCost();
    const total = subtotal + (typeof shipping === 'number' ? shipping : 0);

    let burgersDoble = 0;
    let burgersTriple = 0;
    let totalUnidades = 0;

    state.cart.forEach((c) => {
      totalUnidades += c.qty;
      if (c.isBurger) {
        if (c.size === 'triple') burgersTriple += c.qty;
        else burgersDoble += c.qty;
      }
    });

    const zoneObj =
      state.deliveryMode === 'delivery'
        ? deliveryZones.find((z) => z.id === state.selectedZoneId)
        : null;

    const modalidadLabel =
      state.deliveryMode === 'delivery'
        ? 'Delivery' + (zoneObj ? ' (' + zoneObj.name + ')' : '')
        : 'Retiro en Local';

    const lines = [
      '*NUEVO PEDIDO — ' + config.brand.name + '*',
      'Comanda: *' + code + '* (' + fecha + ' · ' + hora + ')',
      'Cliente: *' + customer + '*',
      'Modalidad: *' + modalidadLabel + '*',
    ];

    if (state.deliveryMode === 'delivery') {
      lines.push('Dirección: *' + address + '*');
    }
    lines.push('Medio de pago: *' + payment + '*');
    lines.push('');
    lines.push('*DETALLE DEL PEDIDO:*');

    const hasPeople = state.cart.some((c) => (c.person || '').trim());
    if (hasPeople) {
      const groups = {};
      state.cart.forEach((c) => {
        const who = (c.person || '').trim() || 'General';
        if (!groups[who]) groups[who] = [];
        groups[who].push(c);
      });
      Object.keys(groups).forEach((who) => {
        let personTotal = 0;
        lines.push('👤 *' + who + ':*');
        groups[who].forEach((c) => {
          const lineSub = c.unitPrice * c.qty;
          personTotal += lineSub;
          const sz = c.size === 'triple' ? ' (TRIPLE)' : c.size === 'doble' ? ' (DOBLE)' : '';
          const nt = c.note ? ' [' + c.note + ']' : '';
          lines.push('  • ' + c.qty + 'x ' + c.name + sz + nt + ' — ' + formatARS(lineSub));
        });
        lines.push('  _Subtotal ' + who + ': ' + formatARS(personTotal) + '_');
      });
    } else {
      state.cart.forEach((c) => {
        const sz = c.size === 'triple' ? ' (TRIPLE)' : c.size === 'doble' ? ' (DOBLE)' : '';
        const nt = c.note ? ' [' + c.note + ']' : '';
        lines.push(
          '• ' + c.qty + 'x ' + c.name + sz + nt + ' — ' + formatARS(c.unitPrice * c.qty)
        );
      });
    }

    lines.push('');
    lines.push('Subtotal: ' + formatARS(subtotal));
    if (state.deliveryMode === 'delivery') {
      lines.push('Envío: ' + (shipping == null ? 'A confirmar' : formatARS(shipping)));
    }
    lines.push('*TOTAL: ' + formatARS(total) + '*');

    if (notes) {
      lines.push('Notas: ' + notes);
    }

    const productosResumen = state.cart
      .map((c) => {
        const sz = c.size === 'triple' ? ' Triple' : c.size === 'doble' ? ' Doble' : '';
        return c.qty + 'x ' + c.name + sz;
      })
      .join(' | ');

    return {
      code,
      fecha,
      hora,
      customer,
      modalidadLabel,
      address: state.deliveryMode === 'delivery' ? address : 'Retiro en local',
      payment,
      notes,
      subtotal,
      shipping,
      total,
      burgersDoble,
      burgersTriple,
      totalUnidades,
      productosResumen,
      whatsappText: lines.join('\n'),
    };
  };

  const logOrderToSheet = (order) => {
    if (!config.appsScriptUrl) return;
    try {
      fetch(config.appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          codigo: order.code,
          fecha: order.fecha,
          hora: order.hora,
          cliente: order.customer,
          modalidad: order.modalidadLabel,
          direccion: order.address,
          pago: order.payment,
          productos: order.productosResumen,
          burgersDoble: order.burgersDoble,
          burgersTriple: order.burgersTriple,
          totalUnidades: order.totalUnidades,
          subtotal: order.subtotal,
          envio: typeof order.shipping === 'number' ? order.shipping : 0,
          total: order.total,
          notas: order.notes,
        }),
      }).catch(() => {});
    } catch (e) {
      // Silencioso para no interrumpir WhatsApp
    }
  };

  const openTicketModal = (order, waUrl) => {
    const modal = $('ticketModal');
    if (!modal) return;

    if ($('ticketBrand')) $('ticketBrand').textContent = config.brand.name;
    if ($('ticketCode')) $('ticketCode').textContent = order.code;
    if ($('ticketDateTime')) $('ticketDateTime').textContent = order.fecha + ' · ' + order.hora;
    if ($('ticketCustomer')) $('ticketCustomer').textContent = order.customer;
    if ($('ticketMode')) {
      $('ticketMode').textContent =
        state.deliveryMode === 'delivery'
          ? order.modalidadLabel + ' — ' + order.address
          : order.modalidadLabel;
    }

    if ($('ticketItems')) {
      $('ticketItems').innerHTML = state.cart
        .map((c) => {
          const sz = c.size === 'triple' ? ' (TRIPLE)' : c.size === 'doble' ? ' (DOBLE)' : '';
          return (
            '<div class="ticket-item-row">' +
            '<span>' +
            c.qty +
            'x ' +
            escapeHTML(c.name) +
            sz +
            '</span>' +
            '<strong>' +
            formatARS(c.unitPrice * c.qty) +
            '</strong>' +
            '</div>'
          );
        })
        .join('');
    }

    if ($('ticketSubtotal')) $('ticketSubtotal').textContent = formatARS(order.subtotal);
    if ($('ticketShippingRow')) {
      $('ticketShippingRow').hidden = state.deliveryMode !== 'delivery';
    }
    if ($('ticketShipping')) {
      $('ticketShipping').textContent =
        order.shipping == null ? 'A confirmar' : formatARS(order.shipping);
    }
    if ($('ticketTotal')) $('ticketTotal').textContent = formatARS(order.total);

    if ($('ticketTransferWrap')) {
      $('ticketTransferWrap').hidden = order.payment === 'Efectivo';
    }
    if ($('ticketWhatsappLink')) {
      $('ticketWhatsappLink').setAttribute('href', waUrl);
    }

    modal.hidden = false;
  };

  const handleCheckout = () => {
    if (!state.cart.length) {
      showToast('Agregá al menos un producto al pedido.');
      return;
    }
    const customerInput = $('customerName');
    const addressInput = $('customerAddress');
    const customer = (customerInput ? customerInput.value : '').trim();
    const address = (addressInput ? addressInput.value : '').trim();

    if (!customer) {
      showToast('Por favor ingresá tu nombre.');
      if (customerInput) customerInput.focus();
      return;
    }
    if (state.deliveryMode === 'delivery' && !address) {
      showToast('Por favor ingresá la dirección de entrega.');
      if (addressInput) addressInput.focus();
      return;
    }

    const order = buildOrderPayload();
    const waUrl =
      'https://wa.me/' + config.whatsappNumber + '?text=' + encodeURIComponent(order.whatsappText);

    logOrderToSheet(order);
    closeCart();
    openTicketModal(order, waUrl);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Sincronización en vivo con Google Sheets (CSV)
  const toCsvUrl = (url) => {
    if (!url) return '';
    let clean = String(url).trim();
    if (clean.includes('/pubhtml')) {
      clean = clean.replace('/pubhtml', '/pub');
      if (!clean.includes('output=csv')) {
        clean += (clean.includes('?') ? '&' : '?') + 'output=csv';
      }
    }
    return clean;
  };

  const parseCSV = (text) => {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
        i += 1;
      } else if (ch === '\n' || ch === '\r') {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
    if (cell.length > 0 || row.length > 0) {
      row.push(cell.trim());
      rows.push(row);
    }
    return rows;
  };

  const syncFromSheets = async () => {
    const configUrl = toCsvUrl(config.sheet.configCsvUrl);
    const menuUrl = toCsvUrl(config.sheet.menuCsvUrl);
    const shippingUrl = toCsvUrl(config.sheet.shippingCsvUrl);

    if (configUrl) {
      try {
        const res = await fetch(configUrl, { cache: 'no-store' });
        if (res.ok) {
          const rows = parseCSV(await res.text());
          rows.slice(1).forEach((r) => {
            const key = (r[0] || '').toLowerCase();
            const val = r[1] || '';
            if (!key || val === '') return;
            if (key === 'nombre_marca' || key === 'nombre_local') config.brand.name = val;
            if (key === 'usuario_ig' || key === 'instagram_handle') config.brand.handle = val;
            if (key === 'direccion') config.brand.fullAddress = val;
            if (key === 'color_primario' || key === 'color_principal') config.brand.primaryColor = val;
            if (key === 'whatsapp') config.whatsappNumber = val.replace(/\D/g, '');
            if (key === 'alias_pago') config.payment.alias = val;
            if (key === 'titular_pago') config.payment.holder = val;
            if (key === 'precio_triple' && !isNaN(Number(val))) config.tripleExtraPrice = Number(val);
            if (key === 'costo_envio') {
              config.delivery.fee = isNaN(Number(val)) ? null : Number(val);
            }
            if (key === 'hora_apertura' && !isNaN(Number(val))) config.hours.open = Number(val);
            if (key === 'hora_cierre' && !isNaN(Number(val))) config.hours.close = Number(val);
            if (key === 'dias_abiertos' || key === 'dias_abierto') {
              config.hours.openDays = val
                .split(',')
                .map((d) => Number(d.trim()))
                .filter((n) => !isNaN(n));
            }
            if (key === 'promo_activa') config.promo.active = isYes(val);
            if (key === 'promo_etiqueta') config.promo.badge = val;
            if (key === 'promo_titulo') config.promo.title = val;
            if (key === 'promo_subtitulo' || key === 'promo_texto') config.promo.subtitle = val;
            if (key === 'promo_precio' && !isNaN(Number(val))) config.promo.price = Number(val);
            if (key === 'promo_precio_anterior' && !isNaN(Number(val))) config.promo.oldPrice = Number(val);
            if (key === 'usar_fotos') config.usePhotos = isYes(val);
          });
          applyBrandBindings();
          updateOpenStatus();
          renderPromoBanner();
        }
      } catch (e) {
        // Mantener respaldo local
      }
    }

    if (menuUrl) {
      try {
        const res = await fetch(menuUrl, { cache: 'no-store' });
        if (res.ok) {
          const rows = parseCSV(await res.text());
          const headers = (rows[0] || []).map((h) => h.toLowerCase());
          const idx = (name, fallback) => {
            const pos = headers.indexOf(name);
            return pos >= 0 ? pos : fallback;
          };

          const parsed = rows
            .slice(1)
            .map((r) => {
              const id = r[idx('id', 0)] || '';
              const name = r[idx('nombre', 1)] || '';
              const price = Number(String(r[idx('precio', 4)] || '').replace(/[^\d]/g, ''));
              if (!id || !name || !price) return null;

              const existing = menuItems.find((m) => m.id === id) || {};
              const cat = (r[idx('categoria', 2)] || existing.category || 'clasicas').toLowerCase();
              const dispVal = r[idx('disponible', 6)];
              const burgerVal = r[idx('es_burger', 7)];

              return Object.assign({}, existing, {
                id,
                name,
                category: cat,
                badge: r[idx('etiqueta', 3)] || existing.badge || '',
                basePrice: price,
                ingredients: r[idx('ingredientes', 5)] || existing.ingredients || '',
                available: dispVal != null && dispVal !== '' ? !isNo(dispVal) : true,
                isBurger:
                  burgerVal != null && burgerVal !== ''
                    ? isYes(burgerVal)
                    : existing.isBurger != null
                    ? existing.isBurger
                    : cat !== 'extras',
                icon: r[idx('icono', 8)] || existing.icon || '🍔',
              });
            })
            .filter(Boolean);

          if (parsed.length > 0) {
            menuItems = parsed;
            renderHeroShowcase();
            renderMenu();
            renderCart();
          }
        }
      } catch (e) {
        // Mantener respaldo local
      }
    }

    if (shippingUrl) {
      try {
        const res = await fetch(shippingUrl, { cache: 'no-store' });
        if (res.ok) {
          const rows = parseCSV(await res.text());
          const zones = rows
            .slice(1)
            .map((r, i) => {
              const id = r[0] || 'zona-' + i;
              const name = r[1] || '';
              const rawCost = r[2] || '';
              const active = r[3] == null || r[3] === '' ? true : !isNo(r[3]);
              if (!name || !active) return null;
              const numCost = Number(String(rawCost).replace(/[^\d]/g, ''));
              return {
                id,
                name,
                fee: rawCost.toLowerCase().includes('confirmar') || !numCost ? null : numCost,
              };
            })
            .filter(Boolean);

          if (zones.length > 0) {
            deliveryZones = zones;
            renderDeliveryZones();
            renderCart();
          }
        }
      } catch (e) {
        // Mantener respaldo local
      }
    }
  };

  // Reseñas y Video del local
  const renderReviews = () => {
    const section = $('resenas');
    const list = $('reviewsList');
    if (!section || !list || !reviewsListData.length) return;
    section.hidden = false;
    list.innerHTML = reviewsListData
      .map(
        (r) =>
          '<article class="review-card">' +
          '<p>“' +
          escapeHTML(r.text) +
          '”</p>' +
          '<strong>' +
          escapeHTML(r.name) +
          '</strong>' +
          '</article>'
      )
      .join('');
  };

  const initTourVideo = () => {
    const video = $('tourVideo');
    if (!video) return;
    const playBtn = $('tourPlayBtn');
    const toggleBtn = $('tourToggleBtn');
    const soundBtn = $('tourSoundBtn');
    const soundLabel = $('tourSoundLabel');
    const progressFill = $('tourProgressFill');
    const tourError = $('tourError');

    video.addEventListener('error', () => {
      if (tourError) tourError.hidden = false;
      if (playBtn) playBtn.hidden = true;
    });

    const togglePlay = () => {
      if (video.paused) {
        video.play().catch(() => {});
        if (playBtn) playBtn.hidden = true;
      } else {
        video.pause();
        if (playBtn) playBtn.hidden = false;
      }
    };

    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (toggleBtn) toggleBtn.addEventListener('click', togglePlay);

    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        soundBtn.setAttribute('aria-pressed', String(!video.muted));
        if (soundLabel) {
          soundLabel.textContent = video.muted ? 'Activar sonido' : 'Silenciar';
        }
      });
    }

    video.addEventListener('timeupdate', () => {
      if (progressFill && video.duration) {
        progressFill.style.width = (video.currentTime / video.duration) * 100 + '%';
      }
    });
  };

  // Eventos de interfaz
  const bindEvents = () => {
    if ($('mobileMenuBtn') && $('navLinks')) {
      $('mobileMenuBtn').addEventListener('click', () => {
        const nav = $('navLinks');
        const opened = nav.classList.toggle('is-open');
        $('mobileMenuBtn').setAttribute('aria-expanded', String(opened));
      });
    }

    if ($('prevHeroBurger')) {
      $('prevHeroBurger').addEventListener('click', () => {
        state.heroIndex -= 1;
        renderHeroShowcase();
      });
    }
    if ($('nextHeroBurger')) {
      $('nextHeroBurger').addEventListener('click', () => {
        state.heroIndex += 1;
        renderHeroShowcase();
      });
    }
    if ($('heroDots')) {
      $('heroDots').addEventListener('click', (e) => {
        const dot = e.target.closest('[data-hero-idx]');
        if (!dot) return;
        state.heroIndex = Number(dot.dataset.heroIdx) || 0;
        renderHeroShowcase();
      });
    }
    if ($('addHeroBurgerBtn')) {
      $('addHeroBurgerBtn').addEventListener('click', () => {
        const burgers = getHeroBurgers();
        if (burgers[state.heroIndex]) addToCart(burgers[state.heroIndex].id, 'doble');
      });
    }
    if ($('promoActionBtn')) {
      $('promoActionBtn').addEventListener('click', addPromoToCart);
    }

    if ($('filterTabs')) {
      $('filterTabs').addEventListener('click', (e) => {
        const tab = e.target.closest('[data-filter]');
        if (!tab) return;
        state.filter = tab.dataset.filter || 'all';
        document.querySelectorAll('#filterTabs .filter-tab').forEach((btn) => {
          btn.classList.toggle('is-active', btn === tab);
        });
        renderMenu();
      });
    }

    if ($('menuSearchInput')) {
      $('menuSearchInput').addEventListener('input', (e) => {
        state.query = e.target.value || '';
        renderMenu();
      });
    }

    if ($('menuGrid')) {
      $('menuGrid').addEventListener('click', (e) => {
        const sizeBtn = e.target.closest('[data-size-id]');
        if (sizeBtn) {
          state.cardSizes[sizeBtn.dataset.sizeId] = sizeBtn.dataset.size;
          renderMenu();
          return;
        }
        const addBtn = e.target.closest('[data-add-id]');
        if (addBtn) {
          addToCart(addBtn.dataset.addId);
        }
      });
    }

    if ($('openCartBtn')) $('openCartBtn').addEventListener('click', openCart);
    if ($('mobileCartBar')) $('mobileCartBar').addEventListener('click', openCart);
    if ($('closeCartBtn')) $('closeCartBtn').addEventListener('click', closeCart);
    if ($('cartOverlay')) $('cartOverlay').addEventListener('click', closeCart);

    if ($('cartItemsContainer')) {
      $('cartItemsContainer').addEventListener('click', (e) => {
        const qtyBtn = e.target.closest('[data-qty-act]');
        if (qtyBtn) {
          const idx = state.cart.findIndex((c) => c.uid === qtyBtn.dataset.uid);
          if (idx >= 0) {
            if (qtyBtn.dataset.qtyAct === 'inc') {
              state.cart[idx].qty += 1;
            } else {
              state.cart[idx].qty -= 1;
              if (state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
            }
            saveCart();
            renderCart();
          }
          return;
        }
        const upsellBtn = e.target.closest('[data-add-id]');
        if (upsellBtn) {
          addToCart(upsellBtn.dataset.addId);
        }
      });

      $('cartItemsContainer').addEventListener('input', (e) => {
        const input = e.target.closest('[data-field]');
        if (!input) return;
        const item = state.cart.find((c) => c.uid === input.dataset.uid);
        if (item) {
          item[input.dataset.field] = input.value;
          saveCart();
        }
      });
    }

    document.querySelectorAll('.delivery-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.deliveryMode = btn.dataset.delivery || 'retiro';
        document.querySelectorAll('.delivery-btn').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', String(active));
        });
        const isDel = state.deliveryMode === 'delivery';
        if ($('deliveryZoneWrap')) $('deliveryZoneWrap').hidden = !isDel;
        if ($('customerAddress')) $('customerAddress').hidden = !isDel;
        renderCart();
      });
    });

    if ($('deliveryZone')) {
      $('deliveryZone').addEventListener('change', (e) => {
        state.selectedZoneId = e.target.value;
        renderCart();
      });
    }

    if ($('paymentMethod')) {
      $('paymentMethod').addEventListener('change', (e) => {
        const box = $('transferBox');
        if (box) box.hidden = e.target.value === 'Efectivo';
      });
    }

    if ($('copyAliasBtn')) {
      $('copyAliasBtn').addEventListener('click', () =>
        copyText(config.payment.alias, 'Alias copiado: ' + config.payment.alias)
      );
    }
    if ($('ticketCopyAliasBtn')) {
      $('ticketCopyAliasBtn').addEventListener('click', () =>
        copyText(config.payment.alias, 'Alias copiado: ' + config.payment.alias)
      );
    }

    if ($('copyOrderBtn')) {
      $('copyOrderBtn').addEventListener('click', () => {
        if (!state.cart.length) {
          showToast('Tu pedido está vacío.');
          return;
        }
        const order = buildOrderPayload();
        copyText(order.whatsappText, 'Detalle del pedido copiado');
      });
    }

    if ($('sendWhatsappBtn')) {
      $('sendWhatsappBtn').addEventListener('click', handleCheckout);
    }

    if ($('closeTicketBtn')) {
      $('closeTicketBtn').addEventListener('click', () => {
        if ($('ticketModal')) $('ticketModal').hidden = true;
      });
    }
  };

  // Arranque ordenado
  applyBrandBindings();
  updateOpenStatus();
  renderPromoBanner();
  renderHeroShowcase();
  renderMenu();
  renderDeliveryZones();
  renderCart();
  renderReviews();
  initTourVideo();
  bindEvents();
  syncFromSheets();
});
