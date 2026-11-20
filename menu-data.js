'use strict';

/**
 * BUENARDA (@buenardaparana) — DATOS EDITABLES Y PLANTILLA AUTOGESTIONABLE
 * ----------------------------------------------------------------------------
 * Todo se puede actualizar en vivo desde Google Sheets (pestañas Config, Carta y Envios).
 * Si la planilla no tiene conexión o una pestaña está vacía, se usan estos valores de respaldo.
 */

const SITE = {
  // Identidad de marca (adaptable a cualquier local desde Google Sheets Config)
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
    mapsEmbedUrl: 'https://www.google.com/maps?q=Col%C3%B3n+696,+Paran%C3%A1,+Entre+R%C3%ADos,+Argentina&output=embed',
    primaryColor: '#F5B700',
  },

  // 1. Conexión a Google Sheets (enlaces publicados en la web)
  sheet: {
    menuCsvUrl:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQygwj2X-rEkanB_0y1Hor6fVbkB9x98TjBEEx0JOqv057MkwC3u3X0zjhkoY0ujQ2ZtcwG7wm6fqlo/pubhtml?gid=1624709794&single=true',
    configCsvUrl:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQygwj2X-rEkanB_0y1Hor6fVbkB9x98TjBEEx0JOqv057MkwC3u3X0zjhkoY0ujQ2ZtcwG7wm6fqlo/pubhtml?gid=0&single=true',
    // Opcional: si creás una pestaña "Envios" (columnas: zona, costo, activo), pegá acá su link publicado:
    shippingCsvUrl: '',
  },

  // 2. Registro automático de ventas en Google Sheets (Apps Script)
  appsScriptUrl:
    'https://script.google.com/macros/s/AKfycbypYYKhsqoLY1EnKm3BubgjJPvSL5luk_zSzAXEsyGK_f7DRAAWRiAHIdlGqSRbkAfy/exec',

  // Número de WhatsApp que recibe los pedidos (código de país + área + número, sin "+" ni espacios)
  whatsappNumber: '5493434717233',

  // Recargo por pasar una burger de Doble a Triple
  tripleExtraPrice: 2400,

  // Horarios. Días: 0=Domingo, 1=Lunes ... 6=Sábado. Horas en formato 24 hs (24 = medianoche).
  timeZone: 'America/Argentina/Buenos_Aires',
  hours: {
    openDays: [3, 4, 5, 6, 0],
    open: 20,
    close: 24,
    label: 'Mié a Dom 20:00 a 00:00 hs',
    fullLabel: 'Miércoles a Domingo · 20:00 a 00:00 hs',
  },

  // Envío fijo de respaldo (se usa solo si no hay zonas activas en DELIVERY_ZONES)
  delivery: { fee: null },

  // Datos de Transferencia / Mercado Pago (se muestran en 1 toque al elegir Transferencia)
  payment: {
    alias: 'buenarda.parana.mp',
    holder: 'Buenarda Paraná',
  },

  // Combo / Promo destacada de la noche (editable o desactivable desde Config en Sheets)
  promo: {
    active: true,
    id: 'promo-noche',
    badge: '🔥 PROMO DE LA NOCHE',
    title: 'COMBO BUENARDA NIGHT',
    subtitle: '2x 7th Street Doble + 1x Papas Cheddar & Bacon',
    price: 26900,
    oldPrice: 30500,
    icon: '🔥',
  },

  // Instagram
  instagramFollowers: { short: '+17.5K', long: '17,5 mil' },

  // Fotos reales de las burgers: poner true (o "si" en Config) y subir fotos a assets/burgers/<id>.jpg
  // Si además subís assets/burgers/<id>-corte.jpg, al pasar el cursor o mantener presionado muestra el corte.
  usePhotos: true,
  photoExtension: 'jpg',

  // Productos sugeridos en el carrito ("Sumá papas y bebida")
  upsellIds: ['papas-clasicas', 'papas-cheddar-bacon', 'gaseosa-lata'],
};

/**
 * Zonas de Delivery con tarifa automática.
 * También se pueden administrar desde la pestaña "Envios" de Google Sheets (columnas: zona | costo | activo).
 */
const DELIVERY_ZONES = [
  { id: 'centro', name: 'Centro / Microcentro (hasta 15 cuadras)', fee: 1500 },
  { id: 'parque-costanera', name: 'Parque Urquiza / Costanera / Cinco Esquinas', fee: 1800 },
  { id: 'barrios-cercanos', name: 'Zona Sur / La Floresta / San Agustín / Villa Sarmiento', fee: 2200 },
  { id: 'otra-zona', name: 'Otra zona de Paraná (A confirmar por WhatsApp)', fee: null },
];

/**
 * Reseñas REALES de clientes (si está vacío, la sección no aparece).
 */
const REVIEWS = [];

const MENU_ITEMS = [
  {
    id: '7th-street',
    name: '7TH STREET',
    category: 'clasicas',
    badge: 'Con Pepinillos',
    isBurger: true,
    basePrice: 15000,
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
    id: 'americana',
    name: 'AMERICANA',
    category: 'especiales',
    badge: 'Con Provolone',
    isBurger: true,
    basePrice: 15000,
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
    basePrice: 15000,
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
