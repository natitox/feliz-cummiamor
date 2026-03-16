/* ═══════════════════════════════════════════════════════
   script.js — Carta Romántica Digital
   Lógica principal: candado, preguntas, carta, música, EmailJS
═══════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════
   CONFIGURACIÓN — EDITA AQUÍ
═══════════════════════════════════════ */
const CONFIG = {
  PIN: '434',                         // rana=4, sushi=3, verde=4

  // ✉️  EmailJS — reemplaza con tus datos reales
  // 1. Crea cuenta en https://www.emailjs.com/
  // 2. Crea un servicio y una plantilla con las variables:
  //    {{fecha_conocidos}}, {{fecha_primera_vez}}, {{cuanto_amor}}
  // 3. Pega tus IDs aquí:
  EMAILJS_SERVICE_ID:  'service_XXXXXXX',   // ← tu service ID
  EMAILJS_TEMPLATE_ID: 'template_XXXXXXX',  // ← tu template ID
  EMAILJS_PUBLIC_KEY:  'XXXXXXXXXXXXXXXXX',  // ← tu public key

  // 🎵 IDs de YouTube (puedes añadir más)
  YOUTUBE_IDS: [
    'uEcKk2U_U7A',
    'Q4Js9OEODHM',
    'sXR93C_bSVk',
    'J_8xCOSekog',
    '-7a49quIQQc'
  ],

  // 🎵 MP3 locales — si existe el archivo, se usa en vez de YouTube (sin anuncios)
  // Ponés los .mp3 en la carpeta  music/  junto a los HTML
  // Si no tenés el MP3 de una canción, dejá el valor como  ''
  MP3_FILES: [
    'music/cancion1.mp3',   // si existe, reemplaza YouTube para canción 1
    'music/cancion2.mp3',   // canción 2
    'music/cancion3.mp3',   // canción 3
    'music/cancion4.mp3',   // canción 4
    'music/cancion5.mp3'    // canción 5
  ],

  // Nombres de las canciones (mismo orden)
  SONG_NAMES: [
    'Nuestra canción 1',
    'Nuestra canción 2',
    'Nuestra canción 3',
    'Nuestra canción 4',
    'Nuestra canción 5',
    'Nuestra canción 6',
    'Nuestra canción 7'
    
  ]
};

/* ═══════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════ */
const state = {
  currentSong: 0,
  isPlaying: false,
  musicExpanded: true,
  answers: {
    whenMet: '',
    firstSeen: '',
    howMuch: 5
  }
};

/* ═══════════════════════════════════════
   INICIALIZACIÓN
═══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar EmailJS
  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: CONFIG.EMAILJS_PUBLIC_KEY });
  }

  createParticles();
  initPinInputs();
  initHearts(5);
  updatePlaylistNames();

  // Si ya pasó el lock (sessionStorage), ir directo a la carta
  if (sessionStorage.getItem('unlocked') === 'true') {
    showScreen('letter-screen');
    showMusicControls();
    launchConfetti();
    playRandomSong();
  }
});

/* ═══════════════════════════════════════
   PANTALLA 0: SOBRE DE BIENVENIDA
═══════════════════════════════════════ */
function openEnvelope() {
  const envelope = document.getElementById('welcome-envelope');
  const flap = document.getElementById('envelope-flap');
  const letter = document.getElementById('envelope-letter');
  if (!envelope || envelope.classList.contains('opening')) return;

  envelope.classList.add('opening');
  if (flap) flap.classList.add('open');
  if (letter) letter.classList.add('rise');

  setTimeout(() => {
    showScreen('lock-screen');
    const boxes = document.querySelectorAll('.pin-box');
    if (boxes.length) boxes[0].focus();
  }, 900);
}

/* ═══════════════════════════════════════
   PARTÍCULAS FLOTANTES (corazones)
═══════════════════════════════════════ */
function createParticles() {
  const container = document.getElementById('particles-container');
  if (!container) return;

  const emojis = ['❤️','💕','💖','💗','💓','🌸','✨','💝','🌹','💞'];
  const count = window.innerWidth < 600 ? 14 : 22;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'heart-particle';
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.left = Math.random() * 100 + '%';
    p.style.fontSize = (0.6 + Math.random() * 1.2) + 'rem';
    p.style.animationDuration = (8 + Math.random() * 14) + 's';
    p.style.animationDelay = (Math.random() * 12) + 's';
    container.appendChild(p);
  }
}

/* ═══════════════════════════════════════
   PANTALLA 1: PIN / CANDADO
═══════════════════════════════════════ */
function initPinInputs() {
  const boxes = document.querySelectorAll('.pin-box');
  if (!boxes.length) return;

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '');          // Solo dígitos
      if (box.value && i < boxes.length - 1) {
        boxes[i + 1].focus();
      }
      // Auto-verificar cuando se complete el último dígito (3)
      if (i === boxes.length - 1 && box.value) {
        checkPin();
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        boxes[i - 1].focus();
      }
    });
  });

  // Foco automático al primer box
  boxes[0].focus();

  // Botón desbloquear
  const btn = document.getElementById('unlock-btn');
  if (btn) btn.addEventListener('click', checkPin);
}

function checkPin() {
  const boxes = document.querySelectorAll('.pin-box');
  const entered = Array.from(boxes).map(b => b.value).join('');

  if (entered.length < 3) return;

  if (entered === CONFIG.PIN) {
    unlockSuccess();
  } else {
    unlockFail();
  }
}

function unlockSuccess() {
  const lockIcon  = document.getElementById('lock-icon');
  const lockFa    = document.getElementById('lock-fa');
  const lockError = document.getElementById('lock-error');

  if (lockError) lockError.classList.remove('visible');

  // Animación del candado
  lockFa.classList.replace('fa-lock', 'fa-lock-open');
  lockIcon.classList.add('unlocking');

  // Guardar sesión
  sessionStorage.setItem('unlocked', 'true');

  // Ir a preguntas después de la animación
  setTimeout(() => {
    showScreen('questions-screen');
    revealQuestion('q1');
  }, 800);
}

function unlockFail() {
  const card      = document.querySelector('.lock-card');
  const lockError = document.getElementById('lock-error');
  const boxes     = document.querySelectorAll('.pin-box');

  lockError.classList.add('visible');
  card.classList.add('shake');
  setTimeout(() => card.classList.remove('shake'), 450);

  // Limpiar cajas
  boxes.forEach(b => { b.value = ''; });
  boxes[0].focus();
}

/* ═══════════════════════════════════════
   NAVEGACIÓN ENTRE PANTALLAS
═══════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

/* ═══════════════════════════════════════
   PANTALLA 2: PREGUNTAS ROMÁNTICAS
═══════════════════════════════════════ */
function revealQuestion(id) {
  const card = document.getElementById(id);
  if (!card) return;

  // Pequeño delay para la animación de entrada
  setTimeout(() => {
    card.style.display = 'block';
    requestAnimationFrame(() => {
      card.classList.add('active');
    });
  }, 60);
}

function nextQuestion(num) {
  const currentId = 'q' + num;
  const nextId    = 'q' + (num + 1);
  const current   = document.getElementById(currentId);
  const next      = document.getElementById(nextId);

  if (!current) return;

  // Guardar respuesta
  if (num === 1) {
    state.answers.whenMet = document.getElementById('date-q1')?.value || '';
  } else if (num === 2) {
    state.answers.firstSeen = document.getElementById('date-q2')?.value || '';
  }

  // Salida animada de la pregunta actual
  current.classList.add('exit');
  current.classList.remove('active');

  setTimeout(() => {
    current.style.display = 'none';
    current.classList.remove('exit');

    if (next) {
      revealQuestion(nextId);
    }
  }, 450);
}

/* Slider de corazones */
function updateHearts(value) {
  state.answers.howMuch = value;
  const display = document.getElementById('hearts-display');
  const label   = document.getElementById('slider-label');
  if (!display) return;

  const n = parseInt(value);
  display.innerHTML = '';

  for (let i = 0; i < n; i++) {
    const h = document.createElement('span');
    h.textContent = '❤️';
    h.style.animationDelay = (i * 0.1) + 's';
    h.classList.add('fade-in-up');
    display.appendChild(h);
  }

  const labels = [
    '', 'Poquito :c', 'Un poco 🥺', 'Bastante 💕', 'Mucho 💖',
    '¡Mucho! 💗', 'Muchísimo 💓', 'Demasiado 😍', 'Amor para toda la vida 💝',
    '¡Te amo junto al obelix! 💞', '¡Hasta muerta t amaré<3333 {incluye al obelix}! 🌙💖'
  ];
  if (label) label.textContent = labels[n] || '❤️';
}

function initHearts(val) {
  const slider = document.getElementById('love-slider');
  if (slider) updateHearts(slider.value);
}

/* Ir a la carta + enviar respuestas por email */
function goToLetter() {
  sendAnswersByEmail();
  showScreen('letter-screen');
  showMusicControls();

  // Trigger confetti después de pequeño delay
  setTimeout(() => {
    launchConfetti();
    initScrollReveal();
    playRandomSong();
  }, 500);
}

/* Reproducir canción aleatoria */
function playRandomSong() {
  const randomIndex = Math.floor(Math.random() * CONFIG.YOUTUBE_IDS.length);
  setTimeout(() => playSong(randomIndex), 800);
}

/* ═══════════════════════════════════════
   EMAILJS — ENVIAR RESPUESTAS
═══════════════════════════════════════ */
function sendAnswersByEmail() {
  if (
    !CONFIG.EMAILJS_SERVICE_ID.includes('XXXX') &&
    typeof emailjs !== 'undefined'
  ) {
    const params = {
      fecha_conocidos:   state.answers.whenMet   || 'No ingresó',
      fecha_primera_vez: state.answers.firstSeen || 'No ingresó',
      cuanto_amor:       state.answers.howMuch + ' / 10 corazones ❤️'
    };

    emailjs.send(
      CONFIG.EMAILJS_SERVICE_ID,
      CONFIG.EMAILJS_TEMPLATE_ID,
      params
    ).then(() => {
      showToast('💌 Tus respuestas fueron enviadas con amor');
    }).catch((err) => {
      console.warn('EmailJS error:', err);
    });
  }
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
    c.style.left = (Math.random() * 100) + '%';
    c.style.top  = (Math.random() * 40) + '%';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.width  = (6 + Math.random() * 8) + 'px';
    c.style.height = (6 + Math.random() * 8) + 'px';
    c.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
    c.style.animationDuration = (1 + Math.random() * 1.5) + 's';
    c.style.animationDelay    = (Math.random() * .8) + 's';
    area.appendChild(c);
  }

  setTimeout(() => { area.innerHTML = ''; }, 3500);
}

/* ═══════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════ */
function initScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });

  revealEls.forEach(el => observer.observe(el));
}

/* ═══════════════════════════════════════
   REPRODUCTOR DE MÚSICA
═══════════════════════════════════════ */
function updatePlaylistNames() {
  const items = document.querySelectorAll('.playlist-item');
  items.forEach((item, i) => {
    const icon = item.querySelector('i');
    if (icon) {
      item.innerHTML = '';
      item.appendChild(icon);
      item.append(CONFIG.SONG_NAMES[i] || 'Canción ' + (i + 1));
    }
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
  if (player)   { player.style.display = 'block'; }
  if (floatBtn) { floatBtn.style.display = 'none'; }
}

function toggleMusicExpand() {
  const body    = document.getElementById('music-body');
  const chevron = document.getElementById('music-chevron');
  if (!body) return;

  state.musicExpanded = !state.musicExpanded;
  body.classList.toggle('collapsed', !state.musicExpanded);
  chevron.classList.toggle('rotated', !state.musicExpanded);
}

function playSong(index) {
  const ids  = CONFIG.YOUTUBE_IDS;
  const mp3s = CONFIG.MP3_FILES || [];
  if (index < 0 || index >= ids.length) return;

  state.currentSong = index;
  state.isPlaying   = true;

  // Actualizar UI playlist
  document.querySelectorAll('.playlist-item').forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });

  const mp3path = mp3s[index] || '';
  const wrapper  = document.getElementById('yt-wrapper');
  const iframe   = document.getElementById('yt-iframe');
  const audioEl  = document.getElementById('mp3-player');

  if (mp3path) {
    // — Usar MP3 local (sin anuncios) —
    if (wrapper) wrapper.style.display = 'none';
    if (iframe)  iframe.src = '';
    if (audioEl) {
      audioEl.src = mp3path;
      audioEl.style.display = 'block';
      audioEl.play().catch(() => {});
    }
  } else {
    // — Fallback a YouTube —
    if (audioEl) { audioEl.pause(); audioEl.style.display = 'none'; }
    if (wrapper && iframe) {
      wrapper.style.display = 'block';
      iframe.src = `https://www.youtube.com/embed/${ids[index]}?autoplay=1&enablejsapi=1`;
    }
  }

  // Actualizar botón play/pause
  const icon = document.getElementById('play-icon');
  if (icon) icon.classList.replace('fa-play', 'fa-pause');
}

function togglePlay() {
  const audioEl = document.getElementById('mp3-player');
  const mp3s    = CONFIG.MP3_FILES || [];
  const usingMp3 = mp3s[state.currentSong] && audioEl && audioEl.src && !audioEl.paused !== undefined;

  if (!state.isPlaying) {
    playSong(state.currentSong);
  } else {
    // Detener
    if (audioEl && !audioEl.paused) {
      audioEl.pause();
    }
    const iframe  = document.getElementById('yt-iframe');
    const wrapper = document.getElementById('yt-wrapper');
    if (iframe)  iframe.src = '';
    if (wrapper) wrapper.style.display = 'none';

    const icon = document.getElementById('play-icon');
    if (icon) icon.classList.replace('fa-pause', 'fa-play');
    state.isPlaying = false;
  }
}

function nextSong() {
  const next = (state.currentSong + 1) % CONFIG.YOUTUBE_IDS.length;
  playSong(next);
}

function prevSong() {
  const prev = (state.currentSong - 1 + CONFIG.YOUTUBE_IDS.length) % CONFIG.YOUTUBE_IDS.length;
  playSong(prev);
}

/* ═══════════════════════════════════════
   TABS (carta / álbum) — sin recargar página
═══════════════════════════════════════ */
function showTab(tabId, el) {
  // Actualizar tabs activos
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');

  // Mostrar/ocultar contenido
  const carta = document.getElementById('tab-carta');
  const album = document.getElementById('tab-album');

  if (tabId === 'album') {
    if (carta) carta.style.display = 'none';
    if (album) {
      album.style.display = 'block';
      // Inicializar animaciones del álbum al mostrarlo
      setTimeout(() => initAlbumAnimations(), 60);
    }
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

  const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
  toast.show();
}

/* ═══════════════════════════════════════
   ÁLBUM: LIGHTBOX
═══════════════════════════════════════ */
let lightboxImages = [];
let lightboxIndex  = 0;

function initAlbumAnimations() {
  // Recolectar imágenes para lightbox
  lightboxImages = Array.from(document.querySelectorAll('.album-item'));

  // Scroll reveal con delay escalonado
  const items = document.querySelectorAll('.album-item');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('revealed');
        }, i * 60);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  items.forEach(item => observer.observe(item));
}

function openLightbox(el) {
  const lb  = document.getElementById('lightbox');
  const img = document.getElementById('lb-img');
  const cap = document.getElementById('lb-caption');
  if (!lb) return;

  lightboxImages = Array.from(document.querySelectorAll('.album-item'));
  lightboxIndex  = lightboxImages.indexOf(el);

  const src     = el.querySelector('img')?.src || '';
  const caption = el.dataset.caption || '';

  img.src = src;
  if (cap) cap.textContent = caption;

  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}

function lbPrev() {
  lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
  lbShow(lightboxIndex);
}

function lbNext() {
  lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
  lbShow(lightboxIndex);
}

function lbShow(i) {
  const el  = lightboxImages[i];
  const img = document.getElementById('lb-img');
  const cap = document.getElementById('lb-caption');
  if (!el || !img) return;

  img.style.opacity = '0';
  setTimeout(() => {
    img.src = el.querySelector('img')?.src || '';
    if (cap) cap.textContent = el.dataset.caption || '';
    img.style.opacity = '1';
    img.style.transition = 'opacity .3s';
  }, 150);
}

// Navegar lightbox con teclado
document.addEventListener('keydown', (e) => {
  const lb = document.getElementById('lightbox');
  if (!lb?.classList.contains('open')) return;
  if (e.key === 'ArrowLeft')  lbPrev();
  if (e.key === 'ArrowRight') lbNext();
  if (e.key === 'Escape')     closeLightbox();
});

/* ═══════════════════════════════════════
   AUTO-INIT EN PÁGINAS SECUNDARIAS
═══════════════════════════════════════ */
// Si estamos en album.html, initAlbumAnimations se llama inline.
// Si regresamos a index.html con sesión, ya está manejado en DOMContentLoaded.
