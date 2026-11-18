'use strict';

/**
 * BUENARDA (@buenardaparana) — DATOS EDITABLES
 * ----------------------------------------------------------------------------
 * Este es el ÚNICO archivo que hace falta tocar para cambiar precios, productos,
 * horarios, costo de envío, número de WhatsApp o reseñas. No hace falta tocar app.js.
 */

const SITE = {
  // ... tus propiedades actuales (timeZone, hours, tripleExtraPrice, whatsappNumber, etc.) ...

  // 1. Conexión a Google Sheets (pegar acá los enlaces CSV publicados)
  sheet: {
    menuCsvUrl: '',   // Pestaña "Carta" publicada como CSV
    configCsvUrl: '', // Pestaña "Config" publicada como CSV (opcional)
  },

  // 4. Registro automático de ventas en Google Sheets (URL de implementación de Apps Script)
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbypYYKhsqoLY1EnKm3BubgjJPvSL5luk_zSzAXEsyGK_f7DRAAWRiAHIdlGqSRbkAfy/exec',
};

  // Número de WhatsApp que recibe los pedidos (código de país + área + número, sin "+" ni espacios).
  // ⚠️ Confirmar que sea el número oficial antes de publicar.
  whatsappNumber: '5493434717233',

  // Recargo por pasar una burger de Doble a Triple
  tripleExtraPrice: 2400,

  // Horarios. Días: 0=Domingo, 1=Lunes ... 6=Sábado. Horas en formato 24 hs (24 = medianoche).
  timeZone: 'America/Argentina/Buenos_Aires',
  hours: { openDays: [3, 4, 5, 6, 0], open: 20, close: 24 },

  // Envío. fee: número (ej. 1500) para sumarlo al total, o null para mostrar "A confirmar por WhatsApp".
  delivery: { fee: null },

  // Instagram (se muestran en la portada y en la sección de ubicación)
  instagramFollowers: { short: '+17.5K', long: '17,5 mil' },

  // Fotos de las burgers: poner true y subir las fotos a assets/burgers/ con el id del producto
  // como nombre (ej. assets/burgers/7th-street.jpg). Si falta alguna, se usa la ilustración.
  usePhotos: false,
  photoExtension: 'jpg',

  // Productos que se sugieren en el carrito ("Sumá papas y bebida")
  upsellIds: ['papas-clasicas', 'papas-cheddar-bacon', 'gaseosa-lata'],
};

/**
 * Reseñas REALES de clientes (se muestran en una sección automática).
 * Si la lista está vacía, la sección no aparece.
 * Formato: { name: 'Nombre', text: 'Comentario textual', source: 'Google / Instagram' }
 */
const REVIEWS = [];

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
