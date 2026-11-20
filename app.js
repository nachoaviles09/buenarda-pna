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

  // 2. Configuración segura con respaldos (compatible con cualquier versión de menu-data.js)
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
        mapsEmbedUrl:
          'https://www.google.com/maps?q=Col%C3%B3n+696,+Paran%C3%A1,+Entre+R%C3%ADos,+Argentina&output=embed',
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

  // Utilidades
  const $ = (id) => document.getElementById(id);

  const escapeHTML = (str) =>
    String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

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

  // Aplicar datos de marca y textos dinámicos (coincidiendo con data-bind de index.html)
  const applyBrandBindings = () => {
    if (config.brand.primaryColor) {
      document.documentElement.style.setProperty('--cheddar', config.brand.primaryColor);
    }

    const streetOnly =
      config.brand.streetOnly ||
      (config.brand.shortAddress ? config.brand.shortAddress.split('—')[0].trim() : 'Colón 696');

    const bindings = {
      brandName: config.brand.name,
      brandHandle: config.brand.handle,
      brandHandleUpper: (config.brand.handle || '').toUpperCase(),
      tagline: config.brand.tagline,
      cityUpper: (config.brand.city || '').toUpperCase(),
      streetOnly: streetOnly,
      streetOnlyUpper: streetOnly.toUpperCase(),
      shortAddress: config.brand.shortAddress,
      fullAddress: config.brand.fullAddress || config.brand.shortAddress,
      marqueeLocation: (config.brand.shortAddress || 'COLÓN 696 PARANÁ')
        .replace(/—/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase(),
      hoursLabel: config.hours.label,
      hoursFullLabel: config.hours.fullLabel,
      igShort: config.instagramFollowers.short,
      igLong: config.instagramFollowers.long,
    };

    Object.keys(bindings).forEach((key) => {
      document.querySelectorAll('[data-bind="' + key + '"]').forEach((el) => {
        if (bindings[key]) el.textContent = bindings[key];
      });
    });

    document.querySelectorAll('[data-bind-href="instagramUrl"]').forEach((el) => {
      if (config.brand.instagramUrl) el.setAttribute('href', config.brand.instagramUrl);
    });
    document.querySelectorAll('[data-bind-href="mapsUrl"]').forEach((el) => {
      if (config.brand.mapsUrl) el.setAttribute('href', config.brand.mapsUrl);
    });

    const mapFrame = $('locationMapFrame');
    if (mapFrame && config.brand.mapsEmbedUrl && mapFrame.src !== config.brand.mapsEmbedUrl) {
      mapFrame.src = config.brand.mapsEmbedUrl;
    }

    const burgersCountEl = $('heroBurgersCount');
    if (burgersCountEl) {
      const totalBurgers = menuItems.filter((i) => i.isBurger).length;
      if (totalBurgers > 0) burgersCountEl.textContent = String(totalBurgers);
    }

    const aliasEl = $('aliasValueText');
    const holderEl = $('aliasHolderText');
    if (aliasEl) aliasEl.textContent = config.payment.alias;
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

  // Ilustración vectorial de cada burger (con clases de animación de styles.css)
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
      // Lechuga / tomate
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
        ? '<g class="svg-extra-patty">' +
          '<rect x="55" y="80" width="150" height="16" rx="8" fill="#4f2715"/>' +
          '<path d="M59 80 L201 80 L188 92 L164 83 L138 93 L112 83 L86 92 Z" fill="' +
          cheeseColor +
          '"/>' +
          '</g>'
        : '') +
      // Toppings
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
      return (
        '<span style="font-size:4.4rem;line-height:1;filter:drop-shadow(0 12px 18px rgba(0,0,0,.55))" aria-hidden="true">' +
        escapeHTML(item.icon || '🍟') +
        '</span>'
      );
    }
    if (config.usePhotos) {
      const ext = config.photoExtension || 'jpg';
      const mainSrc = 'assets/burgers/' + encodeURIComponent(item.id) + '.' + ext;
      const cutSrc = 'assets/burgers/' + encodeURIComponent(item.id) + '-corte.' + ext;
      return (
        '<div class="photo-stack">' +
        '<img class="item-photo" src="' +
        mainSrc +
        '" alt="' +
        escapeHTML(item.name) +
        '" loading="lazy" onerror="this.parentElement.outerHTML=this.dataset.fallback" data-fallback="' +
        escapeHTML(buildBurgerSVG(item, size)) +
        '"/>' +
        '<img class="item-photo item-photo--cut" src="' +
        cutSrc +
        '" alt="" aria-hidden="true" loading="lazy" onerror="this.nextElementSibling && this.nextElementSibling.remove(); this.remove()"/>' +
        '<span class="photo-cut-pill">✂️ Ver corte</span>' +
        '</div>'
      );
    }
    return buildBurgerSVG(item, size);
  };

  // Promo de la noche (IDs de index.html: nightPromoCard, nightPromoBadge, nightPromoTitle, nightPromoSubtitle, nightPromoOldPrice, nightPromoPrice)
  const renderPromoBanner = () => {
    const banner = $('nightPromoCard');
    if (!banner) return;
    if (!config.promo || !config.promo.active || !config.promo.title) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    if ($('nightPromoBadge')) $('nightPromoBadge').textContent = config.promo.badge || '🔥 PROMO DE LA NOCHE';
    if ($('nightPromoTitle')) $('nightPromoTitle').textContent = config.promo.title;
    if ($('nightPromoSubtitle')) $('nightPromoSubtitle').textContent = config.promo.subtitle || '';
    if ($('nightPromoOldPrice')) {
      const hasOld = Number(config.promo.oldPrice) > 0;
      $('nightPromoOldPrice').hidden = !hasOld;
      if (hasOld) $('nightPromoOldPrice').textContent = formatARS(config.promo.oldPrice);
    }
    if ($('nightPromoPrice')) {
      $('nightPromoPrice').textContent =
        Number(config.promo.price) > 0 ? formatARS(config.promo.price) : '';
    }
  };

  // Vitrina Hero
  const getHeroBurgers = () => {
    const burgers = menuItems.filter((i) => i.isBurger && i.available !== false);
    const list = burgers.length ? burgers : menuItems.filter((i) => i.isBurger);
    const topIds = ['bacon-cheese-burger', 'crispy-bacon'];
    const featured = topIds
      .map((id) => list.find((item) => item.id === id))
      .filter(Boolean);
    return featured.length ? featured : list;
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

  // Grilla de Carta (clases exactas de styles.css: burger-card__ingredients, size-selector, smash-burst)
  const getItemUnitPrice = (item, size) => {
    const base = Number(item.basePrice) || 0;
    if (item.isBurger && size === 'triple') {
      return base + config.tripleExtraPrice;
    }
    return base;
  };

  const renderMenu = (animateCards = false) => {
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
          ? '<div class="size-selector" role="group" aria-label="Tamaño de medallones">' +
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
          (animateCards ? ' is-entering' : '') +
          (isSoldOut ? ' is-sold-out' : '') +
          '" data-card-id="' +
          escapeHTML(item.id) +
          '">' +
          '<div>' +
          '<div class="burger-card__top">' +
          '<span class="burger-card__badge">' +
          escapeHTML(item.badge || (item.isBurger ? 'Smash' : 'Extra')) +
          '</span>' +
          (isSoldOut
            ? '<span class="burger-card__badge burger-card__badge--soldout">Agotado por hoy</span>'
            : '') +
          '</div>' +
          '<div class="burger-card__visual">' +
          (item.isBurger ? '<span class="smash-burst" aria-hidden="true"></span>' : '') +
          renderVisualHTML(item, size) +
          '</div>' +
          '<h3 class="burger-card__title">' +
          escapeHTML(item.name) +
          '</h3>' +
          '<p class="burger-card__ingredients">' +
          escapeHTML(item.ingredients || '') +
          '</p>' +
          '</div>' +
          '<div>' +
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

  // Feedback visual al agregar al carrito
  const pulseCartBadge = () => {
    const badge = $('cartCountBadge');
    if (!badge) return;
    badge.classList.remove('is-bump');
    void badge.offsetWidth;
    badge.classList.add('is-bump');
  };

  const flashAddedButton = (btn) => {
    if (!btn) return;
    const prevText = btn.textContent;
    btn.classList.add('is-added');
    btn.textContent = '✓ Agregado';
    setTimeout(() => {
      btn.classList.remove('is-added');
      btn.textContent = prevText;
    }, 900);
  };

  // Carrito y Checkout
  const addToCart = (itemId, forcedSize, sourceBtn) => {
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
    pulseCartBadge();
    flashAddedButton(sourceBtn);
    showToast('Agregado: ' + item.name + (item.isBurger ? ' (' + size.toUpperCase() + ')' : ''));
  };

  const addPromoToCart = (sourceBtn) => {
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
    pulseCartBadge();
    flashAddedButton(sourceBtn);
    openCart();
  };

  // [AGREGADO] Puente para las promos extra de wow.js (no altera nada del flujo existente)
  window.BuenardaCart = {
    addCustom(id, name, unitPrice, note, sourceBtn) {
      const existing = state.cart.find((c) => c.id === id);
      if (existing) {
        existing.qty += 1;
      } else {
        state.cart.push({
          uid: 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          id,
          name,
          isBurger: false,
          size: 'promo',
          unitPrice: Number(unitPrice) || 0,
          qty: 1,
          person: '',
          note: note || '',
        });
      }
      saveCart();
      renderCart();
      pulseCartBadge();
      flashAddedButton(sourceBtn);
      showToast('Agregado: ' + name);
      openCart();
    },
    ids() {
      return state.cart.map((c) => c.id);
    },
  };

 const getShippingCost = () => {
    if (state.deliveryMode !== 'delivery') return 0;
    return config.delivery.fee == null || config.delivery.fee === ''
      ? null
      : Number(config.delivery.fee);
  };

  const renderDeliveryZones = () => {
    const select = $('deliveryZoneSelect');
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
    const totalBurgers = state.cart.reduce(
      (acc, c) => acc + (c.isBurger && c.size !== 'promo' ? c.qty : 0),
      0
    );
    const subtotal = state.cart.reduce((acc, c) => acc + c.unitPrice * c.qty, 0);

    if ($('cartCountBadge')) $('cartCountBadge').textContent = String(totalUnits);

    const mobileBar = $('mobileCartBar');
    if (mobileBar) {
      mobileBar.hidden = totalUnits === 0;
      document.body.classList.toggle('has-cart-bar', totalUnits > 0);
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
            const lineSubtotal = c.unitPrice * c.qty;
            const showPerson = totalBurgers >= 2 && c.isBurger && c.size !== 'promo';

            const noteInput =
              '<input type="text" class="cart-item__note" data-field="note" data-uid="' +
              escapeHTML(c.uid) +
              '" value="' +
              escapeHTML(c.note || '') +
              '" placeholder="📝 Aclaración (ej. sin pepinillos)"/>';

            const inputsHtml = showPerson
              ? '<div class="cart-item__inputs">' +
                '<input type="text" class="cart-item__person" data-field="person" data-uid="' +
                escapeHTML(c.uid) +
                '" value="' +
                escapeHTML(c.person || '') +
                '" placeholder="👤 ¿De quién es?"/>' +
                noteInput +
                '</div>'
              : noteInput;

            return (
              '<div class="cart-item" data-uid="' +
              escapeHTML(c.uid) +
              '">' +
              '<div class="cart-item__row">' +
              '<div class="cart-item__info">' +
              '<h4>' +
              escapeHTML(c.name) +
              sizeLabel +
              '</h4>' +
              '<span class="cart-item__meta">' +
              formatARS(c.unitPrice) +
              ' c/u · Subtotal: ' +
              formatARS(lineSubtotal) +
              '</span>' +
              '</div>' +
              '<div class="cart-item__controls">' +
              '<button type="button" class="qty-btn" data-qty-act="dec" data-uid="' +
              escapeHTML(c.uid) +
              '" aria-label="Restar unidad">−</button>' +
              '<strong>' +
              c.qty +
              '</strong>' +
              '<button type="button" class="qty-btn" data-qty-act="inc" data-uid="' +
              escapeHTML(c.uid) +
              '" aria-label="Sumar unidad">+</button>' +
              '<button type="button" class="qty-btn qty-btn--remove" data-qty-act="del" data-uid="' +
              escapeHTML(c.uid) +
              '" aria-label="Eliminar producto">✕</button>' +
              '</div>' +
              '</div>' +
              inputsHtml +
              '</div>'
            );
          })
          .join('');

        // Sugerencias de acompañamientos (clases exactas de styles.css: upsell, upsell__title, upsell__item, upsell__emoji, upsell__info, upsell__btn)
        const upsells = config.upsellIds
          .map((id) => menuItems.find((m) => m.id === id && m.available !== false))
          .filter((m) => m && !state.cart.some((c) => c.id === m.id));

        const upsellHtml = upsells.length
          ? '<div class="upsell">' +
            '<h4 class="upsell__title">🍟 ¿SUMÁS PAPAS O BEBIDA?</h4>' +
            upsells
              .map(
                (u) =>
                  '<div class="upsell__item">' +
                  '<span class="upsell__emoji">' +
                  escapeHTML(u.icon || '🍟') +
                  '</span>' +
                  '<div class="upsell__info">' +
                  '<strong>' +
                  escapeHTML(u.name) +
                  '</strong>' +
                  '<small>' +
                  formatARS(u.basePrice) +
                  '</small>' +
                  '</div>' +
                  '<button type="button" class="upsell__btn" data-add-id="' +
                  escapeHTML(u.id) +
                  '">+ Sumar</button>' +
                  '</div>'
              )
              .join('') +
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
      $('cartShipping').textContent =
        shipping == null ? 'A confirmar por WhatsApp' : formatARS(shipping);
    }
    if ($('cartSubtotal')) $('cartSubtotal').textContent = formatARS(subtotal);
    if ($('cartTotal')) {
      const grandTotal = subtotal + (typeof shipping === 'number' ? shipping : 0);
      $('cartTotal').textContent =
        formatARS(grandTotal) +
        (state.deliveryMode === 'delivery' && shipping == null ? ' + envío' : '');
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
    document.body.classList.add('no-scroll');
  };

  const closeCart = () => {
    const drawer = $('cartDrawer');
    const overlay = $('cartOverlay');
    if (!drawer || !overlay) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    overlay.hidden = true;
    document.body.classList.remove('no-scroll');
  };

  // Armado de pedido WhatsApp, Ticket Térmico y Registro en Google Sheets
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

    const modalidadLabel =
      state.deliveryMode === 'delivery' ? 'Delivery' : 'Retiro en Local';

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

    lines.push(
      '*TOTAL: ' +
        formatARS(total) +
        (state.deliveryMode === 'delivery' && shipping == null ? ' + envío' : '') +
        '*'
    );

   const canAssignPerson = burgersDoble + burgersTriple >= 2;
    const hasPeople =
      canAssignPerson &&
      state.cart.some((c) => c.isBurger && c.size !== 'promo' && (c.person || '').trim());

    if (hasPeople) {
      const groups = {};
      state.cart.forEach((c) => {
        const who =
          c.isBurger && c.size !== 'promo' && (c.person || '').trim()
            ? c.person.trim()
            : 'General';
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

  // Modal Ticket Térmico (IDs y clases exactas de index.html y styles.css)
  const openTicketModal = (order, waUrl) => {
    const overlay = $('ticketOverlay');
    if (!overlay) return;

    if ($('ticketBrand')) $('ticketBrand').textContent = config.brand.name;
    if ($('ticketAddress')) {
      $('ticketAddress').textContent = config.brand.fullAddress || config.brand.shortAddress;
    }
    if ($('ticketCode')) $('ticketCode').textContent = order.code;
    if ($('ticketDateTime')) $('ticketDateTime').textContent = order.fecha + ' · ' + order.hora;

    if ($('ticketCustomerInfo')) {
      $('ticketCustomerInfo').innerHTML =
        '<span><strong>CLIENTE:</strong> ' +
        escapeHTML(order.customer) +
        '</span>' +
        '<span><strong>ENTREGA:</strong> ' +
        escapeHTML(
          state.deliveryMode === 'delivery'
            ? order.modalidadLabel + ' — ' + order.address
            : order.modalidadLabel
        ) +
        '</span>' +
        '<span><strong>PAGO:</strong> ' +
        escapeHTML(order.payment) +
        '</span>' +
        (order.notes
          ? '<span><strong>NOTAS:</strong> ' + escapeHTML(order.notes) + '</span>'
          : '');
    }

   if ($('ticketItemsList')) {
      const totalBurgersTicket = state.cart.reduce(
        (acc, c) => acc + (c.isBurger && c.size !== 'promo' ? c.qty : 0),
        0
      );

      $('ticketItemsList').innerHTML = state.cart
        .map((c) => {
          const sz = c.size === 'triple' ? ' (TRIPLE)' : c.size === 'doble' ? ' (DOBLE)' : '';
          const showBadge =
            totalBurgersTicket >= 2 &&
            c.isBurger &&
            c.size !== 'promo' &&
            (c.person || '').trim();
          const personBadge = showBadge
            ? '<span class="ticket-row__person">' + escapeHTML(c.person.trim()) + '</span>'
            : '';
          const subNote = (c.note || '').trim()
            ? '<span class="ticket-row__sub">* ' + escapeHTML(c.note.trim()) + '</span>'
            : '';
          return (
            '<div class="ticket-row">' +
            '<div class="ticket-row__main">' +
            personBadge +
            '<span>' +
            c.qty +
            'x ' +
            escapeHTML(c.name) +
            sz +
            '</span>' +
            subNote +
            '</div>' +
            '<span class="ticket-row__price">' +
            formatARS(c.unitPrice * c.qty) +
            '</span>' +
            '</div>'
          );
        })
        .join('');
    }

    if ($('ticketTotalsList')) {
      let totalsHtml =
        '<div class="ticket-total-row">' +
        '<span>SUBTOTAL</span>' +
        '<span>' +
        formatARS(order.subtotal) +
        '</span>' +
        '</div>';

      if (state.deliveryMode === 'delivery') {
        totalsHtml +=
          '<div class="ticket-total-row">' +
          '<span>ENVÍO</span>' +
          '<span>' +
          (order.shipping == null ? 'A CONFIRMAR' : formatARS(order.shipping)) +
          '</span>' +
          '</div>';
      }

      totalsHtml +=
        '<div class="ticket-total-row ticket-total-row--grand">' +
        '<span>TOTAL</span>' +
        '<span>' +
        formatARS(order.total) +
        '</span>' +
        '</div>';

      $('ticketTotalsList').innerHTML = totalsHtml;
    }

    if ($('ticketReopenWaBtn')) {
      $('ticketReopenWaBtn').setAttribute('href', waUrl);
    }

    overlay.hidden = false;
  };

let waRedirectTimer = null;

  const handleCheckout = () => {
    if (!state.cart.length) {
      showToast('Agregá al menos un producto al pedido.');
      return;
    }
    const customerInput = $('customerName');
    const addressInput = $('customerAddress');
    const customer = (customerInput ? customerInput.value : '').trim();
    const address = (addressInput ? addressInput.value : '').trim();

    if (customerInput) customerInput.classList.remove('is-invalid');
    if (addressInput) addressInput.classList.remove('is-invalid');

    if (!customer) {
      showToast('Por favor ingresá tu nombre.');
      if (customerInput) {
        customerInput.classList.add('is-invalid');
        customerInput.focus();
      }
      return;
    }
    if (state.deliveryMode === 'delivery' && !address) {
      showToast('Por favor ingresá la dirección de entrega.');
      if (addressInput) {
        addressInput.classList.add('is-invalid');
        addressInput.focus();
      }
      return;
    }

    const order = buildOrderPayload();
    const waUrl =
      'https://wa.me/' + config.whatsappNumber + '?text=' + encodeURIComponent(order.whatsappText);

    logOrderToSheet(order);
    closeCart();
    openTicketModal(order, waUrl);

    state.cart = [];
    if (typeof saveState === 'function') {
      saveState();
    } else {
      try {
        localStorage.removeItem('buenarda_cart');
        localStorage.removeItem('buenarda_state');
      } catch (e) {}
    }
    renderCart();

    closeCart();
    openTicketModal(order, waUrl);

    clearTimeout(waRedirectTimer);
    waRedirectTimer = setTimeout(() => {
      window.location.href = waUrl;
    }, 2000);
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
            if (key === 'promo_precio_anterior' && !isNaN(Number(val))) {
              config.promo.oldPrice = Number(val);
            }
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
            applyBrandBindings();
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
              const hasIdCol = rows[0] && rows[0].length >= 4;
              const id = hasIdCol ? r[0] || 'zona-' + i : 'zona-' + i;
              const name = hasIdCol ? r[1] || '' : r[0] || '';
              const rawCost = hasIdCol ? r[2] || '' : r[1] || '';
              const activeCol = hasIdCol ? r[3] : r[2];
              const active = activeCol == null || activeCol === '' ? true : !isNo(activeCol);
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
          '<figure class="review-card">' +
          '<blockquote>“' +
          escapeHTML(r.text) +
          '”</blockquote>' +
          '<figcaption><strong>' +
          escapeHTML(r.name) +
          '</strong></figcaption>' +
          '</figure>'
      )
      .join('');
  };

  const initTourVideo = () => {
    const player = $('tourPlayer');
    const video = $('tourVideo');
    if (!video) return;
    const playBtn = $('tourPlayBtn');
    const toggleBtn = $('tourToggleBtn');
    const soundBtn = $('tourSoundBtn');
    const soundLabel = $('tourSoundLabel');
    const progress = $('tourProgress');
    const progressFill = $('tourProgressFill');
    const tourError = $('tourError');

    const syncPlayerUI = () => {
      if (player) {
        player.classList.toggle('is-playing', !video.paused && !video.ended);
        player.classList.toggle('is-unmuted', !video.muted);
      }
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-label', video.paused ? 'Reproducir video' : 'Pausar video');
      }
    };

    video.addEventListener('play', syncPlayerUI);
    video.addEventListener('pause', syncPlayerUI);
    video.addEventListener('volumechange', syncPlayerUI);

    video.addEventListener('error', () => {
      if (tourError) tourError.hidden = false;
      if (player) player.classList.add('has-error');
    });

    const togglePlay = () => {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
      syncPlayerUI();
    };

    video.addEventListener('click', togglePlay);
    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (toggleBtn) toggleBtn.addEventListener('click', togglePlay);

    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        soundBtn.setAttribute('aria-pressed', String(!video.muted));
        if (soundLabel) {
          soundLabel.textContent = video.muted ? 'Activar sonido' : 'Silenciar';
        }
        syncPlayerUI();
      });
    }

    video.addEventListener('timeupdate', () => {
      if (video.duration) {
        const pct = (video.currentTime / video.duration) * 100;
        if (progressFill) progressFill.style.width = pct + '%';
        if (progress) progress.setAttribute('aria-valuenow', String(Math.round(pct)));
      }
    });

    if (progress) {
      progress.addEventListener('click', (e) => {
        if (!video.duration) return;
        const rect = progress.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        video.currentTime = ratio * video.duration;
      });
    }

    syncPlayerUI();
  };

  // Eventos de interfaz
  const bindEvents = () => {
    if ($('mobileMenuBtn') && $('navLinks')) {
      $('mobileMenuBtn').addEventListener('click', () => {
        const nav = $('navLinks');
        const opened = nav.classList.toggle('is-open');
        $('mobileMenuBtn').setAttribute('aria-expanded', String(opened));
      });
      $('navLinks').addEventListener('click', (e) => {
        if (e.target.closest('a')) {
          $('navLinks').classList.remove('is-open');
          $('mobileMenuBtn').setAttribute('aria-expanded', 'false');
        }
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
      $('addHeroBurgerBtn').addEventListener('click', (e) => {
        const burgers = getHeroBurgers();
        if (burgers[state.heroIndex]) {
          addToCart(burgers[state.heroIndex].id, 'doble', e.currentTarget);
        }
      });
    }
    if ($('addPromoBtn')) {
      $('addPromoBtn').addEventListener('click', (e) => addPromoToCart(e.currentTarget));
    }

    if ($('filterTabs')) {
      $('filterTabs').addEventListener('click', (e) => {
        const tab = e.target.closest('[data-filter]');
        if (!tab) return;
        state.filter = tab.dataset.filter || 'all';
        document.querySelectorAll('#filterTabs .filter-tab').forEach((btn) => {
          btn.classList.toggle('is-active', btn === tab);
        });
        renderMenu(true);
      });
    }

    if ($('menuSearchInput')) {
      $('menuSearchInput').addEventListener('input', (e) => {
        state.query = e.target.value || '';
        renderMenu(false);
      });
    }

    if ($('menuGrid')) {
      $('menuGrid').addEventListener('click', (e) => {
        const sizeBtn = e.target.closest('[data-size-id]');
        if (sizeBtn) {
          const id = sizeBtn.dataset.sizeId;
          const nextSize = sizeBtn.dataset.size;
          state.cardSizes[id] = nextSize;
          renderMenu(false);
          if (nextSize === 'triple') {
            const card = $('menuGrid').querySelector('[data-card-id="' + CSS.escape(id) + '"]');
            if (card) {
              card.classList.add('is-smashing');
              setTimeout(() => card.classList.remove('is-smashing'), 650);
            }
          }
          return;
        }
        const addBtn = e.target.closest('[data-add-id]');
        if (addBtn) {
          addToCart(addBtn.dataset.addId, null, addBtn);
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
            const act = qtyBtn.dataset.qtyAct;
            if (act === 'inc') {
              state.cart[idx].qty += 1;
            } else if (act === 'del') {
              state.cart.splice(idx, 1);
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
          addToCart(upsellBtn.dataset.addId, null, upsellBtn);
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

    const syncShippingRuleBox = () => {
      const isDel = state.deliveryMode === 'delivery';
      const cartRoot = $('cartDrawer');
      if (!cartRoot) return;

      const boxes = new Set(cartRoot.querySelectorAll('.shipping-rule-box'));
      cartRoot.querySelectorAll('div, p, aside').forEach((el) => {
        if (
          el.id === 'cartDrawer' ||
          el.id === 'cartFooter' ||
          el.classList.contains('order-form') ||
          el.classList.contains('cart-totals')
        ) {
          return;
        }
        const txt = (el.textContent || '').toLowerCase();
        if (txt.includes('repartidor') || (txt.includes('ubicación') && txt.includes('cambio'))) {
          const parent = el.parentElement;
          const parentHasSameText =
            parent &&
            parent.id !== 'cartFooter' &&
            !parent.classList.contains('order-form') &&
            (parent.textContent || '').toLowerCase().includes('repartidor');
          if (!parentHasSameText) boxes.add(el);
        }
      });

      boxes.forEach((box) => {
        if (box.hidden !== !isDel) box.hidden = !isDel;
        const targetDisplay = isDel ? '' : 'none';
        if (box.style.display !== targetDisplay) {
          box.style.setProperty('display', targetDisplay, isDel ? '' : 'important');
        }
      });
    };

    syncShippingRuleBox();
    const cartDrawerEl = $('cartDrawer');
    if (cartDrawerEl && 'MutationObserver' in window) {
      new MutationObserver(syncShippingRuleBox).observe(cartDrawerEl, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden', 'style', 'class'],
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
        syncShippingRuleBox();

        let addrInput = $('customerAddress');
        if (!addrInput && $('customerName')) {
          addrInput = document.createElement('input');
          addrInput.type = 'text';
          addrInput.id = 'customerAddress';
          addrInput.className = 'form-input';
          addrInput.placeholder = 'Dirección en Paraná (ej. Urquiza 1150)';
          addrInput.autocomplete = 'street-address';
          addrInput.setAttribute('aria-label', 'Dirección de entrega');
          addrInput.hidden = true;
          $('customerName').insertAdjacentElement('afterend', addrInput);
        }
        if (addrInput) addrInput.hidden = !isDel;

        renderCart();
      });
    });

    if ($('paymentMethod')) {
      $('paymentMethod').addEventListener('change', (e) => {
        const box = $('aliasCard');
        if (box) box.hidden = e.target.value === 'Efectivo';
      });
    }

    if ($('copyAliasBtn')) {
      $('copyAliasBtn').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        copyText(config.payment.alias, 'Alias copiado: ' + config.payment.alias);
        btn.classList.add('is-copied');
        const prev = btn.textContent;
        btn.textContent = '✓ ¡Copiado!';
        setTimeout(() => {
          btn.classList.remove('is-copied');
          btn.textContent = prev;
        }, 1600);
      });
    }

    if ($('sendWhatsappBtn')) {
      $('sendWhatsappBtn').addEventListener('click', handleCheckout);
    }

    if ($('ticketReopenWaBtn')) {
      $('ticketReopenWaBtn').addEventListener('click', () => {
        clearTimeout(waRedirectTimer);
      });
    }

    if ($('closeTicketBtn')) {
      $('closeTicketBtn').addEventListener('click', () => {
        clearTimeout(waRedirectTimer);
        if ($('ticketOverlay')) $('ticketOverlay').hidden = true;
      });
    }

    if ($('ticketOverlay')) {
      $('ticketOverlay').addEventListener('click', (e) => {
        if (e.target === $('ticketOverlay')) {
          clearTimeout(waRedirectTimer);
          $('ticketOverlay').hidden = true;
        }
      });
    }
  };

  // Arranque ordenado
  applyBrandBindings();
  updateOpenStatus();
  renderPromoBanner();
  renderHeroShowcase();
  renderMenu(true);
  renderCart();
  renderReviews();
  initTourVideo();
  bindEvents();
  syncFromSheets();
});