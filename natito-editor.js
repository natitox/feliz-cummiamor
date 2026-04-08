'use strict';

/* ═══════════════════════════════════════════════════════
   natito-editor-v2.js — Editor estructurado para natito
   ─────────────────────────────────────────────────────
   Objetivos:
   - Mantener compatibilidad con script.js existente
   - Permitir editar la mayor cantidad posible del contenido
   - Guardar todo en Firestore (editor_data/content)
   - Evitar parches frágiles o duplicados
   - Tener una arquitectura clara y extensible

   REQUISITOS:
   - window.db (Firestore) disponible
   - script.js cargado antes que este archivo
   - window._currentUsername establecido

   IMPORTANTE:
   Para que preguntas y storyLines sean realmente editables,
   conviene aplicar el pequeño patch sugerido al final de este archivo
   dentro de script.js.
═══════════════════════════════════════════════════════ */

(function () {
  if (window.__natitoEditorBooted) return;
  window.__natitoEditorBooted = true;

  const EDITOR_DOC = { collection: 'editor_data', id: 'content' };
  const ALBUM_COLLECTION = 'fotos';
  const NOTES_COLLECTION = 'cartas';
  const EDITOR_USERNAME = 'natito';

  const DEFAULTS = {
    preguntas: [],
    storyLines: [],
    flipCards: [],
    puzzleImage: '',
    pin: '',
    textos: {
      lockTitle: '',
      lockSubtitle: '',
      welcomeTitle: '',
      finalLetter: '',
      letterIntro: ''
    }
  };

  const stateRef = () => window.state || {};

  const Editor = {
    data: JSON.parse(JSON.stringify(DEFAULTS)),
    refs: {
      originalShowScreen: null,
      originalRenderPuzzle: null,
      originalOpenEnvelope: null
    },
    ready: false
  };

  function isNatito() {
    return window._currentUsername === EDITOR_USERNAME;
  }

 function getDb() {
  return window.db || null;
}

  function getQuestionsSource() {
    if (Array.isArray(window.preguntas) && window.preguntas.length) return window.preguntas;
    if (Array.isArray(window.__PREGUNTAS_EDITABLES__) && window.__PREGUNTAS_EDITABLES__.length) return window.__PREGUNTAS_EDITABLES__;
    if (Array.isArray(window.preguntasOriginales) && window.preguntasOriginales.length) return window.preguntasOriginales;
    if (typeof preguntas !== 'undefined' && Array.isArray(preguntas)) return preguntas;
    return [];
  }

  function getStorySource() {
    if (Array.isArray(window.storyLines) && window.storyLines.length) return window.storyLines;
    if (Array.isArray(window.__STORY_LINES_EDITABLES__) && window.__STORY_LINES_EDITABLES__.length) return window.__STORY_LINES_EDITABLES__;
    if (typeof storyLines !== 'undefined' && Array.isArray(storyLines)) return storyLines;
    return [];
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg, ms = 2600) {
    let el = document.getElementById('editor-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'editor-toast';
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:80px',
        'transform:translateX(-50%)',
        'padding:.7rem 1.2rem',
        'background:#333',
        'color:#fff',
        'border-radius:999px',
        'font-size:.85rem',
        'z-index:100000',
        'box-shadow:0 8px 24px rgba(0,0,0,.2)',
        'opacity:0',
        'transition:opacity .25s ease',
        'pointer-events:none',
        'white-space:nowrap'
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el.__hideTimer);
    el.__hideTimer = setTimeout(() => { el.style.opacity = '0'; }, ms);
  }

  function getEditorDocRef() {
    return getDb().collection(EDITOR_DOC.collection).doc(EDITOR_DOC.id);
  }

  async function loadEditorData() {
  const db = getDb();

  if (!db) {
    console.warn('Editor: db aún no está disponible, usando defaults');
    seedRuntimeDefaults();
    return;
  }

  const snap = await db.collection(EDITOR_DOC.collection).doc(EDITOR_DOC.id).get();

  if (!snap.exists) {
    seedRuntimeDefaults();
    return;
  }

  const data = snap.data() || {};
  Editor.data = {
    preguntas: Array.isArray(data.preguntas) ? data.preguntas : [],
    storyLines: Array.isArray(data.storyLines) ? data.storyLines : [],
    flipCards: Array.isArray(data.flipCards) ? data.flipCards : [],
    puzzleImage: data.puzzleImage || '',
    pin: data.pin || '',
    textos: {
      lockTitle: data.textos?.lockTitle || '',
      lockSubtitle: data.textos?.lockSubtitle || '',
      welcomeTitle: data.textos?.welcomeTitle || '',
      finalLetter: data.textos?.finalLetter || '',
      letterIntro: data.textos?.letterIntro || ''
    }
  };

    seedRuntimeDefaults();
    applyEditorData();
  }

  function seedRuntimeDefaults() {
    if (!Editor.data.preguntas.length) {
      Editor.data.preguntas = clone(getQuestionsSource());
    }
    if (!Editor.data.storyLines.length) {
      Editor.data.storyLines = clone(getStorySource());
    }
    if (!Editor.data.flipCards.length) {
      Editor.data.flipCards = getCurrentFlipCardsFromDOM();
    }
    if (!Editor.data.puzzleImage) {
      Editor.data.puzzleImage = window._puzzleImageUrl || 'img/enamoradito.jpg';
    }
    if (!Editor.data.pin) {
      Editor.data.pin = (window.CONFIG && window.CONFIG.PIN) ? window.CONFIG.PIN : '';
    }
    Editor.data.textos = {
      lockTitle: Editor.data.textos.lockTitle || getHtml('.lock-title'),
      lockSubtitle: Editor.data.textos.lockSubtitle || getHtml('.lock-subtitle'),
      welcomeTitle: Editor.data.textos.welcomeTitle || getHtml('.welcome-title'),
      finalLetter: Editor.data.textos.finalLetter || getHtml('.final-letter-text'),
      letterIntro: Editor.data.textos.letterIntro || getHtml('.letter-intro')
    };
  }
async function saveEditorData(section, value) {
  const db = getDb();

  if (!db) {
    showToast('❌ Firebase aún no está listo');
    return;
  }

  await db.collection(EDITOR_DOC.collection).doc(EDITOR_DOC.id).set(
    { [section]: value },
    { merge: true }
  );
}

  function applyEditorData() {
    applyPin(Editor.data.pin);
    applyTextos(Editor.data.textos);
    applyPreguntas(Editor.data.preguntas);
    applyStoryLines(Editor.data.storyLines);
    applyFlipCards(Editor.data.flipCards);
    applyPuzzleImage(Editor.data.puzzleImage);
  }

  function applyPin(pin) {
    if (!pin) return;
    if (window.CONFIG) window.CONFIG.PIN = String(pin);
  }

  function applyTextos(textos) {
    setHtml('.lock-title', textos.lockTitle);
    setHtml('.lock-subtitle', textos.lockSubtitle);
    setHtml('.welcome-title', textos.welcomeTitle);
    setHtml('.final-letter-text', textos.finalLetter);
    setHtml('.letter-intro', textos.letterIntro);
  }

  function applyPreguntas(list) {
    if (!Array.isArray(list) || !list.length) return;
    window.preguntas = clone(list);
    window.__PREGUNTAS_EDITABLES__ = clone(list);

    if (typeof window.initSiNoQuestions === 'function') {
      window.initSiNoQuestions();
    }

    const s = stateRef();
    if (typeof s.qIndex === 'number' && s.qIndex >= list.length) {
      s.qIndex = 0;
    }
  }

  function applyStoryLines(list) {
    if (!Array.isArray(list) || !list.length) return;
    window.storyLines = clone(list);
    window.__STORY_LINES_EDITABLES__ = clone(list);

    const s = stateRef();
    if (typeof s.storyIndex === 'number' && s.storyIndex >= list.length) {
      s.storyIndex = 0;
    }
  }

  function applyFlipCards(cards) {
    if (!Array.isArray(cards) || !cards.length) return;
    cards.forEach((card, i) => {
      setText(`#fc${i} .fc-front-title`, card.titulo || '');
      setText(`#fc${i} .fc-back-title`, card.titulo || '');
      setText(`#fc${i} .fc-back-text`, card.texto || '');
      setText(`#fc${i} .fc-icon`, card.icono || '💌');
    });
  }

  function applyPuzzleImage(url) {
    if (!url) return;
    window._puzzleImageUrl = url;
    document.querySelectorAll('.puzzle-cell').forEach(cell => {
      cell.style.backgroundImage = `url("${url}")`;
    });
  }

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value || '';
  }

  function setHtml(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = value || '';
  }

  function getHtml(selector) {
    return document.querySelector(selector)?.innerHTML || '';
  }

  function getText(selector) {
    return document.querySelector(selector)?.textContent || '';
  }

  function getCurrentFlipCardsFromDOM() {
    const cards = [];
    for (let i = 0; i < 5; i++) {
      const frontTitle = getText(`#fc${i} .fc-front-title`);
      const backText = getText(`#fc${i} .fc-back-text`);
      const icon = getText(`#fc${i} .fc-icon`) || '💌';
      if (frontTitle || backText) {
        cards.push({ icono: icon, titulo: frontTitle, texto: backText });
      }
    }
    return cards;
  }

  function patchShowScreen() {
    if (Editor.refs.originalShowScreen || typeof window.showScreen !== 'function') return;
    Editor.refs.originalShowScreen = window.showScreen;
    window.showScreen = function patchedShowScreen(id) {
      Editor.refs.originalShowScreen(id);
      toggleQuizNav(id === 'questions-screen' && isNatito());
    };
  }

  function patchRenderPuzzle() {
    if (Editor.refs.originalRenderPuzzle || typeof window.renderPuzzle !== 'function') return;
    Editor.refs.originalRenderPuzzle = window.renderPuzzle;
    window.renderPuzzle = function patchedRenderPuzzle(size) {
      Editor.refs.originalRenderPuzzle(size);
      if (window._puzzleImageUrl) {
        document.querySelectorAll('.puzzle-cell').forEach(cell => {
          cell.style.backgroundImage = `url("${window._puzzleImageUrl}")`;
        });
      }
    };
  }

  function injectEditorButton() {
    if (!isNatito() || document.getElementById('natito-edit-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'natito-edit-btn';
    btn.type = 'button';
    btn.title = 'Editor natito';
    btn.innerHTML = '✏️';
    btn.style.cssText = [
      'position:fixed',
      'left:20px',
      'bottom:20px',
      'width:52px',
      'height:52px',
      'border:none',
      'border-radius:50%',
      'background:#e63166',
      'color:#fff',
      'font-size:1.25rem',
      'cursor:pointer',
      'z-index:9998',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'box-shadow:0 10px 25px rgba(230,49,102,.35)',
      'transition:transform .15s ease, box-shadow .15s ease'
    ].join(';');
    btn.onmouseenter = () => {
      btn.style.transform = 'scale(1.07)';
      btn.style.boxShadow = '0 14px 28px rgba(230,49,102,.42)';
    };
    btn.onmouseleave = () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 10px 25px rgba(230,49,102,.35)';
    };
    btn.onclick = openEditorMenu;
    document.body.appendChild(btn);
  }

  function injectQuizNavButtons() {
    if (!isNatito()) return;
    const screen = document.getElementById('questions-screen');
    if (!screen || document.getElementById('natito-quiz-nav')) return;

    const wrap = document.createElement('div');
    wrap.id = 'natito-quiz-nav';
    wrap.style.cssText = 'display:none;justify-content:center;gap:1rem;margin-top:1rem;position:relative;z-index:20;';
    wrap.innerHTML = `
      <button type="button" onclick="window.natitoQuizPrev()" style="background:rgba(230,49,102,.1);border:1px solid rgba(230,49,102,.28);border-radius:999px;padding:.45rem 1rem;color:#e63166;cursor:pointer;font-size:.85rem;">← Anterior</button>
      <button type="button" onclick="window.natitoQuizNext()" style="background:rgba(230,49,102,.1);border:1px solid rgba(230,49,102,.28);border-radius:999px;padding:.45rem 1rem;color:#e63166;cursor:pointer;font-size:.85rem;">Siguiente →</button>
    `;
    screen.appendChild(wrap);
  }

  function toggleQuizNav(show) {
    const nav = document.getElementById('natito-quiz-nav');
    if (nav) nav.style.display = show ? 'flex' : 'none';
  }

  window.natitoQuizPrev = function () {
    const s = stateRef();
    const qs = getQuestionsSource();
    if (!qs.length) return;
    if (s.qIndex > 0) {
      s.qIndex -= 1;
      const card = document.getElementById('q-sinno');
      const result = document.getElementById('q-resultado');
      if (result) {
        result.classList.remove('active');
        result.style.display = 'none';
      }
      if (card) {
        card.style.display = 'block';
        card.style.opacity = '1';
        card.style.transform = 'none';
      }
      if (typeof window.renderSiNoQuestion === 'function') window.renderSiNoQuestion();
    }
  };

  window.natitoQuizNext = function () {
    const s = stateRef();
    const qs = getQuestionsSource();
    if (!qs.length) return;
    if (s.qIndex < qs.length - 1) {
      s.qIndex += 1;
      if (typeof window.renderSiNoQuestion === 'function') window.renderSiNoQuestion();
    } else if (typeof window.mostrarResultado === 'function') {
      window.mostrarResultado();
    }
  };

  function closeModal() {
    document.getElementById('natito-editor-modal')?.remove();
    delete window.editorSaveCallback;
  }

  function createEditorModal(title, bodyHTML, onSave, opts = {}) {
    closeModal();

    const modal = document.createElement('div');
    modal.id = 'natito-editor-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;justify-content:center;align-items:flex-start;padding:1rem;overflow-y:auto;background:rgba(0,0,0,.55);';

    const width = opts.width || 560;
    const saveLabel = opts.saveLabel || '💾 Guardar cambios';

    modal.innerHTML = `
      <div style="background:#fff;border-radius:22px;width:100%;max-width:${width}px;margin:auto;padding:1.4rem 1.4rem 1.2rem;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.28);">
        <button type="button" onclick="document.getElementById('natito-editor-modal').remove()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.25rem;cursor:pointer;color:#999;">✕</button>
        <h3 style="margin:0 0 1rem;color:#e63166;font-family:'Dancing Script',cursive;font-size:1.5rem;">${title}</h3>
        <div id="editor-modal-body">${bodyHTML}</div>
        <div style="display:flex;gap:.8rem;margin-top:1rem;">
          <button type="button" id="editor-save-btn" onclick="window.editorSaveCallback && window.editorSaveCallback()" style="flex:1;background:#e63166;color:#fff;border:none;border-radius:12px;padding:.8rem 1rem;font-size:.95rem;cursor:pointer;font-weight:600;">${saveLabel}</button>
          <button type="button" onclick="document.getElementById('natito-editor-modal').remove()" style="background:#f5f5f5;color:#666;border:none;border-radius:12px;padding:.8rem 1rem;font-size:.95rem;cursor:pointer;">Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    window.editorSaveCallback = onSave;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  function buttonHtml(label, fnName) {
    return `<button type="button" onclick="document.getElementById('natito-editor-modal').remove(); window.${fnName}();" style="display:block;width:100%;text-align:left;background:#fafafa;border:1px solid #eee;border-radius:12px;padding:.8rem 1rem;font-size:.9rem;cursor:pointer;margin-bottom:.55rem;color:#333;">${label}</button>`;
  }

  function openEditorMenu() {
    const screenId = document.querySelector('.screen.active')?.id || '';

    const screenOptions = {
      'welcome-screen': [
        ['👋 Editar bienvenida', 'openEditorWelcome']
      ],
      'lock-screen': [
        ['🔑 Editar PIN', 'openEditorPin'],
        ['📝 Textos del candado', 'openEditorLockTexts']
      ],
      'questions-screen': [
        ['❓ Editar preguntas Sí/No', 'openEditorPreguntas']
      ],
      'cards-screen': [
        ['💌 Editar cartas ocultas', 'openEditorFlipCards']
      ],
      'puzzle-screen': [
        ['🧩 Cambiar imagen del puzzle', 'openEditorPuzzle']
      ],
      'story-screen': [
        ['📖 Editar mini historia', 'openEditorStory']
      ],
      'final-letter-screen': [
        ['💌 Editar carta final', 'openEditorFinalLetter']
      ],
      'letter-screen': [
        ['💌 Editar carta principal', 'openEditorLetterIntro'],
        ['🖼️ Gestionar álbum', 'openEditorAlbum'],
        ['🗒️ Gestionar cartas', 'openEditorNotas']
      ]
    };

    const globalOptions = [
      ['📝 Editar textos generales', 'openEditorTextos'],
      ['⏭️ Saltar a pantalla', 'openEditorSkip'],
      ['🔑 Editar PIN', 'openEditorPin'],
      ['🧩 Cambiar imagen del puzzle', 'openEditorPuzzle'],
      ['🖼️ Gestionar álbum', 'openEditorAlbum'],
      ['🗒️ Gestionar cartas', 'openEditorNotas']
    ];

    const specific = screenOptions[screenId] || [];
    const merged = [...specific];
    globalOptions.forEach(item => {
      if (!merged.find(x => x[1] === item[1])) merged.push(item);
    });

    const body = merged.map(([label, fn]) => buttonHtml(label, fn)).join('');
    createEditorModal('✏️ ¿Qué quieres editar?', body, () => {}, { width: 430, saveLabel: 'Cerrar' });

    const saveBtn = document.getElementById('editor-save-btn');
    if (saveBtn) {
      saveBtn.textContent = 'Cerrar';
      saveBtn.onclick = closeModal;
      saveBtn.style.flex = '0 0 auto';
    }
  }

  window.openEditorSkip = function () {
    const screens = [
      { id: 'welcome-screen', label: '👋 Bienvenida' },
      { id: 'lock-screen', label: '🔐 Candado' },
      { id: 'questions-screen', label: '❓ Preguntas Sí/No' },
      { id: 'memory-screen', label: '🧠 Memoria' },
      { id: 'sort-screen', label: '📚 Ordena historia' },
      { id: 'equiz-screen', label: '💭 Quiz emocional' },
      { id: 'cards-screen', label: '💌 Cartas ocultas' },
      { id: 'puzzle-screen', label: '🧩 Puzzle' },
      { id: 'story-screen', label: '📖 Mini historia' },
      { id: 'final-letter-screen', label: '💌 Carta final' },
      { id: 'letter-screen', label: '💖 Carta principal' }
    ];

    const body = screens.map(s => {
      return `<button type="button" onclick="document.getElementById('natito-editor-modal').remove(); window.goToPhase && window.goToPhase('${s.id}');" style="display:block;width:100%;text-align:left;background:#fafafa;border:1px solid #eee;border-radius:12px;padding:.75rem 1rem;font-size:.9rem;cursor:pointer;margin-bottom:.45rem;color:#333;">${s.label}</button>`;
    }).join('');

    createEditorModal('⏭️ Saltar a pantalla', body, () => {}, { width: 390, saveLabel: 'Cerrar' });
    const saveBtn = document.getElementById('editor-save-btn');
    if (saveBtn) saveBtn.onclick = closeModal;
  };

  window.openEditorPin = function () {
    createEditorModal('🔑 Editar PIN', `
      <p style="font-size:.82rem;color:#888;margin:0 0 .8rem;">PIN actual: <strong>${escHtml(Editor.data.pin || '')}</strong></p>
      <label style="display:block;font-size:.82rem;color:#666;margin-bottom:.35rem;">Nuevo PIN (4 dígitos)</label>
      <input id="editor-pin-input" type="number" value="${escHtml(Editor.data.pin || '')}" style="width:100%;border:1px solid #ddd;border-radius:10px;padding:.7rem .8rem;font-size:1.05rem;text-align:center;letter-spacing:.25rem;box-sizing:border-box;outline:none;" />
    `, async () => {
      const value = String(document.getElementById('editor-pin-input')?.value || '').trim();
      if (!/^\d{4}$/.test(value)) {
        showToast('El PIN debe tener 4 dígitos');
        return;
      }
      await saveEditorData('pin', value);
      Editor.data.pin = value;
      applyPin(value);
      closeModal();
      showToast('✅ PIN actualizado');
    });
  };

  window.openEditorLockTexts = function () {
    const textos = Editor.data.textos;
    createEditorModal('📝 Textos del candado', `
      <label style="display:block;font-size:.82rem;color:#666;margin-bottom:.35rem;">Título</label>
      <input id="lock-title-input" value="${escHtml(textos.lockTitle)}" style="width:100%;border:1px solid #ddd;border-radius:10px;padding:.6rem .7rem;font-size:.9rem;box-sizing:border-box;outline:none;margin-bottom:.8rem;" />
      <label style="display:block;font-size:.82rem;color:#666;margin-bottom:.35rem;">Subtítulo</label>
      <textarea id="lock-subtitle-input" rows="4" style="width:100%;border:1px solid #ddd;border-radius:10px;padding:.6rem .7rem;font-size:.88rem;box-sizing:border-box;outline:none;resize:vertical;">${escHtml(textos.lockSubtitle)}</textarea>
    `, async () => {
      const next = {
        ...Editor.data.textos,
        lockTitle: document.getElementById('lock-title-input')?.value || '',
        lockSubtitle: document.getElementById('lock-subtitle-input')?.value || ''
      };
      await saveEditorData('textos', next);
      Editor.data.textos = next;
      applyTextos(next);
      closeModal();
      showToast('✅ Textos del candado actualizados');
    });
  };

  window.openEditorWelcome = function () {
    createEditorModal('👋 Editar bienvenida', `
      <label style="display:block;font-size:.82rem;color:#666;margin-bottom:.35rem;">Título</label>
      <input id="welcome-title-input" value="${escHtml(Editor.data.textos.welcomeTitle)}" style="width:100%;border:1px solid #ddd;border-radius:10px;padding:.6rem .7rem;font-size:.9rem;box-sizing:border-box;outline:none;" />
    `, async () => {
      const next = {
        ...Editor.data.textos,
        welcomeTitle: document.getElementById('welcome-title-input')?.value || ''
      };
      await saveEditorData('textos', next);
      Editor.data.textos = next;
      applyTextos(next);
      closeModal();
      showToast('✅ Bienvenida actualizada');
    });
  };

  window.openEditorTextos = function () {
    const t = Editor.data.textos;
    createEditorModal('📝 Editar textos generales', `
      <label style="display:block;font-size:.82rem;color:#666;margin-bottom:.35rem;">Título bienvenida</label>
      <input id="txt-welcome" value="${escHtml(t.welcomeTitle)}" style="width:100%;border:1px solid #ddd;border-radius:10px;padding:.6rem .7rem;font-size:.88rem;box-sizing:border-box;outline:none;margin-bottom:.8rem;" />

      <label style="display:block;font-size:.82rem;color:#666;margin-bottom:.35rem;">Título candado</label>
      <input id="txt-lock-title" value="${escHtml(t.lockTitle)}" style="width:100%;border:1px solid #ddd;border-radius:10px;padding:.6rem .7rem;font-size:.88rem;box-sizing:border-box;outline:none;margin-bottom:.8rem;" />

      <label style="display:block;font-size:.82rem;color:#666;margin-bottom:.35rem;">Subtítulo candado</label>
      <textarea id="txt-lock-subtitle" rows="3" style="width:100%;border:1px solid #ddd;border-radius:10px;padding:.6rem .7rem;font-size:.86rem;box-sizing:border-box;outline:none;resize:vertical;margin-bottom:.8rem;">${escHtml(t.lockSubtitle)}</textarea>

      <label style="display:block;font-size:.82rem;color:#666;margin-bottom:.35rem;">Carta final (HTML permitido)</label>
      <textarea id="txt-final-letter" rows="6" style="width:100%;border:1px solid #ddd;border-radius:10px;padding:.6rem .7rem;font-size:.84rem;box-sizing:border-box;outline:none;resize:vertical;margin-bottom:.8rem;">${escHtml(t.finalLetter)}</textarea>

      <label style="display:block;font-size:.82rem;color:#666;margin-bottom:.35rem;">Carta principal (HTML permitido)</label>
      <textarea id="txt-letter-intro" rows="6" style="width:100%;border:1px solid #ddd;border-radius:10px;padding:.6rem .7rem;font-size:.84rem;box-sizing:border-box;outline:none;resize:vertical;">${escHtml(t.letterIntro)}</textarea>
    `, async () => {
      const next = {
        welcomeTitle: document.getElementById('txt-welcome')?.value || '',
        lockTitle: document.getElementById('txt-lock-title')?.value || '',
        lockSubtitle: document.getElementById('txt-lock-subtitle')?.value || '',
        finalLetter: document.getElementById('txt-final-letter')?.value || '',
        letterIntro: document.getElementById('txt-letter-intro')?.value || ''
      };
      await saveEditorData('textos', next);
      Editor.data.textos = next;
      applyTextos(next);
      closeModal();
      showToast('✅ Textos actualizados');
    }, { width: 640 });
  };

  window.openEditorFinalLetter = function () {
    createEditorModal('💌 Editar carta final', `
      <p style="font-size:.82rem;color:#888;margin:0 0 .65rem;">Puedes usar HTML sencillo: &lt;br&gt;, &lt;em&gt;, &lt;strong&gt;.</p>
      <textarea id="final-letter-input" rows="10" style="width:100%;border:1px solid #ddd;border-radius:10px;padding:.6rem .7rem;font-size:.84rem;box-sizing:border-box;outline:none;resize:vertical;">${escHtml(Editor.data.textos.finalLetter)}</textarea>
    `, async () => {
      const next = {
        ...Editor.data.textos,
        finalLetter: document.getElementById('final-letter-input')?.value || ''
      };
      await saveEditorData('textos', next);
      Editor.data.textos = next;
      applyTextos(next);
      closeModal();
      showToast('✅ Carta final actualizada');
    }, { width: 680 });
  };

  window.openEditorLetterIntro = function () {
    createEditorModal('💖 Editar carta principal', `
      <p style="font-size:.82rem;color:#888;margin:0 0 .65rem;">Puedes usar HTML sencillo: &lt;br&gt;, &lt;em&gt;, &lt;strong&gt;.</p>
      <textarea id="letter-intro-input" rows="12" style="width:100%;border:1px solid #ddd;border-radius:10px;padding:.6rem .7rem;font-size:.84rem;box-sizing:border-box;outline:none;resize:vertical;">${escHtml(Editor.data.textos.letterIntro)}</textarea>
    `, async () => {
      const next = {
        ...Editor.data.textos,
        letterIntro: document.getElementById('letter-intro-input')?.value || ''
      };
      await saveEditorData('textos', next);
      Editor.data.textos = next;
      applyTextos(next);
      closeModal();
      showToast('✅ Carta principal actualizada');
    }, { width: 700 });
  };

  window.openEditorPreguntas = function () {
    const preguntasActuales = clone(Editor.data.preguntas.length ? Editor.data.preguntas : getQuestionsSource());
    const rows = preguntasActuales.map((q, i) => renderPreguntaRow(q, i)).join('');

    createEditorModal('❓ Editar preguntas Sí/No', `
      <p style="font-size:.82rem;color:#888;margin:0 0 .8rem;">Aquí puedes agregar, eliminar y reordenar. Estas preguntas se guardan en Firebase.</p>
      <div id="editor-preguntas-list">${rows}</div>
      <div style="display:flex;gap:.6rem;margin-top:.6rem;">
        <button type="button" onclick="window.addEditorPregunta()" style="flex:1;background:rgba(230,49,102,.08);border:1px dashed rgba(230,49,102,.4);border-radius:10px;padding:.65rem;color:#e63166;cursor:pointer;font-size:.86rem;">+ Agregar pregunta</button>
      </div>
    `, async () => {
      const list = document.querySelectorAll('#editor-preguntas-list .eq-row');
      const next = [];
      list.forEach((row, i) => {
        const pregunta = row.querySelector('.eq-pregunta')?.value?.trim();
        const correcta = row.querySelector(`input[name="resp${i}"]:checked`)?.value || 'si';
        if (pregunta) next.push({ pregunta, respuestaCorrecta: correcta });
      });
      if (!next.length) {
        showToast('Agrega al menos una pregunta');
        return;
      }
      await saveEditorData('preguntas', next);
      Editor.data.preguntas = next;
      applyPreguntas(next);
      closeModal();
      if (document.getElementById('questions-screen')?.classList.contains('active') && typeof window.renderSiNoQuestion === 'function') {
        window.renderSiNoQuestion();
      }
      showToast('✅ Preguntas actualizadas');
    }, { width: 700 });
  };

  function renderPreguntaRow(q, i) {
    return `
      <div class="eq-row" data-index="${i}" style="background:#fafafa;border-radius:12px;padding:.8rem;margin-bottom:.6rem;border:1px solid #eee;">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem;">
          <button type="button" onclick="window.moveEditorPregunta(${i}, -1)" style="background:none;border:none;color:#999;cursor:pointer;font-size:.95rem;">↑</button>
          <button type="button" onclick="window.moveEditorPregunta(${i}, 1)" style="background:none;border:none;color:#999;cursor:pointer;font-size:.95rem;">↓</button>
          <span style="color:#e63166;font-weight:600;font-size:.82rem;min-width:20px;">${i + 1}</span>
          <input class="eq-pregunta" value="${escHtml(q.pregunta)}" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:.45rem .6rem;font-size:.86rem;outline:none;" />
          <button type="button" onclick="window.deleteEditorPregunta(${i})" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:1rem;">🗑️</button>
        </div>
        <div style="display:flex;align-items:center;gap:.6rem;">
          <span style="font-size:.76rem;color:#888;">Correcta:</span>
          <label style="display:flex;align-items:center;gap:.3rem;font-size:.82rem;cursor:pointer;"><input type="radio" name="resp${i}" value="si" ${q.respuestaCorrecta === 'si' ? 'checked' : ''} /> Sí</label>
          <label style="display:flex;align-items:center;gap:.3rem;font-size:.82rem;cursor:pointer;"><input type="radio" name="resp${i}" value="no" ${q.respuestaCorrecta === 'no' ? 'checked' : ''} /> No</label>
        </div>
      </div>
    `;
  }

  function rebuildPreguntaRows() {
    const list = document.getElementById('editor-preguntas-list');
    if (!list) return;
    const items = Array.from(list.querySelectorAll('.eq-row')).map(row => {
      const idx = Number(row.dataset.index || 0);
      return {
        pregunta: row.querySelector('.eq-pregunta')?.value || '',
        respuestaCorrecta: row.querySelector(`input[name="resp${idx}"]:checked`)?.value || 'si'
      };
    });
    list.innerHTML = items.map((item, i) => renderPreguntaRow(item, i)).join('');
  }

  window.addEditorPregunta = function () {
    const list = document.getElementById('editor-preguntas-list');
    if (!list) return;
    const nextIndex = list.querySelectorAll('.eq-row').length;
    list.insertAdjacentHTML('beforeend', renderPreguntaRow({ pregunta: '', respuestaCorrecta: 'si' }, nextIndex));
    rebuildPreguntaRows();
  };

  window.deleteEditorPregunta = function (index) {
    document.querySelectorAll('#editor-preguntas-list .eq-row')[index]?.remove();
    rebuildPreguntaRows();
  };

  window.moveEditorPregunta = function (index, direction) {
    const rows = Array.from(document.querySelectorAll('#editor-preguntas-list .eq-row')).map((row, i) => ({
      pregunta: row.querySelector('.eq-pregunta')?.value || '',
      respuestaCorrecta: row.querySelector(`input[name="resp${i}"]:checked`)?.value || 'si'
    }));
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= rows.length) return;
    const temp = rows[index];
    rows[index] = rows[nextIndex];
    rows[nextIndex] = temp;
    const list = document.getElementById('editor-preguntas-list');
    if (list) list.innerHTML = rows.map((item, i) => renderPreguntaRow(item, i)).join('');
  };

  window.openEditorFlipCards = function () {
    const cards = clone(Editor.data.flipCards.length ? Editor.data.flipCards : getCurrentFlipCardsFromDOM());
    const rows = cards.map((c, i) => `
      <div class="fc-row" data-index="${i}" style="background:#fafafa;border-radius:12px;padding:.8rem;margin-bottom:.8rem;border:1px solid #eee;">
        <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.45rem;">
          <span style="font-size:.8rem;color:#e63166;min-width:18px;">${i + 1}</span>
          <input class="fc-icono" value="${escHtml(c.icono || '💌')}" style="width:48px;border:1px solid #ddd;border-radius:8px;padding:.35rem;text-align:center;font-size:1rem;outline:none;" />
          <input class="fc-titulo" value="${escHtml(c.titulo || '')}" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:.45rem .6rem;font-size:.86rem;outline:none;" />
        </div>
        <textarea class="fc-texto" rows="4" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:.45rem .6rem;font-size:.84rem;outline:none;resize:vertical;box-sizing:border-box;">${escHtml(c.texto || '')}</textarea>
      </div>
    `).join('');

    createEditorModal('💌 Editar cartas ocultas', `
      <p style="font-size:.82rem;color:#888;margin:0 0 .8rem;">Se editan icono, título y texto de cada carta.</p>
      <div id="editor-flipcards-list">${rows}</div>
    `, async () => {
      const next = Array.from(document.querySelectorAll('#editor-flipcards-list .fc-row')).map(row => ({
        icono: row.querySelector('.fc-icono')?.value?.trim() || '💌',
        titulo: row.querySelector('.fc-titulo')?.value?.trim() || '',
        texto: row.querySelector('.fc-texto')?.value?.trim() || ''
      }));
      await saveEditorData('flipCards', next);
      Editor.data.flipCards = next;
      applyFlipCards(next);
      closeModal();
      showToast('✅ Cartas ocultas actualizadas');
    }, { width: 700 });
  };

  window.openEditorStory = function () {
    const lines = clone(Editor.data.storyLines.length ? Editor.data.storyLines : getStorySource());
    const rows = lines.map((line, i) => renderStoryRow(line, i)).join('');
    createEditorModal('📖 Editar mini historia', `
      <p style="font-size:.82rem;color:#888;margin:0 0 .8rem;">Cada línea representa un paso. Puedes reordenarlas.</p>
      <div id="editor-story-list">${rows}</div>
      <button type="button" onclick="window.addStoryLine()" style="width:100%;background:rgba(230,49,102,.08);border:1px dashed rgba(230,49,102,.4);border-radius:10px;padding:.65rem;color:#e63166;cursor:pointer;font-size:.86rem;margin-top:.4rem;">+ Agregar línea</button>
    `, async () => {
      const next = Array.from(document.querySelectorAll('#editor-story-list .sl-row'))
        .map(row => row.querySelector('.sl-line')?.value?.trim() || '')
        .filter(Boolean);
      if (!next.length) {
        showToast('Agrega al menos una línea');
        return;
      }
      await saveEditorData('storyLines', next);
      Editor.data.storyLines = next;
      applyStoryLines(next);
      if (document.getElementById('story-screen')?.classList.contains('active') && typeof window.initStory === 'function') {
        window.initStory();
      }
      closeModal();
      showToast('✅ Mini historia actualizada');
    }, { width: 700 });
  };

  function renderStoryRow(line, i) {
    return `
      <div class="sl-row" data-index="${i}" style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;">
        <button type="button" onclick="window.moveStoryLine(${i}, -1)" style="background:none;border:none;color:#999;cursor:pointer;font-size:.95rem;">↑</button>
        <button type="button" onclick="window.moveStoryLine(${i}, 1)" style="background:none;border:none;color:#999;cursor:pointer;font-size:.95rem;">↓</button>
        <span style="color:#e63166;font-size:.82rem;min-width:18px;">${i + 1}</span>
        <input class="sl-line" value="${escHtml(line)}" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:.45rem .6rem;font-size:.86rem;outline:none;" />
        <button type="button" onclick="window.deleteStoryLine(${i})" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:1rem;">🗑️</button>
      </div>
    `;
  }

  function rebuildStoryRows(items) {
    const list = document.getElementById('editor-story-list');
    if (!list) return;
    list.innerHTML = items.map((line, i) => renderStoryRow(line, i)).join('');
  }

  window.addStoryLine = function () {
    const list = document.getElementById('editor-story-list');
    if (!list) return;
    const items = Array.from(list.querySelectorAll('.sl-row')).map(row => row.querySelector('.sl-line')?.value || '');
    items.push('');
    rebuildStoryRows(items);
  };

  window.deleteStoryLine = function (index) {
    const list = document.getElementById('editor-story-list');
    if (!list) return;
    const items = Array.from(list.querySelectorAll('.sl-row')).map(row => row.querySelector('.sl-line')?.value || '');
    items.splice(index, 1);
    rebuildStoryRows(items);
  };

  window.moveStoryLine = function (index, direction) {
    const list = document.getElementById('editor-story-list');
    if (!list) return;
    const items = Array.from(list.querySelectorAll('.sl-row')).map(row => row.querySelector('.sl-line')?.value || '');
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const tmp = items[index];
    items[index] = items[nextIndex];
    items[nextIndex] = tmp;
    rebuildStoryRows(items);
  };

  window.openEditorPuzzle = async function () {
    createEditorModal('🧩 Cambiar imagen del puzzle', `
      <label style="display:block;font-size:.82rem;color:#666;margin-bottom:.35rem;">URL directa de imagen</label>
      <input id="editor-puzzle-url" value="${escHtml(Editor.data.puzzleImage || 'img/enamoradito.jpg')}" oninput="window.updatePuzzlePreview && window.updatePuzzlePreview(this.value)" style="width:100%;border:1px solid #ddd;border-radius:10px;padding:.6rem .7rem;font-size:.86rem;box-sizing:border-box;outline:none;" />
      <div style="text-align:center;margin:.8rem 0;">
        <img id="editor-puzzle-preview" src="${escHtml(Editor.data.puzzleImage || 'img/enamoradito.jpg')}" style="max-width:100%;max-height:170px;border-radius:12px;border:2px solid #eee;" />
      </div>
      <p style="font-size:.82rem;color:#888;margin:0 0 .5rem;">O elige una imagen del álbum:</p>
      <div id="editor-puzzle-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;max-height:210px;overflow-y:auto;"><p style="grid-column:1/-1;color:#aaa;font-size:.82rem;">Cargando fotos…</p></div>
    `, async () => {
      const value = document.getElementById('editor-puzzle-url')?.value?.trim();
      if (!value) {
        showToast('Pon una URL válida');
        return;
      }
      await saveEditorData('puzzleImage', value);
      Editor.data.puzzleImage = value;
      applyPuzzleImage(value);
      if (document.getElementById('puzzle-screen')?.classList.contains('active') && typeof window.initPuzzle === 'function') {
        window.initPuzzle();
      }
      closeModal();
      showToast('✅ Imagen del puzzle actualizada');
    }, { width: 700 });

    window.updatePuzzlePreview = function (url) {
      const img = document.getElementById('editor-puzzle-preview');
      if (img) img.src = url;
    };

    try {
      const snap = await getDb().collection(ALBUM_COLLECTION).orderBy('fecha', 'desc').limit(18).get();
      const grid = document.getElementById('editor-puzzle-grid');
      if (!grid) return;
      if (snap.empty) {
        grid.innerHTML = '<p style="grid-column:1/-1;color:#aaa;font-size:.82rem;">No hay fotos en el álbum.</p>';
        return;
      }
      grid.innerHTML = '';
      snap.forEach(doc => {
        const data = doc.data() || {};
        const item = document.createElement('div');
        item.style.cssText = 'cursor:pointer;border-radius:8px;overflow:hidden;border:2px solid transparent;transition:border-color .2s ease;';
        item.innerHTML = `<img src="${data.url || ''}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;" loading="lazy" />`;
        item.onclick = () => {
          grid.querySelectorAll('div').forEach(el => { el.style.borderColor = 'transparent'; });
          item.style.borderColor = '#e63166';
          const input = document.getElementById('editor-puzzle-url');
          if (input) input.value = data.url || '';
          window.updatePuzzlePreview(data.url || '');
        };
        grid.appendChild(item);
      });
    } catch (err) {
      console.warn('Editor puzzle: error cargando fotos', err);
    }
  };

  window.openEditorAlbum = async function () {
    createEditorModal('🖼️ Gestionar álbum', '<div id="editor-album-list"><p style="color:#aaa;font-size:.85rem;">Cargando fotos…</p></div>', () => {}, { width: 760, saveLabel: 'Cerrar' });
    const saveBtn = document.getElementById('editor-save-btn');
    if (saveBtn) saveBtn.onclick = closeModal;

    try {
      const snap = await getDb().collection(ALBUM_COLLECTION).orderBy('fecha', 'desc').get();
      const list = document.getElementById('editor-album-list');
      if (!list) return;
      if (snap.empty) {
        list.innerHTML = '<p style="color:#aaa;font-size:.85rem;">No hay fotos guardadas aún.</p>';
        return;
      }
      list.innerHTML = '';
      snap.forEach(doc => {
        const data = doc.data() || {};
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:.8rem;align-items:center;padding:.65rem 0;border-bottom:1px solid #f0f0f0;';
        row.innerHTML = `
          <img src="${data.url || ''}" style="width:68px;height:68px;object-fit:cover;border-radius:10px;flex-shrink:0;" />
          <input class="album-cap-input" value="${escHtml(data.descripcion || '')}" style="flex:1;border:1px solid #ddd;border-radius:10px;padding:.5rem .65rem;font-size:.84rem;outline:none;" />
          <button type="button" class="album-save-btn" style="background:#e63166;color:#fff;border:none;border-radius:8px;padding:.45rem .8rem;font-size:.8rem;cursor:pointer;">💾</button>
          <button type="button" class="album-delete-btn" style="background:#f5f5f5;color:#999;border:none;border-radius:8px;padding:.45rem .8rem;font-size:.8rem;cursor:pointer;">🗑️</button>
        `;
        row.querySelector('.album-save-btn').onclick = async () => {
          const value = row.querySelector('.album-cap-input')?.value?.trim() || '';
          try {
            await getDb().collection(ALBUM_COLLECTION).doc(doc.id).update({ descripcion: value });
            showToast('✅ Caption actualizado');
          } catch (err) {
            console.warn('Error guardando caption', err);
            showToast('❌ Error al guardar');
          }
        };
        row.querySelector('.album-delete-btn').onclick = async () => {
          if (!confirm('¿Eliminar esta foto del álbum?')) return;
          try {
            await getDb().collection(ALBUM_COLLECTION).doc(doc.id).delete();
            row.remove();
            if (typeof window.loadDynamicAlbum === 'function') window.loadDynamicAlbum();
            showToast('🗑️ Foto eliminada');
          } catch (err) {
            console.warn('Error eliminando foto', err);
            showToast('❌ Error al eliminar');
          }
        };
        list.appendChild(row);
      });
    } catch (err) {
      console.warn('Editor álbum: error', err);
      const list = document.getElementById('editor-album-list');
      if (list) list.innerHTML = '<p style="color:#d66;font-size:.85rem;">No se pudo cargar el álbum.</p>';
    }
  };

  window.openEditorNotas = async function () {
    createEditorModal('🗒️ Gestionar cartas', '<div id="editor-notas-list"><p style="color:#aaa;font-size:.85rem;">Cargando cartas…</p></div>', () => {}, { width: 760, saveLabel: 'Cerrar' });
    const saveBtn = document.getElementById('editor-save-btn');
    if (saveBtn) saveBtn.onclick = closeModal;

    try {
      const snap = await getDb().collection(NOTES_COLLECTION).orderBy('fecha', 'desc').get();
      const list = document.getElementById('editor-notas-list');
      if (!list) return;
      if (snap.empty) {
        list.innerHTML = '<p style="color:#aaa;font-size:.85rem;">No hay cartas guardadas.</p>';
        return;
      }
      list.innerHTML = '';
      snap.forEach(doc => {
        const data = doc.data() || {};
        const row = document.createElement('div');
        row.style.cssText = 'padding:.75rem 0;border-bottom:1px solid #f0f0f0;';
        row.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.35rem;">
            <strong style="font-size:.9rem;color:#e63166;">${escHtml(data.titulo || 'Sin título')}</strong>
            <button type="button" class="nota-delete-btn" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:1rem;">🗑️</button>
          </div>
          <p style="margin:0;font-size:.84rem;color:#666;line-height:1.45;">${escHtml(String(data.contenido || '').slice(0, 180))}${String(data.contenido || '').length > 180 ? '…' : ''}</p>
        `;
        row.querySelector('.nota-delete-btn').onclick = async () => {
          if (!confirm('¿Eliminar esta carta?')) return;
          try {
            await getDb().collection(NOTES_COLLECTION).doc(doc.id).delete();
            row.remove();
            showToast('🗑️ Carta eliminada');
          } catch (err) {
            console.warn('Error eliminando carta', err);
            showToast('❌ Error al eliminar');
          }
        };
        list.appendChild(row);
      });
    } catch (err) {
      console.warn('Editor cartas: error', err);
      const list = document.getElementById('editor-notas-list');
      if (list) list.innerHTML = '<p style="color:#d66;font-size:.85rem;">No se pudieron cargar las cartas.</p>';
    }
  };

  async function initNatitoEditor() {
    if (!isNatito()) return;
    try {
      patchShowScreen();
      patchRenderPuzzle();
      await loadEditorData();
      injectEditorButton();
      injectQuizNavButtons();
      toggleQuizNav(document.querySelector('.screen.active')?.id === 'questions-screen');
      Editor.ready = true;
      console.info('natito-editor-v2 listo');
    } catch (err) {
      console.error('Error iniciando natito-editor-v2:', err);
    }
  }

  window.initNatitoEditor = initNatitoEditor;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initNatitoEditor, 0);
    });
  } else {
    setTimeout(initNatitoEditor, 0);
  }
})();

/* ═══════════════════════════════════════════════════════
   PATCH RECOMENDADO PARA script.js
   ─────────────────────────────────────────────────────
   Si quieres que preguntas y storyLines sean realmente
   editables SIN depender de las const originales, cambia:

   1) renderSiNoQuestion()
      const q = (window.__PREGUNTAS_EDITABLES__ || preguntas)[state.qIndex];

   2) counter / progress / lógica relacionada
      usar const preguntasRuntime = window.__PREGUNTAS_EDITABLES__ || preguntas;

   3) responderSiNo()
      const preguntasRuntime = window.__PREGUNTAS_EDITABLES__ || preguntas;
      const q = preguntasRuntime[state.qIndex];
      if (state.qIndex < preguntasRuntime.length) ...

   4) mostrarResultado()
      porcentaje = Math.round((state.qCorrectas / preguntasRuntime.length) * 100)

   5) renderStoryLine() y nextStoryLine()
      const storyRuntime = window.__STORY_LINES_EDITABLES__ || storyLines;
      usar storyRuntime en vez de storyLines directo.

   Con ese patch, el editor queda totalmente alineado con el runtime.
═══════════════════════════════════════════════════════ */
