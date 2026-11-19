'use strict';

/**
 * BUENARDA (@buenardaparana) — DATOS EDITABLES Y PLANTILLA AUTOGESTIONABLE
 * ----------------------------------------------------------------------------
 * Actualizado con precios reales, descripciones oficiales, promos en efectivo
 * y políticas oficiales del local.
 */

const SITE = {
  brand: {
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

  // 1. Conexión a Google Sheets (CSV publicados)
  sheet: {
    menuCsvUrl:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQygwj2X-rEkanB_0y1Hor6fVbkB9x98TjBEEx0JOqv057MkwC3u3X0zjhkoY0ujQ2ZtcwG7wm6fqlo/pub?gid=1624709794&single=true&output=csv',
    configCsvUrl:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQygwj2X-rEkanB_0y1Hor6fVbkB9x98TjBEEx0JOqv057MkwC3u3X0zjhkoY0ujQ2ZtcwG7wm6fqlo/pub?gid=0&single=true&output=csv',
    shippingCsvUrl: '',
  },

  // 2. Registro automático de ventas en Google Sheets (Apps Script)
  appsScriptUrl:
    'https://script.google.com/macros/s/AKfycbypYYKhsqoLY1EnKm3BubgjJPvSL5luk_zSzAXEsyGK_f7DRAAWRiAHIdlGqSRbkAfy/exec',

  // Número de WhatsApp que recibe los pedidos
  whatsappNumber: '5493434717233',

  // Recargo por pasar una burger de Doble a Triple
  tripleExtraPrice: 2500,

  // Horarios (0=Dom, 1=Lun ... 6=Sáb)
  timeZone: 'America/Argentina/Buenos_Aires',
  hours: {
    openDays: [3, 4, 5, 6, 0],
    open: 20,
    close: 24,
    label: 'Mié a Dom 20:00 a 00:00 hs',
    fullLabel: 'Miércoles a Domingo · 20:00 a 00:00 hs',
  },

  // Envío fijo de respaldo si no se usa DELIVERY_ZONES
  delivery: { fee: null },

  // Regla oficial de envíos
  shippingPolicy:
    'ENVIOS: Enviar ubicación, y ACLARAR si abona Justo o enviamos cambio, de lo contrario el importe se redondeará a favor del repartidor. ¡Muchas gracias por comprender!',

  // Política de cocina
  noModificationsNotice: 'Las burgers salen con lo que incluyen SIN MODIFICACIONES.',

  // Datos de Transferencia / Mercado Pago (solo para productos fuera de promo)
  payment: {
    alias: 'buenarda.parana.mp',
    holder: 'Buenarda Paraná',
  },

  // Banner destacado arriba de la carta
  promo: {
    active: true,
    id: 'promo-2-bacon-cheese',
    badge: '💵 PROMO OFICIAL · SOLO EFECTIVO',
    title: 'X2 BACON CHEESE + PAPAS FRITAS',
    subtitle: '2x Bacon Cheese Burger Doble + Papas Fritas · Válido únicamente abonando en efectivo.',
    price: 28000,
    oldPrice: 30000,
    icon: '🔥',
  },

  instagramFollowers: { short: '+17.5K', long: '17,5 mil' },

  // Fotos reales: poné true cuando subas las fotos recortadas a assets/burgers/<id>.jpg
  usePhotos: false,
  photoExtension: 'png',

  // Sugerencias dentro del carrito
  upsellIds: ['papas-clasicas', 'papas-cheddar-bacon', 'gaseosa-lata'],
};

const DELIVERY_ZONES = [
  { id: 'centro', name: 'Centro / Microcentro (hasta 15 cuadras)', fee: 1500 },
  { id: 'parque-costanera', name: 'Parque Urquiza / Costanera / Cinco Esquinas', fee: 1800 },
  { id: 'barrios-cercanos', name: 'Zona Sur / La Floresta / San Agustín / Villa Sarmiento', fee: 2200 },
  { id: 'otra-zona', name: 'Otra zona de Paraná (A confirmar por WhatsApp)', fee: null },
];

const REVIEWS = [];

const MENU_ITEMS = [
  // ==================== PROMOS OFICIALES (SOLO EN EFECTIVO) ====================
  {
    id: 'promo-2-cheese-burger',
    name: 'PROMO X2 CHEESE BURGER + PAPAS',
    category: 'promos',
    badge: 'Solo Efectivo',
    isBurger: false,
    isPromo: true,
    cashOnly: true,
    basePrice: 25000,
    ingredients:
      '2X CHEESE BURGER DOBLE + PAPAS FRITAS. VÁLIDO ÚNICAMENTE ABONANDO EN EFECTIVO. SIN MODIFICACIONES.',
    icon: '🔥',
  },
  {
    id: 'promo-2-bacon-cheese',
    name: 'PROMO X2 BACON CHEESE + PAPAS',
    category: 'promos',
    badge: 'Solo Efectivo',
    isBurger: false,
    isPromo: true,
    cashOnly: true,
    basePrice: 28000,
    ingredients:
      '2X BACON CHEESE BURGER DOBLE + PAPAS FRITAS. VÁLIDO ÚNICAMENTE ABONANDO EN EFECTIVO. SIN MODIFICACIONES.',
    icon: '🔥',
  },
  {
    id: 'promo-2-crispy-bacon',
    name: 'PROMO X2 CRISPY BACON + PAPAS',
    category: 'promos',
    badge: 'Solo Efectivo',
    isBurger: false,
    isPromo: true,
    cashOnly: true,
    basePrice: 30000,
    ingredients:
      '2X CRISPY BACON DOBLE + PAPAS FRITAS. VÁLIDO ÚNICAMENTE ABONANDO EN EFECTIVO. SIN MODIFICACIONES.',
    icon: '🔥',
  },
  {
    id: 'combo-4-bacon-cheese',
    name: 'COMBO X4 BACON CHEESE BURGER + PAPAS',
    category: 'promos',
    badge: 'Solo Efectivo',
    isBurger: false,
    isPromo: true,
    cashOnly: true,
    basePrice: 52000,
    ingredients:
      '4X BACON CHEESE BURGER DOBLE + PAPAS FRITAS. VÁLIDO ÚNICAMENTE ABONANDO EN EFECTIVO. SIN MODIFICACIONES.',
    icon: '🍔',
  },
  {
    id: 'promo-triple-bacon-cheese',
    name: 'PROMO TRIPLE BACON CHEESE + PAPAS',
    category: 'promos',
    badge: 'Solo Efectivo',
    isBurger: false,
    isPromo: true,
    cashOnly: true,
    basePrice: 15000,
    ingredients:
      'BACON CHEESE BURGER TRIPLE + PAPAS FRITAS. VÁLIDO ÚNICAMENTE ABONANDO EN EFECTIVO. SIN MODIFICACIONES.',
    icon: '👑',
  },

  // ==================== HAMBURGUESAS OFICIALES ($15.000) ====================
  {
    id: '7th-street',
    name: '7TH STREET',
    category: 'clasicas',
    badge: 'Top Ventas',
    isBurger: true,
    basePrice: 15000,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLONES CARNE VACUNA, QUESO CHEDDAR AMERICANO X4, PEPINILLOS, CEBOLLA FRESCA BRUNOISE, SALSA THOUSAND ISLAND.',
    layers: {
      cheese: 'cheddar',
      pickles: true,
      dicedOnion: true,
      sauce: 'thousand-island',
    },
  },
  {
    id: 'americana',
    name: 'AMERICANA',
    category: 'especiales',
    badge: 'Con Provolone',
    isBurger: true,
    basePrice: 15000,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO PROVOLONE X4, LECHUGA, TOMATE, HUEVO FRITO, SALSA THOUSAND ISLAND.',
    layers: {
      cheese: 'provolone',
      lettuce: true,
      tomato: true,
      egg: true,
      sauce: 'thousand-island',
    },
  },
  {
    id: 'bbq-crispy',
    name: 'BBQ CRISPY',
    category: 'especiales',
    badge: 'Crocante',
    isBurger: true,
    basePrice: 15000,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO CHEDDAR X4, CEBOLLA CRISPY, SALSA BARBACOA.',
    layers: {
      cheese: 'cheddar',
      crispyOnion: true,
      sauce: 'bbq',
    },
  },
  {
    id: 'egg-bacon',
    name: 'EGG BACON',
    category: 'bacon',
    badge: 'Bomba',
    isBurger: true,
    basePrice: 15000,
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
    id: 'bacon-cheese-burger',
    name: 'BACON CHEESE BURGER',
    category: 'bacon',
    badge: 'Salsa Buenarda',
    isBurger: true,
    basePrice: 15000,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO CHEDDAR X4, BACON AHUMADO, SALSA BUENARDA.',
    layers: {
      cheese: 'cheddar',
      bacon: true,
      sauce: 'buenarda',
    },
  },
  {
    id: 'crispy-bacon',
    name: 'CRISPY BACON',
    category: 'bacon',
    badge: 'Salsa Alioli',
    isBurger: true,
    basePrice: 15000,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO CHEDDAR SMOCKED X4, BACON AHUMADO, CEBOLLA CRISPY, SALSA ALIOLI.',
    layers: {
      cheese: 'smoked-cheddar',
      bacon: true,
      crispyOnion: true,
      sauce: 'alioli',
    },
  },
  {
    id: 'caramel-bacon',
    name: 'CARAMEL BACON',
    category: 'bacon',
    badge: 'Cheddar Ahumado',
    isBurger: true,
    basePrice: 15000,
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
    id: 'cheese-burger',
    name: 'CHEESE BURGER',
    category: 'clasicas',
    badge: 'Clásica',
    isBurger: true,
    basePrice: 15000,
    ingredients:
      'PAN ESPECIAL BUENARDA, DOBLE MEDALLÓN CARNE VACUNA, QUESO CHEDDAR X4, SALSA ROYALE (CEBOLLA FRESCA EN DADOS CON KETCHUP).',
    layers: {
      cheese: 'cheddar',
      dicedOnion: true,
      sauce: 'royale',
    },
  },

  // ==================== PAPAS Y BEBIDAS ====================
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