/* ==========================================================================
   BUENARDA · CAPA "NEÓN + LAB"  (wow.js)
   --------------------------------------------------------------------------
   Capa 100% aditiva. No toca app.js, styles.css ni menu-data.js: solo lee el
   DOM y los datos globales (SITE, MENU_ITEMS) y agrega elementos nuevos.
   Si algo falla, cada función está aislada y la web sigue funcionando igual.
   Para quitarla: borrá <link href="wow.css"> y <script src="wow.js"> del HTML.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var fine = mq('(hover: hover) and (pointer: fine)');
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var safe = function (fn) { try { fn(); } catch (e) { if (window.console) console.warn('[wow]', e); } };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var site = function () { return (typeof SITE !== 'undefined' && SITE) ? SITE : {}; };
  var money = function (n) {
    return '$' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  /* ------------------------------------------------------------------ *
   *  Sonido (opcional, apagado por defecto) + vibración
   * ------------------------------------------------------------------ */
  var soundOn = store.get('wow-sound') === '1';
  var actx = null;
  function audio() {
    if (!actx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      actx = new C();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function sizzle() {
    if (!soundOn) return;
    safe(function () {
      var c = audio();
      if (!c) return;
      var dur = 0.9, n = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) {
        var crackle = Math.random() < 0.012 ? 1 : 0;
        d[i] = ((Math.random() * 2 - 1) * 0.22 + (Math.random() * 2 - 1) * crackle) * (1 - i / n);
      }
      var src = c.createBufferSource(); src.buffer = buf;
      var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2800;
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.22, c.currentTime + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      src.connect(hp); hp.connect(g); g.connect(c.destination);
      src.start();
      ding(c);
    });
  }
  function ding(c) {
    [1318.5, 1975.5].forEach(function (f, i) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      var t = c.currentTime + 0.05 + i * 0.07;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.55);
    });
  }
  function buzz(ms) {
    if (soundOn && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  /* ------------------------------------------------------------------ *
   *  Reveal propio para lo inyectado (el de la web solo ve lo existente)
   * ------------------------------------------------------------------ */
  var revealIO = null;
  function reveal(el) {
    el.classList.add('wow-reveal');
    if (!('IntersectionObserver' in window)) { el.classList.add('is-in'); return; }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
        });
      }, { threshold: 0.12 });
    }
    revealIO.observe(el);
  }

  /* ------------------------------------------------------------------ *
   *  Catálogo leído del DOM (con respaldo en MENU_ITEMS)
   * ------------------------------------------------------------------ */
  var cache = {};
  var cacheSize = 0;
  function txt(sel, root) { var n = $(sel, root); return n ? n.textContent.trim() : ''; }
  function isFullView() {
    var act = $('#filterTabs .filter-tab.is-active');
    var q = $('#menuSearchInput');
    return (!act || act.getAttribute('data-filter') === 'all') && (!q || !q.value);
  }
  function scan() {
    var cards = $$('#menuGrid .burger-card');
    if (!cards.length) return;
    if (isFullView()) { cache = {}; cacheSize = 0; }
    cards.forEach(function (card) {
      var id = card.getAttribute('data-card-id');
      if (!id) return;
      var svg = $('.burger-svg', card);
      var ph = $('.item-photo:not(.item-photo--cut)', card);
      var svgStr = svg ? svg.outerHTML : (ph && ph.dataset && ph.dataset.fallback ? ph.dataset.fallback : '');
      if (!cache[id]) cacheSize++;
      cache[id] = {
        id: id,
        name: txt('.burger-card__title', card),
        ingredients: txt('.burger-card__ingredients', card),
        price: txt('.burger-card__price', card),
        photo: ph ? ph.getAttribute('src') : '',
        svg: svgStr,
        soldOut: card.classList.contains('is-sold-out'),
        isBurger: !!$('.smash-burst', card)
      };
    });
  }
  function catalog() {
    if (cacheSize > 0) return Object.keys(cache).map(function (k) { return cache[k]; });
    var base = (typeof MENU_ITEMS !== 'undefined' && Array.isArray(MENU_ITEMS)) ? MENU_ITEMS : [];
    return base.map(function (i) {
      return {
        id: i.id, name: i.name, ingredients: i.ingredients || '',
        price: money(i.price), svg: '', soldOut: false, isBurger: !!i.isBurger
      };
    });
  }

  /* ------------------------------------------------------------------ *
   *  1) Cartel de neón en vivo
   * ------------------------------------------------------------------ */
  var neonEl = null, countEl = null;

  function clock() {
    var tz = site().timeZone || 'America/Argentina/Buenos_Aires';
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).formatToParts(new Date());
      var m = {};
      parts.forEach(function (p) { m[p.type] = p.value; });
      var dm = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { day: dm[m.weekday], h: Number(m.hour) % 24, m: Number(m.minute), s: Number(m.second) };
    } catch (e) {
      var n = new Date();
      return { day: n.getDay(), h: n.getHours(), m: n.getMinutes(), s: n.getSeconds() };
    }
  }
  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(h) { return pad(h % 24) + ':00'; }
  function fmt(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  /* Devuelve { open, secs, note } según SITE.hours, o null si no es calculable */
  function schedule() {
    var hrs = site().hours || {};
    var days = Array.isArray(hrs.openDays) ? hrs.openDays : [3, 4, 5, 6, 0];
    var o = Number(hrs.open), c = Number(hrs.close);
    if (isNaN(o)) o = 20;
    if (isNaN(c) || hrs.close === '' || hrs.close == null) c = 24;
    if (!(c > o)) return null; // horarios que cruzan medianoche: no se calcula
    var k = clock();
    var now = k.h * 3600 + k.m * 60 + k.s;
    var open = days.indexOf(k.day) !== -1 && now >= o * 3600 && now < c * 3600;
    if (open) return { open: true, secs: c * 3600 - now, note: 'Cerramos a las ' + hhmm(c) + ' hs' };
    for (var d = 0; d <= 7; d++) {
      var dd = (k.day + d) % 7;
      if (days.indexOf(dd) === -1) continue;
      var secs = d * 86400 + o * 3600 - now;
      if (secs <= 0) continue;
      var when = d === 0 ? 'hoy' : d === 1 ? 'mañana' : 'el ' + DAYS[dd];
      return { open: false, secs: secs, note: 'Abrimos ' + when + ' a las ' + hhmm(o) + ' hs' };
    }
    return null;
  }

  function tickNeon() {
    if (!neonEl) return;
    var dot = $('#openStatusDot');
    var domOpen = dot ? dot.classList.contains('is-open') : null;
    var domClosed = dot ? dot.classList.contains('is-closed') : null;
    var state = domOpen ? 'open' : domClosed ? 'closed' : null;
    var sc = schedule();
    if (!state && sc) state = sc.open ? 'open' : 'closed';
    if (!state) state = 'closed';
    if (neonEl.getAttribute('data-state') !== state) {
      neonEl.setAttribute('data-state', state);
      var b = $('[data-wow="state"]', neonEl);
      if (b) b.textContent = state === 'open' ? 'ABIERTO' : 'CERRADO';
      document.documentElement.setAttribute('data-wow-open', state === 'open' ? '1' : '0');
    }
    if (countEl) {
      // Si Google Sheets cambió el horario y no coincide con el del respaldo, no mostramos la cuenta
      var coherent = sc && ((sc.open && state === 'open') || (!sc.open && state === 'closed'));
      if (coherent) {
        countEl.hidden = false;
        countEl.innerHTML = (sc.open ? 'CIERRA EN ' : 'ABRIMOS EN ') + fmt(sc.secs) +
          '<small>' + esc(sc.note) + '</small>';
      } else {
        countEl.hidden = true;
      }
    }
  }

  function buildNeon() {
    var host = $('.hero__content');
    var anchor = $('.hero__eyebrow', host || document);
    if (!host || !anchor) return;
    var name = (site().brand && site().brand.name) || 'BUENARDA';
    var letters = String(name).toUpperCase().split('').map(function (ch) {
      return '<span>' + (ch === ' ' ? '&nbsp;' : esc(ch)) + '</span>';
    }).join('');
    var wrap = document.createElement('div');
    wrap.className = 'wow-neon-wrap';
    wrap.innerHTML =
      '<div class="wow-neon" data-state="closed" aria-hidden="true">' +
      '<span class="wow-neon__brand">' + letters + '</span>' +
      '<span class="wow-neon__state"><i></i><b data-wow="state">CERRADO</b></span>' +
      '</div>' +
      '<div class="wow-neon__meta"><div class="wow-count" data-wow="count" hidden></div></div>' +
      '<button type="button" class="wow-toggle" aria-pressed="' + (soundOn ? 'true' : 'false') + '">' +
      '<span data-wow="ticon">' + (soundOn ? '🔊' : '🔇') + '</span> Sonido y vibración</button>';
    host.insertBefore(wrap, anchor);
    neonEl = $('.wow-neon', wrap);
    countEl = $('[data-wow="count"]', wrap);
    var tg = $('.wow-toggle', wrap);
    tg.addEventListener('click', function () {
      soundOn = !soundOn;
      store.set('wow-sound', soundOn ? '1' : '0');
      tg.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      $('[data-wow="ticon"]', tg).textContent = soundOn ? '🔊' : '🔇';
      if (soundOn) { sizzle(); buzz(20); }
    });
    tickNeon();
    setInterval(tickNeon, 1000);
    // Reacciona enseguida si la web cambia el estado (p. ej. tras sincronizar Sheets)
    var dot = $('#openStatusDot');
    if (dot && 'MutationObserver' in window) {
      new MutationObserver(tickNeon).observe(dot, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ------------------------------------------------------------------ *
   *  2) Luz de cursor + 3) Tilt/brillo en tarjetas
   * ------------------------------------------------------------------ */
  function cursorLight() {
    if (!fine || reduce) return;
    var l = document.createElement('div');
    l.className = 'wow-light';
    l.setAttribute('aria-hidden', 'true');
    document.body.appendChild(l);
    var x = 0, y = 0, raf = 0;
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        l.style.setProperty('--lx', x + 'px');
        l.style.setProperty('--ly', y + 'px');
        l.classList.add('is-on');
      });
    }, { passive: true });
    document.addEventListener('mouseleave', function () { l.classList.remove('is-on'); });
  }

  function tilt() {
    var grid = $('#menuGrid');
    if (!grid || !fine || reduce) return;
    var cur = null;
    function reset(v) {
      if (!v) return;
      v.style.transform = '';
      v.style.setProperty('--wo', '0');
      v.classList.remove('is-tilting');
    }
    grid.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var card = e.target.closest ? e.target.closest('.burger-card') : null;
      if (!card || card.classList.contains('is-sold-out')) { reset(cur); cur = null; return; }
      var v = $('.burger-card__visual', card);
      if (!v) return;
      if (cur && cur !== v) reset(cur);
      cur = v;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      var vr = v.getBoundingClientRect();
      v.classList.add('is-tilting');
      v.style.transform = 'perspective(700px) rotateX(' + ((0.5 - py) * 12).toFixed(2) + 'deg) rotateY(' +
        ((px - 0.5) * 16).toFixed(2) + 'deg)';
      v.style.setProperty('--wx', (((e.clientX - vr.left) / vr.width) * 100).toFixed(1) + '%');
      v.style.setProperty('--wy', (((e.clientY - vr.top) / vr.height) * 100).toFixed(1) + '%');
      v.style.setProperty('--wo', '1');
    });
    grid.addEventListener('pointerleave', function () { reset(cur); cur = null; });
  }

  /* ------------------------------------------------------------------ *
   *  4) Migas de cheddar + sonido al agregar
   * ------------------------------------------------------------------ */
  var proxyClick = false;
  var COLORS = ['#F5B700', '#ffd45a', '#c97a2b', '#dea04c', '#e5484d', '#fff3c4'];
  function burst(x, y) {
    if (reduce || !document.body.animate) return;
    for (var i = 0; i < 16; i++) {
      var s = document.createElement('i');
      s.className = 'wow-crumb';
      var size = 4 + Math.random() * 6;
      s.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + size +
        'px;background:' + COLORS[(Math.random() * COLORS.length) | 0];
      document.body.appendChild(s);
      var a = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 1.5;
      var dist = 45 + Math.random() * 80;
      var dx = Math.cos(a) * dist, dy = Math.sin(a) * dist;
      var an = s.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: 'translate(' + (dx - size / 2) + 'px,' + (dy + 46) + 'px) rotate(' +
            ((Math.random() * 360) | 0) + 'deg) scale(.25)', opacity: 0 }
      ], { duration: 560 + Math.random() * 380, easing: 'cubic-bezier(.2,.8,.3,1)' });
      an.onfinish = (function (n) { return function () { n.remove(); }; })(s);
    }
  }
  function addFeedback() {
    document.addEventListener('click', function (e) {
      if (proxyClick) return;
      var b = e.target.closest ? e.target.closest('[data-add-id], #addHeroBurgerBtn, #addPromoBtn') : null;
      if (!b || b.disabled) return;
      var r = b.getBoundingClientRect();
      if (r.width) burst(r.left + r.width / 2, r.top + r.height / 2);
      sizzle(); buzz(18);
    });
  }

  /* ------------------------------------------------------------------ *
   *  5) Barra de progreso con mini burger
   * ------------------------------------------------------------------ */
  function progress() {
    var bar = document.createElement('div');
    bar.className = 'wow-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<div class="wow-progress__bar"></div>' +
      '<svg class="wow-progress__burger" viewBox="0 0 260 190"><ellipse cx="130" cy="174" rx="84" ry="10" fill="rgba(0,0,0,.4)"/>' +
      '<path d="M56 144 Q56 164 130 164 Q204 164 204 144 Z" fill="#c97a2b"/>' +
      '<rect x="52" y="118" width="156" height="22" rx="10" fill="#4a2514"/>' +
      '<path d="M56 118 L204 118 L194 134 L176 122 L156 136 L130 122 L104 135 L82 122 L64 133 Z" fill="#F5B700"/>' +
      '<path d="M50 118 Q50 56 130 56 Q210 56 210 118 Z" fill="#dea04c"/></svg>';
    document.body.appendChild(bar);
    var raf = 0;
    function upd() {
      raf = 0;
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, (window.pageYOffset || h.scrollTop) / max)) : 0;
      bar.style.setProperty('--wow-p', p.toFixed(4));
    }
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    window.addEventListener('resize', upd);
    upd();
  }

  /* ------------------------------------------------------------------ *
   *  6) BUENARDA LAB · ¿Qué burger sos?
   * ------------------------------------------------------------------ */
  var QUESTIONS = [
    { q: '¿Cómo arranca tu noche?', o: [
      ['🛋️', 'Sofá, manta y serie', { classic: 2, egg: 1 }],
      ['🎉', 'Previa con amigos', { bacon: 2, loaded: 1 }],
      ['💘', 'Cita: hay que impresionar', { sweet: 2, smoky: 1 }],
      ['🎮', 'Maratón de juegos hasta tarde', { crispy: 2, smoky: 1 }]
    ] },
    { q: '¿Qué textura te enamora?', o: [
      ['🔊', 'Crocante, que se escuche', { crispy: 3 }],
      ['🧀', 'Cremosa y fundida', { provolone: 2, egg: 1, classic: 1 }],
      ['🥬', 'Con frescura y de todo un poco', { fresh: 3 }]
    ] },
    { q: 'Elegí tu sabor', o: [
      ['🧅', 'Dulce y caramelizado', { sweet: 3 }],
      ['🔥', 'Ahumado y profundo', { smoky: 3 }],
      ['🥒', 'Fresco y equilibrado', { fresh: 3 }],
      ['🍔', 'Clásico de toda la vida', { classic: 3 }]
    ] },
    { q: '¿Cuánta hambre traés?', o: [
      ['🙂', 'Normal: quiero comer rico', { classic: 1, fresh: 1 }],
      ['😋', 'Bastante', { bacon: 2, loaded: 1 }],
      ['🦖', 'Hambre de cancha', { loaded: 2, egg: 1, bacon: 1 }],
      ['🏆', 'Que sea un hito', { egg: 2, bacon: 1, smoky: 1 }]
    ] }
  ];
  var TRAIT_LABEL = {
    crispy: 'CROCANTE', bacon: 'BACON', smoky: 'AHUMADA', sweet: 'DULCE', egg: 'CON HUEVO',
    fresh: 'FRESCA', classic: 'CLÁSICA', provolone: 'PROVOLONE', loaded: 'CARGADA'
  };
  var TRAIT_LINE = {
    crispy: 'Tu noche pide crunch en cada mordida.',
    sweet: 'Lo tuyo es el dulzor que se pone de acuerdo con la carne.',
    smoky: 'Sos de sabores profundos y con carácter.',
    egg: 'Vos sabés que el huevo lo cambia todo.',
    bacon: 'Para vos, el bacon nunca sobra.',
    fresh: 'Te gusta el equilibrio: frescura y jugo en la misma mordida.',
    provolone: 'Cremosidad ante todo.',
    loaded: 'Venís con hambre y la carta lo sabe.',
    classic: 'Los clásicos son clásicos por algo.'
  };

  function traitsOf(it) {
    var t = (it.name + ' ' + it.ingredients).toUpperCase();
    var tr = [];
    if (/CRISPY|CROCANT/.test(t)) tr.push('crispy');
    if (/BACON/.test(t)) tr.push('bacon');
    if (/AHUMAD|SMOKED|BARBACOA|BBQ/.test(t)) tr.push('smoky');
    if (/CARAMEL|DULCE/.test(t)) tr.push('sweet');
    if (/HUEVO/.test(t)) tr.push('egg');
    if (/LECHUGA|TOMATE|PEPINILLO|FRESCA/.test(t)) tr.push('fresh');
    if (/PROVOLONE/.test(t)) tr.push('provolone');
    var count = String(it.ingredients || '').split(',').length;
    if (count >= 7 || (tr.indexOf('bacon') > -1 && tr.indexOf('egg') > -1)) tr.push('loaded');
    if (!/BACON|HUEVO|CRISPY|CARAMEL/.test(t)) tr.push('classic');
    return tr;
  }

  var lab = { step: 0, scores: {}, result: null, shareBlob: null, shareUrl: null };

  function buildLab() {
    var anchor = $('#calidad');
    if (!anchor || !anchor.parentNode || $('#lab')) return;
    var sec = document.createElement('section');
    sec.className = 'wow-lab';
    sec.id = 'lab';
    sec.setAttribute('aria-labelledby', 'labTitle');
    sec.innerHTML =
      '<div class="container">' +
      '<div class="section-header wow-head">' +
      '<span class="section-eyebrow">BUENARDA LAB</span>' +
      '<h2 class="section-title" id="labTitle">¿QUÉ BURGER <span class="text-cheddar">SOS</span>?</h2>' +
      '<p class="section-subtitle">Cuatro preguntas, cero vueltas. Te decimos cuál de la carta es tu match y te armamos una tarjeta para compartir.</p>' +
      '</div>' +
      '<div class="wow-stage" id="labStage"><div class="wow-steps" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
      '<div id="labBody" aria-live="polite"></div></div>' +
      '</div>';
    anchor.parentNode.insertBefore(sec, anchor);
    reveal($('.wow-head', sec));
    reveal($('.wow-stage', sec));
    renderLab();
    sec.addEventListener('click', onLabClick);
    document.addEventListener('keydown', function (e) {
      if (lab.step < 1 || lab.step > QUESTIONS.length) return;
      if (!sec.contains(document.activeElement)) return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= QUESTIONS[lab.step - 1].o.length) { e.preventDefault(); answer(n - 1); }
    });
    // Botón extra en el hero, hacia el Lab
    var cta = $('.hero__cta');
    if (cta && !$('.wow-hero-cta', cta)) {
      var a = document.createElement('a');
      a.href = '#lab';
      a.className = 'btn btn--ghost wow-hero-cta';
      a.textContent = '🔥 ¿Qué burger sos?';
      cta.appendChild(a);
    }
  }

  function setSteps() {
    var done = lab.step === 0 ? 0 : lab.step > QUESTIONS.length ? QUESTIONS.length : lab.step - 1;
    $$('#labStage .wow-steps i').forEach(function (i, idx) {
      i.classList.toggle('is-done', idx < done);
    });
  }

  function renderLab() {
    var body = $('#labBody');
    if (!body) return;
    setSteps();
    var h = '';
    if (lab.step === 0) {
      h = '<div class="wow-view wow-intro"><div class="wow-intro__orb" aria-hidden="true">🍔</div>' +
        '<p>Respondé sin pensar: tu instinto ya sabe qué querés comer. Al final te mostramos tu burger con una tarjeta lista para subir a tus historias.</p>' +
        '<button type="button" class="btn btn--primary" data-wow-act="start">Empezar el test</button></div>';
    } else if (lab.step <= QUESTIONS.length) {
      var q = QUESTIONS[lab.step - 1];
      h = '<div class="wow-view"><div class="wow-q__count">PREGUNTA ' + lab.step + ' DE ' + QUESTIONS.length + '</div>' +
        '<h3 class="wow-q__title">' + esc(q.q) + '</h3><div class="wow-opts">' +
        q.o.map(function (o, i) {
          return '<button type="button" class="wow-opt" data-wow-ans="' + i + '"><span class="wow-opt__emoji" aria-hidden="true">' +
            o[0] + '</span><span>' + esc(o[1]) + '</span><kbd aria-hidden="true">' + (i + 1) + '</kbd></button>';
        }).join('') + '</div></div>';
    } else if (lab.step === 99) {
      h = '<div class="wow-view wow-scan"><div class="wow-scan__ring"></div><div class="wow-scan__txt" id="labScan">Analizando tu ADN burger…</div></div>';
    } else {
      h = resultHTML();
    }
    body.innerHTML = h;
    var f = $('[data-wow-act="start"], .wow-opt, [data-wow-act="again"]', body);
    if (f && lab.step !== 0 && lab.step !== 99) { try { f.focus({ preventScroll: true }); } catch (e) {} }
  }

  function onLabClick(e) {
    var ans = e.target.closest('[data-wow-ans]');
    if (ans) { answer(parseInt(ans.getAttribute('data-wow-ans'), 10)); return; }
    var act = e.target.closest('[data-wow-act]');
    if (!act) return;
    var a = act.getAttribute('data-wow-act');
    if (a === 'start') { lab.step = 1; lab.scores = {}; renderLab(); }
    else if (a === 'again') { lab.step = 0; lab.result = null; releaseShare(); renderLab(); }
    else if (a === 'add') { addToOrder(act); }
    else if (a === 'share') { share(); }
    else if (a === 'download') { download(); }
  }

  function answer(i) {
    var q = QUESTIONS[lab.step - 1];
    if (!q || !q.o[i]) return;
    var w = q.o[i][2];
    Object.keys(w).forEach(function (k) { lab.scores[k] = (lab.scores[k] || 0) + w[k]; });
    buzz(10);
    if (lab.step < QUESTIONS.length) { lab.step++; renderLab(); return; }
    lab.step = 99;
    renderLab();
    var msgs = ['Midiendo crocancia…', 'Pesando queso cheddar…', 'Cruzando con la carta de hoy…'];
    var k = 0, el = $('#labScan');
    var iv = setInterval(function () { if (el && msgs[k]) el.textContent = msgs[k]; k++; }, reduce ? 150 : 520);
    setTimeout(function () {
      clearInterval(iv);
      lab.result = recommend();
      lab.step = QUESTIONS.length + 1;
      renderLab();
      if (lab.result) makeCard(lab.result);
    }, reduce ? 500 : 1700);
  }

  function recommend() {
    scan();
    var all = catalog().filter(function (i) { return i.isBurger; });
    var pool = all.filter(function (i) { return !i.soldOut; });
    if (!pool.length) pool = all;
    var best = null;
    pool.forEach(function (it, idx) {
      var tr = traitsOf(it), s = 0;
      tr.forEach(function (t) { s += lab.scores[t] || 0; });
      s -= idx * 0.001;
      if (!best || s > best.s) best = { it: it, s: s, tr: tr };
    });
    if (!best) return null;
    var matched = best.tr.filter(function (t) { return lab.scores[t]; })
      .sort(function (a, b) { return (lab.scores[b] || 0) - (lab.scores[a] || 0); });
    var show = (matched.length ? matched : best.tr).slice(0, 3);
    return { item: best.it, traits: show, line: TRAIT_LINE[show[0]] || 'Tu noche tiene sabor a Buenarda.' };
  }

  function resultHTML() {
    var r = lab.result;
    if (!r) {
      return '<div class="wow-view wow-scan"><div class="wow-scan__txt">No pudimos leer la carta en este momento. Probá de nuevo en unos segundos.</div>' +
        '<button type="button" class="btn btn--ghost" data-wow-act="again">Reintentar</button></div>';
    }
    var it = r.item;
    return '<div class="wow-view wow-res">' +
      '<div class="wow-card wow-card--loading" id="labCard" aria-label="Tarjeta con tu resultado"></div>' +
      '<div><div class="wow-res__eyebrow">TU MATCH ES</div>' +
      '<h3 class="wow-res__name">' + esc(it.name) + '</h3>' +
      '<p class="wow-res__line">' + esc(r.line) + '</p>' +
      '<div class="wow-chips">' + r.traits.map(function (t) { return '<span class="wow-chip">' + TRAIT_LABEL[t] + '</span>'; }).join('') + '</div>' +
      (it.ingredients ? '<p class="wow-res__ing">' + esc(it.ingredients) + '</p>' : '') +
      (it.price ? '<div class="wow-res__price">' + esc(it.price) + '</div>' : '') +
      '<div class="wow-actions">' +
      '<button type="button" class="btn btn--primary" data-wow-act="add">+ Agregar al pedido</button>' +
      '<button type="button" class="btn btn--ghost" data-wow-act="share">Compartir mi tarjeta</button>' +
      '<button type="button" class="btn btn--ghost" data-wow-act="download">Descargar</button>' +
      '</div><button type="button" class="wow-again" data-wow-act="again">Volver a hacer el test</button></div></div>';
  }

  /* Agrega la burger usando el propio botón de la carta (misma lógica de pedido) */
  function addToOrder(btn) {
    var r = lab.result;
    if (!r) return;
    var grid = $('#menuGrid');
    if (!grid) return;
    var id = r.item.id;
    var tmp = document.createElement('button');
    tmp.type = 'button';
    tmp.setAttribute('data-add-id', id);
    tmp.hidden = true;
    grid.appendChild(tmp);
    proxyClick = true;
    try { tmp.click(); } finally { proxyClick = false; tmp.remove(); }
    var rc = btn.getBoundingClientRect();
    burst(rc.left + rc.width / 2, rc.top + rc.height / 2);
    sizzle(); buzz(18);
  }

  /* ---- Tarjeta para compartir (canvas → PNG) ---- */
  function releaseShare() {
    if (lab.shareUrl) { try { URL.revokeObjectURL(lab.shareUrl); } catch (e) {} }
    lab.shareBlob = null; lab.shareUrl = null;
  }
  function loadSvgImage(svgStr) {
    return new Promise(function (res) {
      if (!svgStr) return res(null);
      if (!/xmlns=/.test(svgStr)) svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      if (!/ width=/.test(svgStr.slice(0, 120))) svgStr = svgStr.replace('<svg', '<svg width="520" height="380"');
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { res(null); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    });
  }
  function fitFont(ctx, text, maxW, start, family) {
    var s = start;
    ctx.font = s + 'px ' + family;
    while (ctx.measureText(text).width > maxW && s > 40) { s -= 4; ctx.font = s + 'px ' + family; }
    return s;
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCard(r, img, isPhoto) {
    var W = 1080, H = 1920;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    var F = "'Bebas Neue', Impact, 'Arial Narrow', sans-serif";
    var S = "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";
    var brand = (site().brand && site().brand.name) || 'BUENARDA';
    var handle = (site().brand && site().brand.handle) || '@buenardaparana';
    var street = (site().brand && site().brand.shortAddress) || 'Colón 696 — Paraná';
    var hours = (site().hours && site().hours.label) || '';

    // fondo
    c.fillStyle = '#0d0d0d'; c.fillRect(0, 0, W, H);
    var g = c.createRadialGradient(W / 2, 880, 40, W / 2, 880, 900);
    g.addColorStop(0, 'rgba(245,183,0,0.30)'); g.addColorStop(1, 'rgba(245,183,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,0.045)'; c.lineWidth = 2;
    for (var x = 0; x <= W; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (var y = 0; y <= H; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

    // marco neón
    c.save();
    c.strokeStyle = '#F5B700'; c.lineWidth = 6;
    c.shadowColor = '#F5B700'; c.shadowBlur = 34;
    rr(c, 54, 54, W - 108, H - 108, 46); c.stroke();
    c.restore();

    c.textAlign = 'center'; c.textBaseline = 'alphabetic';

    // marca
    c.save();
    c.fillStyle = '#fff3c4'; c.shadowColor = '#F5B700'; c.shadowBlur = 30;
    var bs = fitFont(c, String(brand).toUpperCase(), 760, 190, F);
    c.fillText(String(brand).toUpperCase(), W / 2, 270);
    c.restore();
    c.fillStyle = '#F5B700'; c.font = '800 34px ' + S;
    if ('letterSpacing' in c) c.letterSpacing = '10px';
    c.fillText('BURGER LAB', W / 2, 336);
    if ('letterSpacing' in c) c.letterSpacing = '0px';

    // subtítulo
    c.fillStyle = '#a6a6a2'; c.font = '700 44px ' + S;
    c.fillText('MI MATCH ES', W / 2, 520);

    // burger
    if (img && isPhoto) {
      var bw = 880, bh = 600, bx = (W - bw) / 2, by = 560;
      var sc = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
      var sw = bw / sc, sh = bh / sc;
      c.save();
      c.shadowColor = 'rgba(245,183,0,0.5)'; c.shadowBlur = 70;
      rr(c, bx, by, bw, bh, 36); c.fillStyle = '#000'; c.fill();
      c.restore();
      c.save();
      rr(c, bx, by, bw, bh, 36); c.clip();
      c.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, bx, by, bw, bh);
      c.restore();
      c.save(); c.strokeStyle = 'rgba(245,183,0,0.8)'; c.lineWidth = 4; rr(c, bx, by, bw, bh, 36); c.stroke(); c.restore();
    } else if (img) {
      c.save();
      c.shadowColor = 'rgba(245,183,0,0.55)'; c.shadowBlur = 80;
      c.drawImage(img, W / 2 - 400, 560, 800, 585);
      c.restore();
    } else {
      c.font = '420px serif'; c.fillText('🍔', W / 2, 1000);
    }

    // nombre
    c.save();
    c.fillStyle = '#ffffff'; c.shadowColor = 'rgba(245,183,0,0.6)'; c.shadowBlur = 36;
    var name = String(r.item.name || '').toUpperCase();
    var ns = fitFont(c, name, 880, 230, F);
    c.fillText(name, W / 2, 1290);
    c.restore();

    // rasgos
    var chips = r.traits.map(function (t) { return TRAIT_LABEL[t]; });
    c.font = '800 36px ' + S;
    var gap = 22, pad = 34, widths = chips.map(function (t) { return c.measureText(t).width + pad * 2; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + gap * (chips.length - 1);
    var cx = (W - total) / 2;
    chips.forEach(function (t, i) {
      c.fillStyle = 'rgba(245,183,0,0.14)'; c.strokeStyle = 'rgba(245,183,0,0.7)'; c.lineWidth = 3;
      rr(c, cx, 1360, widths[i], 76, 38); c.fill(); c.stroke();
      c.fillStyle = '#F5B700'; c.textAlign = 'center';
      c.fillText(t, cx + widths[i] / 2, 1410);
      cx += widths[i] + gap;
    });

    // frase
    c.fillStyle = '#e8e8e4'; c.font = '600 44px ' + S; c.textAlign = 'center';
    c.fillText('¿Y vos cuál sos?', W / 2, 1565);

    // pie
    c.fillStyle = '#F5B700'; c.font = '800 48px ' + S;
    c.fillText(handle, W / 2, 1700);
    c.fillStyle = '#a6a6a2'; c.font = '600 36px ' + S;
    c.fillText(street, W / 2, 1758);
    if (hours) c.fillText(hours, W / 2, 1808);
    return cv;
  }

  function loadPhoto(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { res(null); };
      img.src = src;
    });
  }
  function toBlobSafe(cv) {
    return new Promise(function (res) {
      try { cv.toBlob(function (b) { res(b || null); }, 'image/png'); } catch (e) { res(null); }
    });
  }
  function makeCard(r) {
    var box = $('#labCard');
    var fontP = (document.fonts && document.fonts.load)
      ? Promise.all([document.fonts.load("200px 'Bebas Neue'"), document.fonts.load("700 40px 'Plus Jakarta Sans'")]).catch(function () {})
      : Promise.resolve();
    var photoSrc = r.item.photo || ('assets/burgers/' + r.item.id + '.jpg');
    Promise.all([loadPhoto(photoSrc), loadSvgImage(r.item.svg), fontP]).then(function (v) {
      var photo = v[0], svgImg = v[1];
      var first = photo ? toBlobSafe(drawCard(r, photo, true)) : Promise.resolve(null);
      return first.then(function (b) { return b || toBlobSafe(drawCard(r, svgImg, false)); });
    }).then(function (blob) {
      if (!blob || lab.result !== r) { if (box) box.classList.remove('wow-card--loading'); return; }
      releaseShare();
      lab.shareBlob = blob;
      lab.shareUrl = URL.createObjectURL(blob);
      var holder = $('#labCard');
      if (!holder) return;
      holder.classList.remove('wow-card--loading');
      holder.innerHTML = '<img alt="Tarjeta: mi burger en Buenarda es ' + esc(r.item.name) + '" src="' + lab.shareUrl + '">';
    }).catch(function (e) {
      if (box) box.classList.remove('wow-card--loading');
      if (window.console) console.warn('[wow] tarjeta', e);
    });
  }

  function shareText() {
    var r = lab.result;
    var url = '';
    if (/^https?:/.test(location.protocol)) url = ' ' + location.href.split('#')[0] + '#lab';
    return 'Me salió ' + (r ? r.item.name : 'una Buenarda') + ' en el Burger Lab de Buenarda 🍔 ¿Y a vos?' + url;
  }
  function download() {
    if (!lab.shareUrl) return;
    var a = document.createElement('a');
    a.href = lab.shareUrl;
    a.download = 'buenarda-mi-burger.png';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function share() {
    if (!lab.shareBlob) return;
    var file = null;
    try { file = new File([lab.shareBlob], 'buenarda-mi-burger.png', { type: 'image/png' }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      navigator.share({ files: [file], text: shareText() }).catch(function () {});
      return;
    }
    // Sin compartir de archivos (escritorio): descarga + WhatsApp con texto
    download();
    var wa = 'https://wa.me/?text=' + encodeURIComponent(shareText());
    var w = window.open(wa, '_blank', 'noopener');
    if (!w && window.console) console.info('[wow] popup bloqueado');
  }

  /* ------------------------------------------------------------------ *
   *  7) Promos en efectivo (se suman al carrito existente)
   * ------------------------------------------------------------------ */
  var CASH_ONLY = ['promo-ef-x2-cheese', 'promo-ef-triple'];
  var CASH_TRANSF = ['promo-ef-combo-x4', 'promo-ef-x2-bacon', 'promo-ef-x2-crispy'];
  var PAY_CASH = 'Pago: solo contado efectivo';
  var PAY_CT = 'Pago: contado efectivo / transferencia';
  var CASH_PROMOS = [
    { img: 'assets/promos/promo-combo-x4.jpg', tag: 'EFECTIVO / TRANSFERENCIA', title: 'COMBO BACON CHEESE BURGER',
      sub: 'Incluyen papas fritas.', alt: 'Flyer: combo de 4 Bacon Cheese Burger con papas fritas, $52.000',
      opts: [{ id: 'promo-ef-combo-x4', label: 'Combo x4', price: 52000, name: 'COMBO x4 BACON CHEESE BURGER + PAPAS', note: PAY_CT }] },
    { img: 'assets/promos/promo-x2-bacon-crispy.jpg', tag: 'EFECTIVO / TRANSFERENCIA', title: 'X2 BACON CHEESE · X2 CRISPY BACON',
      sub: 'Incluyen papas fritas.', alt: 'Flyer: X2 Bacon Cheese $28.000 y X2 Crispy Bacon $30.000, incluyen papas fritas',
      opts: [
        { id: 'promo-ef-x2-bacon', label: 'X2 Bacon Cheese', price: 28000, name: 'PROMO X2 BACON CHEESE + PAPAS', note: PAY_CT },
        { id: 'promo-ef-x2-crispy', label: 'X2 Crispy Bacon', price: 30000, name: 'PROMO X2 CRISPY BACON + PAPAS', note: PAY_CT }
      ] },
    { img: 'assets/promos/promo-x2-cheese.jpg', tag: 'SOLO EFECTIVO', title: 'X2 CHEESE BURGER',
      sub: 'Incluyen papas fritas. Contado efectivo.', alt: 'Flyer: X2 Cheese Burger con papas fritas, $25.000, contado efectivo',
      opts: [{ id: 'promo-ef-x2-cheese', label: 'X2 Cheese Burger', price: 25000, name: 'PROMO X2 CHEESE BURGER + PAPAS', note: PAY_CASH }] },
    { img: 'assets/promos/promo-triple-bacon.jpg', tag: 'SOLO EFECTIVO', title: 'TRIPLE BACON CHEESE',
      sub: 'Bacon Cheese Burger triple. Contado efectivo.', alt: 'Flyer: Triple Bacon Cheese, $15.000, contado efectivo',
      opts: [{ id: 'promo-ef-triple', label: 'Triple Bacon Cheese', price: 15000, name: 'TRIPLE BACON CHEESE', note: PAY_CASH }] }
  ];

  function buildCashPromos() {
    var anchor = $('#nightPromoCard');
    if (!anchor || !anchor.parentNode || $('#promosEfectivo')) return;
    var sec = document.createElement('section');
    sec.className = 'wow-promos';
    sec.id = 'promosEfectivo';
    sec.setAttribute('aria-labelledby', 'promosEfTitle');
    sec.innerHTML =
      '<div class="wow-promos__head"><span class="section-eyebrow">💵 PRECIOS ESPECIALES</span>' +
      '<h3 class="wow-promos__title" id="promosEfTitle">PROMOS <span class="text-cheddar">EN EFECTIVO</span></h3>' +
      '<p class="wow-promos__sub">Válidas con el medio de pago que indica cada promo.</p></div>' +
      '<div class="wow-promos__grid">' +
      CASH_PROMOS.map(function (p, pi) {
        return '<article class="wow-promo">' +
          '<button type="button" class="wow-promo__thumb" data-wow-zoom="' + pi + '" aria-label="Ver flyer de ' + esc(p.title) + ' en grande">' +
          '<img src="' + p.img + '" alt="' + esc(p.alt) + '" loading="lazy"></button>' +
          '<div class="wow-promo__body">' +
          '<span class="wow-promo__tag' + (p.tag === 'SOLO EFECTIVO' ? ' is-cash' : '') + '">💵 ' + p.tag + '</span>' +
          '<h4 class="wow-promo__name">' + esc(p.title) + '</h4>' +
          '<p class="wow-promo__desc">' + esc(p.sub) + '</p>' +
          '<div class="wow-promo__opts">' +
          p.opts.map(function (o, oi) {
            return '<div class="wow-promo__opt"><span class="wow-promo__label">' + esc(o.label) + '</span>' +
              '<strong class="wow-promo__price">' + money(o.price) + '</strong>' +
              '<button type="button" class="btn btn--primary wow-promo__add" data-wow-promo="' + pi + ':' + oi + '">+ Agregar</button></div>';
          }).join('') + '</div></div></article>';
      }).join('') + '</div>';
    anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    $$('.wow-promo', sec).forEach(reveal);
    reveal($('.wow-promos__head', sec));

    sec.addEventListener('click', function (e) {
      var z = e.target.closest('[data-wow-zoom]');
      if (z) { openLightbox(CASH_PROMOS[+z.getAttribute('data-wow-zoom')]); return; }
      var b = e.target.closest('[data-wow-promo]');
      if (!b) return;
      var ij = b.getAttribute('data-wow-promo').split(':');
      var o = CASH_PROMOS[+ij[0]].opts[+ij[1]];
      if (window.BuenardaCart && window.BuenardaCart.addCustom) {
        window.BuenardaCart.addCustom(o.id, o.name, o.price, o.note, b);
        var r = b.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2);
        sizzle(); buzz(18);
      } else {
        var t = $('#toast');
        if (t) { t.textContent = 'Pedí esta promo por WhatsApp o Instagram'; t.classList.add('is-visible'); setTimeout(function () { t.classList.remove('is-visible'); }, 2600); }
      }
    });
  }

  var lightbox = null;
  function openLightbox(p) {
    closeLightbox();
    lightbox = document.createElement('div');
    lightbox.className = 'wow-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', p.title);
    lightbox.innerHTML = '<button type="button" class="wow-lightbox__x" aria-label="Cerrar">✕</button><img src="' + p.img + '" alt="' + esc(p.alt) + '">';
    lightbox.addEventListener('click', closeLightbox);
    document.body.appendChild(lightbox);
    var x = $('.wow-lightbox__x', lightbox); if (x) x.focus();
  }
  function closeLightbox() { if (lightbox) { lightbox.remove(); lightbox = null; } }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });

  /* ------------------------------------------------------------------ *
   *  8) Aviso de ENVÍOS + control de medio de pago en el carrito
   * ------------------------------------------------------------------ */
  function cartNotes() {
    var toggle = $('.delivery-toggle');
    if (toggle && !$('.wow-ship')) {
      var d = document.createElement('div');
      d.className = 'wow-ship';
      d.setAttribute('role', 'note');
      d.innerHTML = '<span class="wow-ship__ico" aria-hidden="true">🛵</span><p><strong>ENVÍOS:</strong> Enviar ubicación, y <strong>ACLARAR</strong> si abona Justo o enviamos cambio, de lo contrario el importe se redondeará a favor del repartidor. <em>¡Muchas gracias por comprender!</em></p>';
      toggle.parentNode.insertBefore(d, toggle.nextSibling);
    }
    var pay = $('#paymentMethod');
    if (pay && !$('.wow-pay-warn')) {
      var w = document.createElement('div');
      w.className = 'wow-pay-warn';
      w.setAttribute('role', 'alert');
      w.hidden = true;
      pay.parentNode.insertBefore(w, pay.nextSibling);
      var check = function () {
        var ids = (window.BuenardaCart && window.BuenardaCart.ids) ? window.BuenardaCart.ids() : [];
        var hasCash = ids.some(function (i) { return CASH_ONLY.indexOf(i) > -1; });
        var hasCT = ids.some(function (i) { return CASH_TRANSF.indexOf(i) > -1; });
        var v = pay.value || '';
        var isCash = /^Efectivo/i.test(v), isTransf = /Transferencia/i.test(v);
        var msg = '';
        if (hasCash && !isCash) msg = '⚠️ Tu pedido tiene promos válidas solo con pago en efectivo. Elegí “Efectivo” o quitá esas promos.';
        else if (hasCT && !isCash && !isTransf) msg = '⚠️ Las promos de tu pedido valen con efectivo o transferencia, no con tarjeta.';
        w.textContent = msg;
        w.hidden = !msg;
      };
      pay.addEventListener('change', check);
      var cont = $('#cartItemsContainer');
      if (cont && 'MutationObserver' in window) new MutationObserver(check).observe(cont, { childList: true });
      check();
    }
  }


  /* ------------------------------------------------------------------ *
   *  Arranque
   * ------------------------------------------------------------------ */
  function init() {
    safe(scan);
    var grid = $('#menuGrid');
    if (grid && 'MutationObserver' in window) {
      var t = 0;
      new MutationObserver(function () {
        if (t) return;
        t = requestAnimationFrame(function () { t = 0; safe(scan); });
      }).observe(grid, { childList: true });
    }
    safe(buildNeon);
    safe(buildLab);
    safe(cursorLight);
    safe(tilt);
    safe(addFeedback);
    safe(progress);
    safe(buildCashPromos);
    safe(cartNotes);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
