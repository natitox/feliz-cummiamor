/* ═══════════════════════════════════════════════════════
   script.js — Carta Romántica Digital (v3 — Email completo)
   Tracking: intentos candado, preguntas sí/no, elige opción,
   porcentaje, flujo completo
═══════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════
   CONFIGURACIÓN — EDITA AQUÍ
═══════════════════════════════════════ */
const CONFIG = {
  PIN: '7395',

  EMAILJS_SERVICE_ID:  'service_60wzk5j',   // ← tu service ID
  EMAILJS_TEMPLATE_ID: 'template_50p5kvb',  // ← tu template ID
  EMAILJS_PUBLIC_KEY:  'lQgzaPl2y_KEiVQaB',  // ← tu public key
  YOUTUBE_IDS: [
    'uEcKk2U_U7A',
    'Q4Js9OEODHM',
    'sXR93C_bSVk',
    'J_8xCOSekog',
    '-7a49quIQQc'
  ],

  MP3_FILES: [
    'music/cancion1.mp3',
    'music/cancion2.mp3',
    'music/cancion3.mp3',
    'music/cancion4.mp3',
    'music/cancion5.mp3',
    'music/cancion6.mp3',
    'music/cancion7.mp3',
    'music/cancion8.mp3',
    'music/cancion9.mp3',
    'music/cancion10.mp3'
  ],

  SONG_NAMES: [
    'Nuestra canción 1',
    'Nuestra canción 2',
    'Nuestra canción 3',
    'Nuestra canción 4',
    'Nuestra canción 5',
    'Nuestra canción 6',
    'Nuestra canción 7',
    'Nuestra canción 8',
    'Nuestra canción 9',
    'Nuestra canción 10'
  ]
};

/* ═══════════════════════════════════════
   DATOS — PREGUNTAS SÍ/NO
═══════════════════════════════════════ */
const preguntas = [
  { pregunta: "¿Natito te ve en un futuro? ", respuestaCorrecta: "si" },
  { pregunta: "¿Natito comería un plato enorme de verduras con arroz? ", respuestaCorrecta: "si" },
  { pregunta: "¿Natito te incluiría en la mayoria de sus planes? 📆", respuestaCorrecta: "si" },
  { pregunta: "¿Natito prefiere juegos de estrategia antes que shooters¿? 🎧", respuestaCorrecta: "no" },
  { pregunta: "¿Natito te compraria medicamentos si enfermas¿ 💊", respuestaCorrecta: "si" },
  { pregunta: "¿Natito puede ver una serie sin distraerse? ", respuestaCorrecta: "no" },
  { pregunta: "¿Natito le cuesta decir lo que siente? 🥺", respuestaCorrecta: "si" },
  { pregunta: "¿Natito haria lo posible por verte aun que sea un ratito? 📺", respuestaCorrecta: "si" },
  { pregunta: "¿Natito te cocinaria siempre? ", respuestaCorrecta: "si" },
  { pregunta: "¿Natito daría la vida por ti? ", respuestaCorrecta: "si" }
];


/* ═══════════════════════════════════════
   MINI HISTORIA — LÍNEAS
═══════════════════════════════════════ */
const storyLines = [
  "Si llegaste hasta aquí…",
  "Significa que me amas muxo… 🥺",
  "Pero aún falta lo más importante…",
  "Una última cosa para ti… 💌"
];

/* ═══════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════ */
const state = {
  currentSong: 0,
  isPlaying: false,
  musicExpanded: true,

  // ── DATOS PARA EL EMAIL ──
  answers: {
    intentosCandado: 0,     // cuántas veces se equivocó en el candado
    detalleSiNo: [],        // ['si','no','si',...] — respuesta dada en cada pregunta
    porcentajeSiNo: 0,      // resultado final del juego sí/no
    detalleElige: [],       // [{pregunta, respuesta, correcto}] por cada pregunta
    flujoCompleto: false    // true cuando llega a la carta final
  },

  // Candado
  keypadValue: '',

  // Sí/No
  qIndex: 0,
  qCorrectas: 0,

  // Elige opción
  chooseIndex: 0,

  // Cartas ocultas
  cardsFlipped: 0,

  // Rompecabezas
  puzzlePieces: [],
  puzzleSelected: null,
  puzzleSolved: false,

  // Mini historia
  storyIndex: 0
};

/* ═══════════════════════════════════════
   INICIALIZACIÓN
═══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: CONFIG.EMAILJS_PUBLIC_KEY });
  }

  createParticles();
  updatePlaylistNames();
  initSiNoQuestions();
});

/* ═══════════════════════════════════════
   NAVEGACIÓN ENTRE PANTALLAS
═══════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

window.goToPhase = function(screenId) {
  if (screenId === 'story-screen') initStory();
  if (screenId === 'memory-screen' && typeof initMemoryGame === 'function') initMemoryGame();
  if (screenId === 'sort-screen'   && typeof initSortGame    === 'function') initSortGame();
  if (screenId === 'equiz-screen'  && typeof initEmotionalQuiz === 'function') initEmotionalQuiz();
   if (screenId === 'puzzle-screen') initPuzzle();  // ← agrega esto si no está
  showScreen(screenId);
};

/* ═══════════════════════════════════════
   PARTÍCULAS FLOTANTES
═══════════════════════════════════════ */
function createParticles() {
  const container = document.getElementById('particles-container');
  if (!container) return;
  const emojis = ['❤️','💕','💖','💗','💓','🌸','✨','💝','🌹','💞'];
  const count = window.innerWidth < 600 ? 8 : 14;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'heart-particle';
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.left = Math.random() * 100 + '%';
    p.style.fontSize = (0.6 + Math.random() * 1.2) + 'rem';
    p.style.animationDuration = (10 + Math.random() * 16) + 's';
    p.style.animationDelay = (Math.random() * 14) + 's';
    container.appendChild(p);
  }
}

/* ═══════════════════════════════════════
   PANTALLA 0: SOBRE DE BIENVENIDA
═══════════════════════════════════════ */
function openEnvelope() {
  const envelope = document.getElementById('welcome-envelope');
  const flap     = document.getElementById('envelope-flap');
  const letter   = document.getElementById('envelope-letter');
  if (!envelope || envelope.classList.contains('opening')) return;

  envelope.classList.add('opening');
  if (flap)   flap.classList.add('open');
  if (letter) letter.classList.add('rise');

  setTimeout(() => showScreen('lock-screen'), 900);
}

/* ═══════════════════════════════════════
   PANTALLA 1: CANDADO — TECLADO EMOJI
   Tracking: cuenta cada intento fallido
═══════════════════════════════════════ */
function keypadPress(digit) {
  if (state.keypadValue.length >= 4) return;
  state.keypadValue += digit;
  updateKeypadDisplay();
  if (state.keypadValue.length === 4) setTimeout(checkPin, 300);
}

function keypadDelete() {
  state.keypadValue = state.keypadValue.slice(0, -1);
  updateKeypadDisplay();
  const err = document.getElementById('lock-error');
  if (err) err.classList.remove('visible');
}

function updateKeypadDisplay() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('kd' + i);
    if (!dot) continue;
    dot.classList.toggle('filled', i < state.keypadValue.length);
  }
}

function checkPin() {
  const err = document.getElementById('lock-error');
  if (state.keypadValue === CONFIG.PIN) {
    unlockSuccess();
  } else {
    // ── TRACKING: sumar intento fallido ──
    state.answers.intentosCandado++;

    if (err) err.classList.add('visible');
    const card = document.querySelector('.lock-card');
    if (card) {
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 450);
    }
    state.keypadValue = '';
    updateKeypadDisplay();
  }
}

function unlockSuccess() {
  const lockIcon = document.getElementById('lock-icon');
  const lockFa   = document.getElementById('lock-fa');
  const err      = document.getElementById('lock-error');

  if (err)      err.classList.remove('visible');
  if (lockFa)   lockFa.classList.replace('fa-lock', 'fa-lock-open');
  if (lockIcon) lockIcon.classList.add('unlocking');

  setTimeout(() => {
    showScreen('questions-screen');
    renderSiNoQuestion();
  }, 850);
}

/* ═══════════════════════════════════════
   PANTALLA 2: PREGUNTAS SÍ / NO
   Tracking: guarda cada respuesta + porcentaje final
═══════════════════════════════════════ */
function initSiNoQuestions() {
  state.qIndex             = 0;
  state.qCorrectas         = 0;
  state.answers.detalleSiNo = [];
}

function renderSiNoQuestion() {
  const q = preguntas[state.qIndex];
  if (!q) return;

  const textEl    = document.getElementById('q-sinno-text');
  const counterEl = document.getElementById('q-counter');
  const barEl     = document.getElementById('q-progress-bar');
  const card      = document.getElementById('q-sinno');

  if (textEl)    textEl.textContent    = q.pregunta;
  if (counterEl) counterEl.textContent = `${state.qIndex + 1} / ${preguntas.length}`;
  if (barEl)     barEl.style.width     = ((state.qIndex / preguntas.length) * 100) + '%';

  if (card) {
    card.style.opacity   = '0';
    card.style.transform = 'translateY(20px) scale(.97)';
    requestAnimationFrame(() => {
      setTimeout(() => {
        card.style.transition = 'opacity .35s ease, transform .35s ease';
        card.style.opacity    = '1';
        card.style.transform  = 'translateY(0) scale(1)';
      }, 40);
    });
  }
}

function responderSiNo(resp) {
  const q = preguntas[state.qIndex];
  if (!q) return;

  // ── TRACKING: guardar respuesta dada ──
  state.answers.detalleSiNo.push(resp);

  if (resp === q.respuestaCorrecta) state.qCorrectas++;
  state.qIndex++;

  if (state.qIndex < preguntas.length) {
    const card = document.getElementById('q-sinno');
    if (card) {
      card.style.transition = 'opacity .25s ease, transform .25s ease';
      card.style.opacity    = '0';
      card.style.transform  = 'translateY(-20px) scale(.97)';
    }
    setTimeout(renderSiNoQuestion, 300);
  } else {
    mostrarResultado();
  }
}

function mostrarResultado() {
  const sinnoCard     = document.getElementById('q-sinno');
  const resultadoCard = document.getElementById('q-resultado');

  if (sinnoCard)     sinnoCard.style.display = 'none';
  if (resultadoCard) {
    resultadoCard.style.display = 'block';
    requestAnimationFrame(() => resultadoCard.classList.add('active'));
  }

  const porcentaje = Math.round((state.qCorrectas / preguntas.length) * 100);

  // ── TRACKING: guardar porcentaje ──
  state.answers.porcentajeSiNo = porcentaje;

  const textoEl = document.getElementById('q-resultado-texto');
  const fillEl  = document.getElementById('percent-bar-fill');
  const numEl   = document.getElementById('percent-num');
  const btnWrap = document.getElementById('q-resultado-btn-wrap');

  if (textoEl) textoEl.textContent = `Acertaste un: ${porcentaje}% 💖`;

  const color = porcentaje >= 70 ? '#27ae60' : porcentaje >= 50 ? '#f1c40f' : '#e63166';

  if (fillEl) {
    fillEl.style.background = color;
    fillEl.style.width = '0%';
    setTimeout(() => {
      fillEl.style.transition = 'width 1.2s cubic-bezier(.22,.61,.36,1)';
      fillEl.style.width = porcentaje + '%';
    }, 200);
  }

  if (numEl) animatePercent(numEl, porcentaje);

  if (btnWrap) {
    if (porcentaje >= 70) {
      btnWrap.innerHTML = `<button class="btn-romantic" onclick="goToPhase('memory-screen');">
        <i class="fa-solid fa-gamepad me-2"></i>Siguiente: ¡Adivina! 🎯
      </button>`;
    } else {
      btnWrap.innerHTML = `<button class="btn-romantic" onclick="reiniciarSiNo()">
        <i class="fa-solid fa-rotate-left me-2"></i>Reintentar
      </button>`;
    }
  }
}

function animatePercent(el, target) {
  let current = 0;
  const step  = Math.ceil(target / 60);
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current + '%';
    if (current >= target) clearInterval(interval);
  }, 20);
}

function reiniciarSiNo() {
  state.qIndex             = 0;
  state.qCorrectas         = 0;
  state.answers.detalleSiNo = [];

  const sinnoCard     = document.getElementById('q-sinno');
  const resultadoCard = document.getElementById('q-resultado');

  if (resultadoCard) { resultadoCard.classList.remove('active'); resultadoCard.style.display = 'none'; }
  if (sinnoCard)     { sinnoCard.style.display = 'block'; sinnoCard.style.opacity = '1'; sinnoCard.style.transform = 'none'; }

  const barEl = document.getElementById('q-progress-bar');
  if (barEl) barEl.style.width = '0%';

  renderSiNoQuestion();
}



/* ═══════════════════════════════════════
   PANTALLA 4: CARTAS OCULTAS
═══════════════════════════════════════ */
function flipCard(index) {
  const card = document.getElementById('fc' + index);
  if (!card || card.classList.contains('flipped')) return;

  card.classList.add('flipped');
  state.cardsFlipped++;

  const progressEl = document.getElementById('cards-progress-txt');
  if (progressEl) progressEl.textContent = `${state.cardsFlipped} / 5 reveladas`;

  if (state.cardsFlipped === 5) {
    setTimeout(() => {
      const unlockWrap = document.getElementById('cards-unlock-wrap');
      if (unlockWrap) { unlockWrap.style.display = 'block'; unlockWrap.style.animation = 'fadeInUp .5s ease forwards'; }
    }, 600);
  }
}

/* ═══════════════════════════════════════
   SALTAR QUIZ — ir directo a la carta
═══════════════════════════════════════ */
/* ═══════════════════════════════════════
   SALTAR QUIZ CON CLAVE SECRETA
═══════════════════════════════════════ */
window.skipToLetter = function() {

  const clave = prompt("🔑 Ingresa la clave para saltar el quiz:");

  if (!clave) return;

  if (clave === "2603") {

    state.answers.flujoCompleto = true;

    showScreen('final-letter-screen');
    animateFinalLetter();
    showMusicControls();

    setTimeout(playRandomSong, 800);

  } else {

    alert("❌ Clave incorrecta");

  }

};
/* ═══════════════════════════════════════
   PANTALLA 5: ROMPECABEZAS
═══════════════════════════════════════ */
function initPuzzle() {
  const grid = document.getElementById('puzzle-grid');
  if (!grid) return;

  const size  = 5;
  state.puzzlePieces   = Array.from({ length: size * size }, (_, i) => i);
  shuffleArray(state.puzzlePieces);
  state.puzzleSelected = null;
  state.puzzleSolved   = false;
  state.puzzleSize     = size;
  renderPuzzle(size);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function renderPuzzle(size) {
  const grid = document.getElementById('puzzle-grid');
  if (!grid) return;

  const cellPx = Math.min(89, Math.floor((window.innerWidth - 16) / size));
  grid.innerHTML = '';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${size}, ${cellPx}px)`;
  grid.style.width  = (cellPx * size) + 'px';
  grid.style.margin = '0 auto';
  grid.style.gap    = '2px';

  state.puzzlePieces.forEach((pieceIndex, position) => {
    const cell = document.createElement('div');
    cell.className = 'puzzle-cell';
    cell.dataset.position = position;

    const row    = Math.floor(pieceIndex / size);
    const col    = pieceIndex % size;
    const bgPosX = size === 1 ? 0 : (col / (size - 1)) * 100;
    const bgPosY = size === 1 ? 0 : (row / (size - 1)) * 100;

    cell.style.width               = cellPx + 'px';
   cell.style.height              = cellPx + 'px';
   cell.style.backgroundImage = 'url("img/enamoradito.jpg")';
   cell.style.backgroundSize      = `${size * 100}% ${size * 100}%`;
   cell.style.backgroundRepeat    = 'no-repeat';
   cell.style.backgroundPositionX = `${bgPosX}%`;
   cell.style.backgroundPositionY = `${bgPosY}%`;

    cell.onclick = () => handlePuzzleClick(position);
    grid.appendChild(cell);
  });
}

function handlePuzzleClick(position) {
  if (state.puzzleSolved) return;
  const cells = document.querySelectorAll('.puzzle-cell');

  if (state.puzzleSelected === null) {
    state.puzzleSelected = position;
    cells[position].classList.add('puzzle-selected');
  } else {
    if (state.puzzleSelected === position) {
      cells[position].classList.remove('puzzle-selected');
      state.puzzleSelected = null;
      return;
    }
    cells[state.puzzleSelected].classList.remove('puzzle-selected');
    const tmp = state.puzzlePieces[state.puzzleSelected];
    state.puzzlePieces[state.puzzleSelected] = state.puzzlePieces[position];
    state.puzzlePieces[position] = tmp;
    state.puzzleSelected = null;
    renderPuzzle(state.puzzleSize || 5);
    checkPuzzleSolved();
  }
}

function checkPuzzleSolved() {
  if (!state.puzzlePieces.every((p, i) => p === i)) return;

  state.puzzleSolved = true;
  document.querySelectorAll('.puzzle-cell').forEach(c => c.classList.add('puzzle-solved'));

  const msgEl = document.getElementById('puzzle-msg');
  if (msgEl) { msgEl.textContent = 'Si llegaste hasta aquí significa que me amas muxo :3 💖'; msgEl.classList.add('puzzle-msg-show'); }

  setTimeout(() => {
    const unlockWrap = document.getElementById('puzzle-unlock-wrap');
    if (unlockWrap) unlockWrap.style.display = 'block';
  }, 1200);
}

/* ═══════════════════════════════════════
   PANTALLA 6: MINI HISTORIA
═══════════════════════════════════════ */
function initStory() {
  state.storyIndex = 0;
  renderStoryLine();
}

function renderStoryLine() {
  const lineEl = document.getElementById('story-line');
  const btnEl  = document.getElementById('story-btn');
  if (!lineEl) return;

  const line = storyLines[state.storyIndex];
  lineEl.style.opacity   = '0';
  lineEl.style.transform = 'translateY(10px)';

  setTimeout(() => {
    lineEl.textContent      = line;
    lineEl.style.transition = 'opacity .5s ease, transform .5s ease';
    lineEl.style.opacity    = '1';
    lineEl.style.transform  = 'none';
  }, 100);

  const isLast = state.storyIndex >= storyLines.length - 1;
  if (btnEl) {
    btnEl.innerHTML = isLast
      ? 'Ver la carta final 💌 <i class="fa-solid fa-arrow-right ms-1"></i>'
      : 'Continuar <i class="fa-solid fa-arrow-right ms-1"></i>';
  }
}

function nextStoryLine() {
  state.storyIndex++;
  if (state.storyIndex < storyLines.length) {
    renderStoryLine();
  } else {
    showScreen('final-letter-screen');
    animateFinalLetter();
    showMusicControls();
    setTimeout(playRandomSong, 800);

    // ── TRACKING: flujo completo → enviar email ──
    state.answers.flujoCompleto = true;
    sendAnswersByEmail();
  }
}

/* ═══════════════════════════════════════
   PANTALLA 7: CARTA FINAL
═══════════════════════════════════════ */
function animateFinalLetter() {
  const card = document.getElementById('final-letter-card');
  if (!card) return;
  card.style.opacity   = '0';
  card.style.transform = 'translateY(40px) scale(.95)';
  setTimeout(() => {
    card.style.transition = 'opacity .8s ease, transform .8s cubic-bezier(.22,.61,.36,1)';
    card.style.opacity    = '1';
    card.style.transform  = 'none';
  }, 150);
  launchConfetti();
}

function goToMainLetter() {
  showScreen('letter-screen');
  showMusicControls();
  setTimeout(() => { launchConfetti(); initScrollReveal(); }, 500);
}

function goToLetter() {
  showScreen('letter-screen');
  showMusicControls();
  setTimeout(() => { launchConfetti(); initScrollReveal(); playRandomSong(); }, 500);
}

/* ═══════════════════════════════════════
   EMAILJS — ENVIAR TODAS LAS RESPUESTAS
   ─────────────────────────────────────
   Variables para tu template en emailjs.com:
     {{intentos_candado}}   → intentos fallidos en el candado
     {{porcentaje_sinno}}   → porcentaje del juego sí/no
     {{detalle_sinno}}      → respuesta por pregunta sí/no
     {{detalle_elige}}      → respuestas del juego elige opción
     {{flujo_completo}}     → si llegó al final o no
     {{fecha_hora}}         → fecha y hora (hora Chile)
═══════════════════════════════════════ */
function sendAnswersByEmail() {
  if (typeof emailjs === 'undefined') return;

  // ── Intentos candado ──
  const intentos    = state.answers.intentosCandado;
  const intentosTxt = intentos === 0
    ? '¡Lo abrió al primer intento! 🎉'
    : `Se equivocó ${intentos} vez${intentos > 1 ? 'es' : ''} antes de acertar 🔐`;

  // ── Detalle preguntas sí/no ──
  const detalleRespuestas = state.answers.detalleSiNo.length > 0
    ? state.answers.detalleSiNo
        .map((respDada, i) => {
          const q      = preguntas[i];
          const acerto = respDada === q.respuestaCorrecta ? '✅' : '❌';
          return `${acerto} ${q.pregunta}\n   Respondió: ${respDada.toUpperCase()} | Correcta: ${q.respuestaCorrecta.toUpperCase()}`;
        })
        .join('\n\n')
    : 'No completó las preguntas';

  // ── Detalle elige la opción ──
  const detalleElige = state.answers.detalleElige.length > 0
    ? state.answers.detalleElige
        .map(r => {
          const icono = r.correcto ? '✅' : '❌';
          return `${icono} ${r.pregunta}\n   Eligió: "${r.respuesta}"`;
        })
        .join('\n\n')
    : 'No llegó a esta sección';

  const params = {
    intentos_candado: intentosTxt,
    porcentaje_sinno: state.answers.porcentajeSiNo + '%',
    detalle_sinno:    detalleRespuestas,
    detalle_elige:    detalleElige,
    flujo_completo:   state.answers.flujoCompleto
                        ? '🎉 ¡Completó todo el flujo!'
                        : '⏳ No llegó al final todavía',
    fecha_hora:       new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })
  };

  emailjs.send(
    CONFIG.EMAILJS_SERVICE_ID,
    CONFIG.EMAILJS_TEMPLATE_ID,
    params
  ).then(() => {
    showToast('💌 Respuestas enviadas con amor');
  }).catch(err => {
    console.warn('EmailJS error:', err);
  });
}

/* ═══════════════════════════════════════
   CONFETTI
═══════════════════════════════════════ */
function launchConfetti() {
  const area = document.getElementById('confetti-area');
  if (!area) return;

  const colors = ['#ff85a1','#ffb3c6','#ffd6e7','#e63166','#c9184a','#fce4ec','#fff'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-piece';
    c.style.left              = (Math.random() * 100) + '%';
    c.style.top               = (Math.random() * 40) + '%';
    c.style.background        = colors[Math.floor(Math.random() * colors.length)];
    c.style.width             = (6 + Math.random() * 8) + 'px';
    c.style.height            = (6 + Math.random() * 8) + 'px';
    c.style.borderRadius      = Math.random() > .5 ? '50%' : '2px';
    c.style.animationDuration = (1 + Math.random() * 1.5) + 's';
    c.style.animationDelay    = (Math.random() * .8) + 's';
    area.appendChild(c);
  }
  setTimeout(() => { if (area) area.innerHTML = ''; }, 3500);
}

/* ═══════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════ */
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

/* ═══════════════════════════════════════
   REPRODUCTOR DE MÚSICA
═══════════════════════════════════════ */
function updatePlaylistNames() {
  document.querySelectorAll('.playlist-item').forEach((item, i) => {
    const icon = item.querySelector('i');
    if (icon) { item.innerHTML = ''; item.appendChild(icon.cloneNode(true)); item.append(CONFIG.SONG_NAMES[i] || 'Canción ' + (i + 1)); }
  });
}

function showMusicControls() {
  const player   = document.getElementById('music-player');
  const floatBtn = document.getElementById('music-float-btn');
  if (player)   player.style.display   = 'block';
  if (floatBtn) floatBtn.style.display = 'none';
}

function openMusicPlayer() {
  const player   = document.getElementById('music-player');
  const floatBtn = document.getElementById('music-float-btn');
  if (player)   player.style.display   = 'block';
  if (floatBtn) floatBtn.style.display = 'none';
}

function toggleMusicExpand() {
  const body    = document.getElementById('music-body');
  const chevron = document.getElementById('music-chevron');
  if (!body) return;
  state.musicExpanded = !state.musicExpanded;
  body.classList.toggle('collapsed', !state.musicExpanded);
  if (chevron) chevron.classList.toggle('rotated', !state.musicExpanded);
}

function playSong(index) {
  const ids  = CONFIG.YOUTUBE_IDS;
  const mp3s = CONFIG.MP3_FILES || [];
  if (index < 0 || index >= ids.length) return;

  state.currentSong = index;
  state.isPlaying   = true;

  document.querySelectorAll('.playlist-item').forEach((item, i) => item.classList.toggle('active', i === index));

  const mp3path = mp3s[index] || '';
  const wrapper = document.getElementById('yt-wrapper');
  const iframe  = document.getElementById('yt-iframe');
  const audioEl = document.getElementById('mp3-player');

  if (mp3path) {
    if (wrapper) wrapper.style.display = 'none';
    if (iframe)  iframe.src = '';
    if (audioEl) { audioEl.src = mp3path; audioEl.style.display = 'block'; audioEl.play().catch(() => {}); }
  } else {
    if (audioEl) { audioEl.pause(); audioEl.style.display = 'none'; }
    if (wrapper && iframe) { wrapper.style.display = 'block'; iframe.src = `https://www.youtube.com/embed/${ids[index]}?autoplay=1&enablejsapi=1`; }
  }

  const icon = document.getElementById('play-icon');
  if (icon) icon.classList.replace('fa-play', 'fa-pause');
}

function togglePlay() {
  const audioEl = document.getElementById('mp3-player');
  if (!state.isPlaying) {
    playSong(state.currentSong);
  } else {
    if (audioEl && !audioEl.paused) audioEl.pause();
    const iframe  = document.getElementById('yt-iframe');
    const wrapper = document.getElementById('yt-wrapper');
    if (iframe)  iframe.src = '';
    if (wrapper) wrapper.style.display = 'none';
    const icon = document.getElementById('play-icon');
    if (icon) icon.classList.replace('fa-pause', 'fa-play');
    state.isPlaying = false;
  }
}

function nextSong() { playSong((state.currentSong + 1) % CONFIG.YOUTUBE_IDS.length); }
function prevSong() { playSong((state.currentSong - 1 + CONFIG.YOUTUBE_IDS.length) % CONFIG.YOUTUBE_IDS.length); }
function playRandomSong() { setTimeout(() => playSong(Math.floor(Math.random() * CONFIG.YOUTUBE_IDS.length)), 800); }

/* ═══════════════════════════════════════
   TABS (carta / álbum)
═══════════════════════════════════════ */
function showTab(tabId, el) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');

  const carta = document.getElementById('tab-carta');
  const album = document.getElementById('tab-album');

  if (tabId === 'album') {
    if (carta) carta.style.display = 'none';
    if (album) { album.style.display = 'block'; setTimeout(() => initAlbumAnimations(), 60); }
  } else {
    if (album) album.style.display = 'none';
    if (carta) carta.style.display = 'block';
  }
}

/* ═══════════════════════════════════════
   TOAST NOTIFICACIÓN
═══════════════════════════════════════ */
function showToast(msg) {
  const toastEl = document.getElementById('love-toast');
  const msgEl   = document.getElementById('toast-msg');
  if (!toastEl) return;
  if (msgEl) msgEl.textContent = msg;
  new bootstrap.Toast(toastEl, { delay: 3500 }).show();
}

/* ═══════════════════════════════════════
   ÁLBUM: LIGHTBOX
═══════════════════════════════════════ */
let lightboxImages = [];
let lightboxIndex  = 0;

function initAlbumAnimations() {
  lightboxImages = Array.from(document.querySelectorAll('.album-item'));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) { setTimeout(() => entry.target.classList.add('revealed'), i * 60); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.1 });
  lightboxImages.forEach(item => observer.observe(item));
}

function openLightbox(el) {
  const lb  = document.getElementById('lightbox');
  const img = document.getElementById('lb-img');
  const cap = document.getElementById('lb-caption');
  if (!lb) return;

  lightboxImages = Array.from(document.querySelectorAll('.album-item'));
  lightboxIndex  = lightboxImages.indexOf(el);
  img.src = el.querySelector('img')?.src || '';
  if (cap) cap.textContent = el.dataset.caption || '';
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}

function lbPrev() { lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length; lbShow(lightboxIndex); }
function lbNext() { lightboxIndex = (lightboxIndex + 1) % lightboxImages.length; lbShow(lightboxIndex); }

function lbShow(i) {
  const el  = lightboxImages[i];
  const img = document.getElementById('lb-img');
  const cap = document.getElementById('lb-caption');
  if (!el || !img) return;
  img.style.opacity = '0';
  setTimeout(() => {
    img.src = el.querySelector('img')?.src || '';
    if (cap) cap.textContent = el.dataset.caption || '';
    img.style.opacity    = '1';
    img.style.transition = 'opacity .3s';
  }, 150);
}

document.addEventListener('keydown', (e) => {
  const lb = document.getElementById('lightbox');
  if (!lb?.classList.contains('open')) return;
  if (e.key === 'ArrowLeft')  lbPrev();
  if (e.key === 'ArrowRight') lbNext();
  if (e.key === 'Escape')     closeLightbox();
});


/* ═══════════════════════════════════════
   TABS EXTENDIDO — soporte para panel
═══════════════════════════════════════ */
(function patchShowTab() {
  const _orig = window.showTab;
  window.showTab = function(tabId, el) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    const carta = document.getElementById('tab-carta');
    const album = document.getElementById('tab-album');
    const panel = document.getElementById('tab-panel');
    [carta, album, panel].forEach(t => { if (t) t.style.display = 'none'; });
    if (tabId === 'album') {
      if (album) { album.style.display = 'block'; setTimeout(() => initAlbumAnimations(), 60); }
    } else if (tabId === 'panel') {
      if (panel) panel.style.display = 'block';
    } else {
      if (carta) carta.style.display = 'block';
    }
  };
})();


/* ═══════════════════════════════════════
   PREVIEW DE FOTO ANTES DE SUBIR
═══════════════════════════════════════ */
window.previewPhoto = function(input) {
  const wrap    = document.getElementById('photo-preview-wrap');
  const preview = document.getElementById('photo-preview');
  const label   = document.getElementById('photo-file-label');
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    if (preview) { preview.src = e.target.result; }
    if (wrap)    { wrap.style.display = 'block'; }
    if (label) {
      const nameSpan = label.querySelector('.file-name-txt');
      if (nameSpan) nameSpan.textContent = file.name;
    }
  };
  reader.readAsDataURL(file);
};
