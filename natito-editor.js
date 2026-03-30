/* ═══════════════════════════════════════════════════════
   natito-editor.js  — Sistema de edición para natito
   ─────────────────────────────────────────────────────
   Solo visible/activo cuando el usuario es natito.
   Permite editar desde la página:
   • Preguntas sí/no (agregar, editar, eliminar, reordenar)
   • Cartas ocultas (flip cards)
   • Mini historia (líneas)
   • Imagen del rompecabezas (desde fotos subidas)
   Todo se guarda en Firestore colección "editor_data".
═══════════════════════════════════════════════════════ */
'use strict';

/* ── Verificar si es natito ── */
function isNatito() {
  return window._currentUsername === 'natito';
}

/* ══════════════════════════════════════
   DATOS EDITABLES — se cargan de Firebase
   o usan los defaults del script.js
══════════════════════════════════════ */
window._editorData = {
  preguntas:   null,   // array de {pregunta, respuestaCorrecta}
  storyLines:  null,   // array de strings
  flipCards:   null,   // array de {titulo, texto, icono}
  puzzleImage: null    // string URL
};

/* ══════════════════════════════════════
   CARGAR DATOS DESDE FIREBASE
══════════════════════════════════════ */
async function loadEditorData() {
  try {
    const doc = await db.collection('editor_data').doc('content').get();
    if (doc.exists) {
      const data = doc.data();
      if (data.preguntas)   window._editorData.preguntas   = data.preguntas;
      if (data.storyLines)  window._editorData.storyLines  = data.storyLines;
      if (data.flipCards)   window._editorData.flipCards   = data.flipCards;
      if (data.puzzleImage) window._editorData.puzzleImage = data.puzzleImage;

      // Aplicar datos al runtime
      applyEditorData();
    }
  } catch (err) {
    console.warn('Editor: no se pudieron cargar datos', err);
  }
}

function applyEditorData() {
  const d = window._editorData;

  // Preguntas
  if (d.preguntas && d.preguntas.length > 0) {
    window.preguntas = d.preguntas;
    // Reiniciar quiz con nuevas preguntas
    if (typeof initSiNoQuestions === 'function') initSiNoQuestions();
  }

  // Story lines
  if (d.storyLines && d.storyLines.length > 0) {
    window.storyLines = d.storyLines;
  }

  // Flip cards
  if (d.flipCards && d.flipCards.length > 0) {
    applyFlipCards(d.flipCards);
  }

  // Puzzle image
  if (d.puzzleImage) {
    window._puzzleImageUrl = d.puzzleImage;
  }
}

function applyFlipCards(cards) {
  cards.forEach((card, i) => {
    const frontTitle = document.querySelector(`#fc${i} .fc-front-title`);
    const backTitle  = document.querySelector(`#fc${i} .fc-back-title`);
    const backText   = document.querySelector(`#fc${i} .fc-back-text`);
    const icon       = document.querySelector(`#fc${i} .fc-icon`);
    if (frontTitle) frontTitle.textContent = card.titulo;
    if (backTitle)  backTitle.textContent  = card.titulo;
    if (backText)   backText.textContent   = card.texto;
    if (icon && card.icono) icon.textContent = card.icono;
  });
}

/* ══════════════════════════════════════
   GUARDAR EN FIREBASE
══════════════════════════════════════ */
async function saveEditorData(section, data) {
  try {
    await db.collection('editor_data').doc('content').set(
      { [section]: data },
      { merge: true }
    );
    showEditorToast('✅ Guardado con amor 💕');
    return true;
  } catch (err) {
    console.error('Error guardando:', err);
    showEditorToast('❌ Error al guardar, intenta de nuevo');
    return false;
  }
}

/* ══════════════════════════════════════
   TOAST DEL EDITOR
══════════════════════════════════════ */
function showEditorToast(msg) {
  let toast = document.getElementById('editor-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'editor-toast';
    toast.style.cssText = `
      position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
      background:#333; color:#fff; padding:.6rem 1.2rem; border-radius:20px;
      font-size:.85rem; z-index:99999; opacity:0; transition:opacity .3s;
      pointer-events:none; white-space:nowrap;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

/* ══════════════════════════════════════
   BOTÓN FLOTANTE DE EDICIÓN
══════════════════════════════════════ */
function injectEditorButton() {
  if (!isNatito()) return;

  const btn = document.createElement('button');
  btn.id = 'natito-edit-btn';
  btn.innerHTML = '✏️';
  btn.title = 'Modo edición (solo natito)';
  btn.style.cssText = `
    position:fixed; bottom:20px; left:20px; width:48px; height:48px;
    border-radius:50%; background:#e63166; color:#fff; border:none;
    font-size:1.2rem; cursor:pointer; z-index:9998;
    box-shadow:0 4px 16px rgba(230,49,102,.4);
    transition:transform .2s, box-shadow .2s;
    display:flex; align-items:center; justify-content:center;
  `;
  btn.onmouseenter = () => { btn.style.transform = 'scale(1.1)'; };
  btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
  btn.onclick = openEditorForCurrentScreen;
  document.body.appendChild(btn);

  // Botones nav: prev/next para el quiz sí/no
  injectQuizNavButtons();
}

/* ══════════════════════════════════════
   BOTONES PREV/NEXT PARA EL QUIZ (solo natito)
══════════════════════════════════════ */
function injectQuizNavButtons() {
  if (!isNatito()) return;

  // Se inyectan dentro de questions-screen
  const screen = document.getElementById('questions-screen');
  if (!screen) return;

  const wrap = document.createElement('div');
  wrap.id = 'natito-quiz-nav';
  wrap.style.cssText = `
    display:none; justify-content:center; gap:1rem; margin-top:1rem;
    position:relative; z-index:10;
  `;
  wrap.innerHTML = `
    <button onclick="natitoQuizPrev()" style="
      background:rgba(230,49,102,.12); border:1px solid rgba(230,49,102,.3);
      border-radius:20px; padding:.4rem 1rem; color:#e63166; cursor:pointer; font-size:.85rem;">
      ← Anterior
    </button>
    <button onclick="natitoQuizNext()" style="
      background:rgba(230,49,102,.12); border:1px solid rgba(230,49,102,.3);
      border-radius:20px; padding:.4rem 1rem; color:#e63166; cursor:pointer; font-size:.85rem;">
      Siguiente →
    </button>
  `;
  screen.appendChild(wrap);
}

// Mostrar/ocultar nav de quiz cuando cambia de pantalla
const _origShowScreen = window.showScreen;
window.showScreen = function(id) {
  if (typeof _origShowScreen === 'function') _origShowScreen(id);
  const nav = document.getElementById('natito-quiz-nav');
  if (nav) nav.style.display = (id === 'questions-screen' && isNatito()) ? 'flex' : 'none';
};

window.natitoQuizPrev = function() {
  if (state.qIndex > 0) {
    state.qIndex--;
    const card = document.getElementById('q-sinno');
    if (card) { card.style.display = 'block'; card.style.opacity = '1'; card.style.transform = 'none'; }
    const res = document.getElementById('q-resultado');
    if (res) { res.classList.remove('active'); res.style.display = 'none'; }
    renderSiNoQuestion();
  }
};

window.natitoQuizNext = function() {
  const qs = window.preguntas || preguntas;
  if (state.qIndex < qs.length - 1) {
    state.qIndex++;
    renderSiNoQuestion();
  } else {
    mostrarResultado();
  }
};

/* ══════════════════════════════════════
   ABRIR EDITOR SEGÚN PANTALLA ACTIVA
══════════════════════════════════════ */
function openEditorForCurrentScreen() {
  const active = document.querySelector('.screen.active');
  if (!active) return;
  const id = active.id;

  if (id === 'questions-screen') openEditorPreguntas();
  else if (id === 'cards-screen') openEditorFlipCards();
  else if (id === 'story-screen') openEditorStory();
  else if (id === 'puzzle-screen') openEditorPuzzle();
  else showEditorToast('Esta pantalla no tiene edición disponible');
}

/* ══════════════════════════════════════
   MODAL BASE
══════════════════════════════════════ */
function createEditorModal(title, bodyHTML, onSave) {
  // Eliminar modal anterior si existe
  const old = document.getElementById('natito-editor-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'natito-editor-modal';
  modal.style.cssText = `
    position:fixed; inset:0; z-index:99999;
    display:flex; align-items:flex-start; justify-content:center;
    padding:1rem; overflow-y:auto;
    background:rgba(0,0,0,.5);
  `;

  modal.innerHTML = `
    <div style="
      background:#fff; border-radius:20px; width:100%; max-width:540px;
      margin:auto; padding:1.5rem; position:relative;
      box-shadow:0 20px 60px rgba(0,0,0,.3);
    ">
      <button onclick="document.getElementById('natito-editor-modal').remove()" style="
        position:absolute; top:1rem; right:1rem; background:none; border:none;
        font-size:1.3rem; cursor:pointer; color:#888; line-height:1;
      ">✕</button>
      <h3 style="margin:0 0 1rem; color:#e63166; font-family:'Dancing Script',cursive; font-size:1.4rem;">
        ✏️ ${title}
      </h3>
      <div id="editor-modal-body">
        ${bodyHTML}
      </div>
      <div style="display:flex; gap:.8rem; margin-top:1.2rem;">
        <button id="editor-save-btn" onclick="editorSaveCallback()" style="
          flex:1; background:#e63166; color:#fff; border:none; border-radius:12px;
          padding:.75rem; font-size:.95rem; cursor:pointer; font-weight:500;
        ">💾 Guardar cambios</button>
        <button onclick="document.getElementById('natito-editor-modal').remove()" style="
          flex:0 0 auto; background:#f5f5f5; color:#666; border:none; border-radius:12px;
          padding:.75rem 1.2rem; font-size:.95rem; cursor:pointer;
        ">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  window.editorSaveCallback = onSave;

  // Cerrar al click en backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

/* ══════════════════════════════════════
   EDITOR: PREGUNTAS SÍ/NO
══════════════════════════════════════ */
function openEditorPreguntas() {
  const qs = window.preguntas || preguntas;

  const rows = qs.map((q, i) => `
    <div class="eq-row" data-index="${i}" style="
      background:#fafafa; border-radius:12px; padding:.8rem; margin-bottom:.6rem;
      border:1px solid #eee;
    ">
      <div style="display:flex; align-items:center; gap:.5rem; margin-bottom:.4rem;">
        <span style="color:#e63166; font-weight:600; font-size:.8rem; min-width:20px;">${i+1}</span>
        <input class="eq-pregunta" value="${escHtml(q.pregunta)}" style="
          flex:1; border:1px solid #ddd; border-radius:8px; padding:.4rem .6rem;
          font-size:.85rem; outline:none;
        "/>
        <button onclick="deleteEditorPregunta(${i})" style="
          background:none; border:none; color:#ccc; cursor:pointer; font-size:1rem; padding:0;
        ">🗑️</button>
      </div>
      <div style="display:flex; align-items:center; gap:.5rem;">
        <span style="font-size:.75rem; color:#888;">Respuesta correcta:</span>
        <label style="cursor:pointer; font-size:.8rem; display:flex; align-items:center; gap:.3rem;">
          <input type="radio" name="resp${i}" value="si" ${q.respuestaCorrecta==='si'?'checked':''}/> Sí
        </label>
        <label style="cursor:pointer; font-size:.8rem; display:flex; align-items:center; gap:.3rem;">
          <input type="radio" name="resp${i}" value="no" ${q.respuestaCorrecta==='no'?'checked':''}/> No
        </label>
      </div>
    </div>
  `).join('');

  createEditorModal('Editar preguntas Sí/No', `
    <p style="font-size:.8rem; color:#888; margin-bottom:.8rem;">
      Edita, elimina o agrega preguntas. Los cambios se guardan en Firebase.
    </p>
    <div id="eq-list">${rows}</div>
    <button onclick="addEditorPregunta()" style="
      width:100%; background:rgba(230,49,102,.08); border:1px dashed rgba(230,49,102,.4);
      border-radius:10px; padding:.6rem; color:#e63166; cursor:pointer; font-size:.85rem;
      margin-top:.4rem;
    ">+ Agregar pregunta</button>
  `, saveEditorPreguntas);
}

window.deleteEditorPregunta = function(i) {
  const rows = document.querySelectorAll('.eq-row');
  if (rows[i]) rows[i].remove();
  // Re-numerar
  document.querySelectorAll('.eq-row').forEach((r, idx) => {
    r.dataset.index = idx;
    const num = r.querySelector('span');
    if (num) num.textContent = idx + 1;
    // Re-nombrar radios
    r.querySelectorAll('input[type=radio]').forEach(radio => {
      radio.name = `resp${idx}`;
    });
  });
};

window.addEditorPregunta = function() {
  const list = document.getElementById('eq-list');
  const i = list.querySelectorAll('.eq-row').length;
  const div = document.createElement('div');
  div.className = 'eq-row';
  div.dataset.index = i;
  div.style.cssText = 'background:#fafafa; border-radius:12px; padding:.8rem; margin-bottom:.6rem; border:1px solid #eee;';
  div.innerHTML = `
    <div style="display:flex; align-items:center; gap:.5rem; margin-bottom:.4rem;">
      <span style="color:#e63166; font-weight:600; font-size:.8rem; min-width:20px;">${i+1}</span>
      <input class="eq-pregunta" value="" placeholder="Escribe la pregunta…" style="
        flex:1; border:1px solid #ddd; border-radius:8px; padding:.4rem .6rem;
        font-size:.85rem; outline:none;
      "/>
      <button onclick="deleteEditorPregunta(${i})" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:1rem;padding:0;">🗑️</button>
    </div>
    <div style="display:flex; align-items:center; gap:.5rem;">
      <span style="font-size:.75rem; color:#888;">Respuesta correcta:</span>
      <label style="cursor:pointer; font-size:.8rem; display:flex; align-items:center; gap:.3rem;">
        <input type="radio" name="resp${i}" value="si" checked/> Sí
      </label>
      <label style="cursor:pointer; font-size:.8rem; display:flex; align-items:center; gap:.3rem;">
        <input type="radio" name="resp${i}" value="no"/> No
      </label>
    </div>
  `;
  list.appendChild(div);
};

async function saveEditorPreguntas() {
  const rows = document.querySelectorAll('.eq-row');
  const nuevas = [];
  rows.forEach((row, i) => {
    const pregunta = row.querySelector('.eq-pregunta')?.value?.trim();
    const checked  = row.querySelector(`input[name="resp${i}"]:checked`);
    if (pregunta) {
      nuevas.push({ pregunta, respuestaCorrecta: checked?.value || 'si' });
    }
  });

  if (nuevas.length === 0) { showEditorToast('Agrega al menos una pregunta'); return; }

  const ok = await saveEditorData('preguntas', nuevas);
  if (ok) {
    window.preguntas = nuevas;
    window._editorData.preguntas = nuevas;
    initSiNoQuestions();
    renderSiNoQuestion();
    document.getElementById('natito-editor-modal')?.remove();
  }
}

/* ══════════════════════════════════════
   EDITOR: CARTAS OCULTAS (FLIP CARDS)
══════════════════════════════════════ */
function openEditorFlipCards() {
  const defaults = [
    { icono: '💌', titulo: 'Algo que quiero decirte',   texto: document.querySelector('#fc0 .fc-back-text')?.textContent || '' },
    { icono: '🌸', titulo: 'Un momento que no olvido',  texto: document.querySelector('#fc1 .fc-back-text')?.textContent || '' },
    { icono: '🌻', titulo: 'Cosas que me gustan de ti', texto: document.querySelector('#fc2 .fc-back-text')?.textContent || '' },
    { icono: '🤫', titulo: 'Un secreto mío',            texto: document.querySelector('#fc3 .fc-back-text')?.textContent || '' },
    { icono: '💖', titulo: 'Por qué eres especial',     texto: document.querySelector('#fc4 .fc-back-text')?.textContent || '' },
  ];
  const cards = (window._editorData.flipCards && window._editorData.flipCards.length > 0)
    ? window._editorData.flipCards
    : defaults;

  const rows = cards.map((c, i) => `
    <div style="background:#fafafa; border-radius:12px; padding:.8rem; margin-bottom:.8rem; border:1px solid #eee;">
      <div style="display:flex; gap:.5rem; margin-bottom:.4rem; align-items:center;">
        <input class="fc-icono" value="${c.icono||'💌'}" style="
          width:44px; border:1px solid #ddd; border-radius:8px; padding:.3rem;
          font-size:1.1rem; text-align:center; outline:none;
        "/>
        <input class="fc-titulo" value="${escHtml(c.titulo)}" style="
          flex:1; border:1px solid #ddd; border-radius:8px; padding:.4rem .6rem;
          font-size:.85rem; outline:none;
        "/>
      </div>
      <textarea class="fc-texto" rows="3" style="
        width:100%; border:1px solid #ddd; border-radius:8px; padding:.4rem .6rem;
        font-size:.82rem; outline:none; resize:vertical; box-sizing:border-box;
      ">${escHtml(c.texto)}</textarea>
    </div>
  `).join('');

  createEditorModal('Editar cartas ocultas', `
    <p style="font-size:.8rem; color:#888; margin-bottom:.8rem;">
      Edita el icono, título y texto de cada carta.
    </p>
    <div id="fc-list">${rows}</div>
  `, saveEditorFlipCards);
}

async function saveEditorFlipCards() {
  const rows = document.querySelectorAll('#fc-list > div');
  const cards = [];
  rows.forEach(row => {
    cards.push({
      icono:  row.querySelector('.fc-icono')?.value?.trim()  || '💌',
      titulo: row.querySelector('.fc-titulo')?.value?.trim() || '',
      texto:  row.querySelector('.fc-texto')?.value?.trim()  || ''
    });
  });

  const ok = await saveEditorData('flipCards', cards);
  if (ok) {
    window._editorData.flipCards = cards;
    applyFlipCards(cards);
    document.getElementById('natito-editor-modal')?.remove();
  }
}

/* ══════════════════════════════════════
   EDITOR: MINI HISTORIA
══════════════════════════════════════ */
function openEditorStory() {
  const lines = window.storyLines || storyLines;

  const rows = lines.map((l, i) => `
    <div class="sl-row" style="display:flex; gap:.5rem; margin-bottom:.5rem; align-items:center;">
      <span style="color:#e63166; font-size:.8rem; min-width:18px;">${i+1}</span>
      <input class="sl-line" value="${escHtml(l)}" style="
        flex:1; border:1px solid #ddd; border-radius:8px; padding:.4rem .6rem;
        font-size:.85rem; outline:none;
      "/>
      <button onclick="this.closest('.sl-row').remove(); renumberStoryRows();" style="
        background:none; border:none; color:#ccc; cursor:pointer; font-size:1rem;
      ">🗑️</button>
    </div>
  `).join('');

  createEditorModal('Editar mini historia', `
    <p style="font-size:.8rem; color:#888; margin-bottom:.8rem;">
      Cada línea es un paso de la historia. La última tiene el botón "Ver la carta final".
    </p>
    <div id="sl-list">${rows}</div>
    <button onclick="addStoryLine()" style="
      width:100%; background:rgba(230,49,102,.08); border:1px dashed rgba(230,49,102,.4);
      border-radius:10px; padding:.6rem; color:#e63166; cursor:pointer; font-size:.85rem;
      margin-top:.4rem;
    ">+ Agregar línea</button>
  `, saveEditorStory);
}

window.renumberStoryRows = function() {
  document.querySelectorAll('.sl-row').forEach((r, i) => {
    const num = r.querySelector('span');
    if (num) num.textContent = i + 1;
  });
};

window.addStoryLine = function() {
  const list = document.getElementById('sl-list');
  const i = list.querySelectorAll('.sl-row').length;
  const div = document.createElement('div');
  div.className = 'sl-row';
  div.style.cssText = 'display:flex; gap:.5rem; margin-bottom:.5rem; align-items:center;';
  div.innerHTML = `
    <span style="color:#e63166; font-size:.8rem; min-width:18px;">${i+1}</span>
    <input class="sl-line" value="" placeholder="Escribe la línea…" style="
      flex:1; border:1px solid #ddd; border-radius:8px; padding:.4rem .6rem;
      font-size:.85rem; outline:none;
    "/>
    <button onclick="this.closest('.sl-row').remove(); renumberStoryRows();" style="
      background:none; border:none; color:#ccc; cursor:pointer; font-size:1rem;
    ">🗑️</button>
  `;
  list.appendChild(div);
};

async function saveEditorStory() {
  const inputs = document.querySelectorAll('.sl-line');
  const lines  = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
  if (lines.length === 0) { showEditorToast('Agrega al menos una línea'); return; }

  const ok = await saveEditorData('storyLines', lines);
  if (ok) {
    window.storyLines = lines;
    window._editorData.storyLines = lines;
    // Reiniciar historia si está en esa pantalla
    if (document.getElementById('story-screen')?.classList.contains('active')) {
      initStory();
    }
    document.getElementById('natito-editor-modal')?.remove();
  }
}

/* ══════════════════════════════════════
   EDITOR: IMAGEN DEL ROMPECABEZAS
══════════════════════════════════════ */
async function openEditorPuzzle() {
  // Cargar fotos de Firestore para elegir
  let fotosHtml = '<p style="color:#aaa; font-size:.82rem;">Cargando fotos…</p>';

  createEditorModal('Cambiar imagen del rompecabezas', `
    <p style="font-size:.8rem; color:#888; margin-bottom:.8rem;">
      Elige una foto del álbum o pega una URL directa (ImgBB, etc).
    </p>
    <div style="margin-bottom:.8rem;">
      <label style="font-size:.82rem; color:#666; display:block; margin-bottom:.3rem;">URL de imagen directa:</label>
      <input id="puzzle-img-url" value="${window._puzzleImageUrl || 'img/foto1.jpg'}" style="
        width:100%; border:1px solid #ddd; border-radius:8px; padding:.5rem .7rem;
        font-size:.85rem; outline:none; box-sizing:border-box;
      " oninput="updatePuzzlePreview(this.value)"/>
    </div>
    <div id="puzzle-preview-wrap" style="text-align:center; margin-bottom:.8rem;">
      <img id="puzzle-img-preview" src="${window._puzzleImageUrl || 'img/foto1.jpg'}"
        style="max-width:100%; max-height:160px; border-radius:12px; border:2px solid #eee;"/>
    </div>
    <p style="font-size:.8rem; color:#888; margin-bottom:.5rem;">O elige del álbum:</p>
    <div id="puzzle-foto-grid" style="
      display:grid; grid-template-columns:repeat(3,1fr); gap:.5rem; max-height:200px; overflow-y:auto;
    ">
      <p style="color:#aaa; font-size:.8rem; grid-column:1/-1;">Cargando…</p>
    </div>
  `, saveEditorPuzzle);

  window.updatePuzzlePreview = function(url) {
    const img = document.getElementById('puzzle-img-preview');
    if (img) img.src = url;
  };

  // Cargar fotos de Firestore
  try {
    const snap = await db.collection('fotos').orderBy('fecha', 'desc').limit(18).get();
    const grid = document.getElementById('puzzle-foto-grid');
    if (grid) {
      if (snap.empty) {
        grid.innerHTML = '<p style="color:#aaa; font-size:.8rem; grid-column:1/-1;">No hay fotos subidas aún.</p>';
      } else {
        grid.innerHTML = '';
        snap.forEach(doc => {
          const data = doc.data();
          const div  = document.createElement('div');
          div.style.cssText = 'cursor:pointer; border-radius:8px; overflow:hidden; border:2px solid transparent; transition:border-color .2s;';
          div.innerHTML = `<img src="${data.url}" style="width:100%; aspect-ratio:1; object-fit:cover;" loading="lazy"/>`;
          div.onclick = () => {
            // Marcar seleccionada
            grid.querySelectorAll('div').forEach(d => d.style.borderColor = 'transparent');
            div.style.borderColor = '#e63166';
            const urlInput = document.getElementById('puzzle-img-url');
            if (urlInput) { urlInput.value = data.url; updatePuzzlePreview(data.url); }
          };
          grid.appendChild(div);
        });
      }
    }
  } catch (err) {
    console.warn('No se pudieron cargar fotos para puzzle:', err);
  }
}

async function saveEditorPuzzle() {
  const url = document.getElementById('puzzle-img-url')?.value?.trim();
  if (!url) { showEditorToast('Pon una URL válida'); return; }

  const ok = await saveEditorData('puzzleImage', url);
  if (ok) {
    window._puzzleImageUrl = url;
    window._editorData.puzzleImage = url;
    // Re-render puzzle si está activo
    if (document.getElementById('puzzle-screen')?.classList.contains('active')) {
      if (typeof initPuzzle === 'function') initPuzzle();
    }
    document.getElementById('natito-editor-modal')?.remove();
  }
}

/* ══════════════════════════════════════
   HELPER: escapar HTML
══════════════════════════════════════ */
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ══════════════════════════════════════
   PATCH: renderPuzzle usa _puzzleImageUrl
══════════════════════════════════════ */
const _origInitPuzzle = window.initPuzzle;
window.initPuzzle = function() {
  if (typeof _origInitPuzzle === 'function') _origInitPuzzle();
};

// Patch en renderPuzzle para usar imagen dinámica
const _origRenderPuzzle = window.renderPuzzle;
window.renderPuzzle = function(size) {
  if (typeof _origRenderPuzzle === 'function') _origRenderPuzzle(size);
  // Reemplazar imagen si hay una personalizada
  if (window._puzzleImageUrl) {
    document.querySelectorAll('.puzzle-cell').forEach(cell => {
      cell.style.backgroundImage = `url("${window._puzzleImageUrl}")`;
    });
  }
};

/* ══════════════════════════════════════
   INIT — llamar desde firebase-integration
   cuando se confirma que es natito
══════════════════════════════════════ */
window.initNatitoEditor = async function() {
  await loadEditorData();
  injectEditorButton();
};
