'use strict';

// Una sola fuente de contenido para el editor y para las dos cuentas.
window.PageContent = (() => {
  const fields = {
    welcomeTitle: ['.welcome-title', 'Título de bienvenida', 'rich'],
    welcomeHint: ['.welcome-hint', 'Texto bajo el título'],
    welcomePrimary: ['.welcome-btn-primary .wbtn-label', 'Botón del recorrido'],
    welcomePrimarySub: ['.welcome-btn-primary .wbtn-sub', 'Descripción del recorrido'],
    welcomeSecondary: ['.welcome-btn-secondary .wbtn-label', 'Botón de acceso directo'],
    welcomeSecondarySub: ['.welcome-btn-secondary .wbtn-sub', 'Descripción del acceso directo'],
    welcomeNote: ['.welcome-note', 'Nota de bienvenida', 'rich'],
    lockTitle: ['.lock-title', 'Título del candado', 'rich'],
    lockSubtitle: ['.lock-subtitle', 'Subtítulo del candado', 'rich'],
    finalLetterTitle: ['.final-letter-title', 'Título de la carta final'],
    finalLetter: ['.final-letter-text', 'Carta final', 'rich'],
    letterTitle: ['#tab-carta .letter-title', 'Título de la carta principal', 'rich'],
    letterSubtitle: ['#tab-carta .letter-subtitle', 'Subtítulo de la carta principal'],
    letterIntro: ['.letter-intro', 'Carta principal', 'rich'],
    footerQuote: ['.footer-quote', 'Dedicatoria al pie', 'rich']
  };
  document.querySelectorAll('.hint-clue').forEach((el, i) => {
    el.dataset.editHint = i;
    fields['hint' + i] = [`[data-edit-hint="${i}"]`, `Pista ${i + 1}`, 'rich'];
  });

  const clone = value => JSON.parse(JSON.stringify(value));
  const safeURL = (value, image = false) => {
    const text = String(value || '').trim();
    if (!text || /[\u0000-\u001f\\]/.test(text)) return '';
    try {
      const url = new URL(text, location.href);
      return ['https:', 'http:'].includes(url.protocol) || (!image && url.protocol === 'mailto:') ? text : '';
    } catch (_) { return ''; }
  };
  function sanitize(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html ?? '');
    template.content.querySelectorAll('script,style,iframe,object,embed,svg,math,form,input,button,textarea,template').forEach(el => el.remove());
    const allowed = new Set(['P','BR','DIV','SPAN','STRONG','B','EM','I','U','S','STRIKE','UL','OL','LI','BLOCKQUOTE','H2','H3','H4','A','HR']);
    [...template.content.querySelectorAll('*')].forEach(el => {
      if (!allowed.has(el.tagName)) { el.replaceWith(...el.childNodes); return; }
      const href = el.tagName === 'A' ? safeURL(el.getAttribute('href')) : '';
      const color = el.style.color;
      const align = el.style.textAlign;
      [...el.attributes].forEach(attr => el.removeAttribute(attr.name));
      if (color) el.style.color = color;
      if (['left','center','right','justify'].includes(align)) el.style.textAlign = align;
      if (href) { el.setAttribute('href', href); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
    });
    return template.innerHTML;
  }
  function defaults() {
    const textos = {};
    Object.entries(fields).forEach(([key, [selector,, type]]) => {
      const el = document.querySelector(selector);
      textos[key] = el ? (type === 'rich' ? el.innerHTML : el.textContent) : '';
    });
    return {
      textos, pin: window.CONFIG.PIN, skipPin: window.CONFIG.SKIP_PIN,
      puzzleImage: window._puzzleImageUrl || 'img/enamoradito.jpg',
      preguntas: clone(window.preguntas), storyLines: clone(window.storyLines),
      historyPhrases: clone(window.historyPhrases || []), emojiQuiz: clone(window.emojiQuiz || []),
      flipCards: [...document.querySelectorAll('.flip-card')].map(el => ({
        icono: el.querySelector('.fc-icon')?.textContent || '💌',
        titulo: el.querySelector('.fc-front-title')?.textContent || '',
        texto: el.querySelector('.fc-back-text')?.textContent || ''
      })),
      moments: [...document.querySelectorAll('.moment-card')].map(el => ({
        url: el.querySelector('img')?.getAttribute('src') || '',
        descripcion: el.querySelector('.moment-caption')?.textContent || ''
      }))
    };
  }
  function apply(data = {}) {
    if (/^\d{4}$/.test(data.pin)) window.CONFIG.PIN = String(data.pin);
    if (/^\d{4}$/.test(data.skipPin)) window.CONFIG.SKIP_PIN = String(data.skipPin);
    Object.entries(fields).forEach(([key, [selector,, type]]) => {
      if (typeof data.textos?.[key] !== 'string') return;
      const el = document.querySelector(selector);
      if (!el) return;
      if (type === 'rich') el.innerHTML = sanitize(data.textos[key]);
      else el.textContent = data.textos[key];
    });
    for (const [key, alias] of [['preguntas','__PREGUNTAS_EDITABLES__'], ['storyLines','__STORY_LINES_EDITABLES__']]) {
      if (Array.isArray(data[key]) && data[key].length) {
        window[key] = clone(data[key]); window[alias] = window[key];
      }
    }
    if (Array.isArray(data.historyPhrases) && data.historyPhrases.length) window.historyPhrases = clone(data.historyPhrases);
    if (Array.isArray(data.emojiQuiz) && data.emojiQuiz.length) window.emojiQuiz = clone(data.emojiQuiz);
    if (Array.isArray(data.flipCards)) data.flipCards.forEach((card, i) => {
      for (const [selector, value] of [['.fc-front-title',card.titulo],['.fc-back-title',card.titulo],['.fc-back-text',card.texto],['.fc-icon',card.icono]]) {
        const el = document.querySelector(`#fc${i} ${selector}`);
        if (el && typeof value === 'string') el.textContent = value;
      }
    });
    if (safeURL(data.puzzleImage, true)) {
      window._puzzleImageUrl = data.puzzleImage;
      document.querySelectorAll('.puzzle-cell').forEach(el => { el.style.backgroundImage = `url(${JSON.stringify(data.puzzleImage)})`; });
    }
    if (Array.isArray(data.moments)) data.moments.forEach((item, i) => {
      const el = document.querySelectorAll('.moment-card')[i];
      if (!el) return;
      if (safeURL(item.url, true)) el.querySelector('img').src = item.url;
      if (typeof item.descripcion === 'string') {
        el.querySelector('.moment-caption').textContent = item.descripcion;
        el.querySelector('img').alt = item.descripcion;
      }
    });
  }
  return { fields, defaults, apply, sanitize, safeURL, clone };
})();
