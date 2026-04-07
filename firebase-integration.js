'use strict';

/* ════════════════════════════════════════════
   0. INICIALIZAR FIREBASE
════════════════════════════════════════════ */
const app = firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/* ════════════════════════════════════════════
   HELPERS DE SEGURIDAD
════════════════════════════════════════════ */
function isAllowedEmail(email) {
  return ALLOWED_EMAILS.includes((email || '').toLowerCase());
}

function currentUserIsAllowed() {
  return isAllowedEmail(window._currentUser?.email || '');
}

/* ════════════════════════════════════════════
   PANEL PRIVADO (CONTROL VISUAL)
════════════════════════════════════════════ */
function initPrivatePanel() {
  const panelTab = document.getElementById('tab-panel');
  const panelBtn = document.getElementById('tab-btn-panel');
  const user = window._currentUser;

  if (!panelTab || !panelBtn || !user) return;

  const allowed = isAllowedEmail(user.email || '');

  if (allowed) {
    panelBtn.style.display = '';
    panelTab.style.display = 'none';
  } else {
    panelBtn.style.display = 'none';
    panelTab.style.display = 'none';
  }
}

/* ════════════════════════════════════════════
   1. AUTH GUARD — si no hay sesión → login
════════════════════════════════════════════ */
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const signedEmail = (user.email || '').toLowerCase();

  // 🔒 validación real
  if (!isAllowedEmail(signedEmail)) {
    await auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  // 👇 guardar usuario global
  window._currentUser = user;
  window._currentUsername = sessionStorage.getItem('_lu') || 'amor';

  const nameEl = document.getElementById('user-display-name');
  if (nameEl) nameEl.textContent = window._currentUsername;

  // 👇 inicializar panel
// Habilitar panel privado
  initPrivatePanel();

  // Editor natito (solo para natito)
  if ((sessionStorage.getItem('_lu') || '') === 'natito') {
    if (typeof window.initNatitoEditor === 'function') window.initNatitoEditor();
  }

  // Cargar datos de Firestore
  loadDynamicCartas();
  loadDynamicAlbum();
  loadDynamicMusica();
});


/* ════════════════════════════════════════════
   2. SECCIÓN SORPRESA FLOTANTE 💌
════════════════════════════════════════════ */
function injectSurpriseSection() {
  const html = `
  <!-- Botón flotante sorpresa -->
  <button id="surprise-float-btn" class="surprise-float-btn" onclick="openSurprise()" aria-label="Sección secreta">
    💌
    <span class="surprise-badge">✨</span>
  </button>

  <!-- Modal sorpresa -->
  <div id="surprise-modal" class="surprise-modal" role="dialog" aria-modal="true">
    <div class="surprise-backdrop" onclick="closeSurprise()"></div>
    <div class="surprise-content" id="surprise-content">

      <!-- FASE 1: Candado 8 dígitos -->
      <div id="surprise-lock-phase" class="surprise-phase active">
        <button class="surprise-close" onclick="closeSurprise()">✕</button>
        <div class="sp-deco">✦ ✦ ✦</div>
        <div class="sp-icon">🔐</div>
        <h2 class="sp-title">Eres muy especial <br/><em> para mi 🌹 </em></h2>
        <p class="sp-hint">Ingresa la clave q me se yo nms </p>
        <div class="sp-pin-display" id="sp-pin-display"></div>
        <div class="sp-keypad">
          ${[1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].map(k =>
            `<button class="sp-key ${k==='✓'?'sp-key-ok':k==='⌫'?'sp-key-del':''}"
              onclick="spKeyPress('${k}')">${k}</button>`
          ).join('')}
        </div>
        <p class="sp-error" id="sp-error"></p>
      </div>

      <!-- FASE 2: La pregunta especial -->
      <div id="surprise-question-phase" class="surprise-phase">
        <button class="surprise-close" onclick="closeSurprise()">✕</button>
        <!-- Corazones flotantes animados -->
        <div class="sp-hearts-bg" aria-hidden="true">
          <span>💖</span><span>🌸</span><span>💛</span><span>✨</span>
          <span>💕</span><span>🌹</span><span>💖</span><span>🌸</span>
        </div>
        <!-- Anillo con pulso -->
        <div class="sp-ring-wrap">
          <div class="sp-ring-pulse"></div>
          <div class="sp-ring-pulse sp-ring-pulse-2"></div>
          <div class="sp-icon sp-icon-ring">💍</div>
        </div>
        <h2 class="sp-title sp-title-special">
          espero<br/> que le guste.<br/><em>eres mi vida sabías¿</em>
        </h2>
        <div class="sp-divider-stars" aria-hidden="true">✦ ✦ ✦</div>
        <p class="sp-subtitle-q">
          Te lo queria decir antes, pero me daba cosita, pero estoy demasiado seguro de que quiero estár contigo.<br/>
          Estar a tu lado me hace tan felizzz y espero que también te de seguridad que yo solo quiero estar contigo<br/>
          y por eso queria preguntarte esto...
        </p>
        <p class="sp-big-question">
          ¿Quieres<br/><em>pololear conmigo?</em> 💍
        </p>
        <div class="sp-answer-btns">
          <button class="sp-btn-si" onclick="surpriseAnswer('si')">
            <span class="sp-btn-icon">🐱</span>
            <span>¡Sí, quiero!</span>
          </button>
          <button class="sp-btn-no" onclick="surpriseAnswer('no')">
            <span class="sp-btn-icon">😢</span>
            <span>No…</span>
          </button>
        </div>
      </div>

      <!-- FASE 3A: Respuesta SÍ -->
      <div id="surprise-yes-phase" class="surprise-phase">
        <div class="surprise-confetti" id="surprise-confetti"></div>
        <button class="surprise-close" onclick="closeSurprise()">✕</button>
        <div class="sp-deco">🎉 💖 🎉</div>
        <div class="sp-gif-wrap">
          <img src="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2F0cXl4MHFyNG1pOTRwdzZmcWwxbm9kcGFsdTl4aWRtdTZhZG82NyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/1kymxb4RCuOwE/giphy.gif"
               alt="snoopy"
               class="sp-gif sp-gif-yes"
               onerror="this.src='https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2F0cXl4MHFyNG1pOTRwdzZmcWwxbm9kcGFsdTl4aWRtdTZhZG82NyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/1kymxb4RCuOwE/giphy.gif'" />
        </div>
        <h2 class="sp-title sp-title-yes">¡¡Me dijo que siiiiiii!!!!!!! 🎊</h2>
        <p class="sp-msg-yes">
          Esto solo es el comienzo mi vida, te amo muchisimo 🌸😿<br/><br/>
          Prometo estar siempre para tí .<br/>
          Eres mi persona favorita .<br/><br/>
          <em>Te amo infinitamente, mi nupi limda 💖</em>
        </p>
        <p class="sp-hearts-row">💖 💛 🌸 💖 🌸 💛 💖</p>
      </div>

      <!-- FASE 3B: Respuesta NO -->
      <div id="surprise-no-phase" class="surprise-phase">
        <button class="surprise-close" onclick="closeSurprise()">✕</button>
        <div class="sp-deco">😿 🥺 😿</div>
        <div class="sp-gif-wrap">
          <img src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2RuMTdtbHA0eHZ3MG5iaWI3OWtueG5lN2ZieHBxbXo2cmF1dDIzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/8boMf1VXVHoJy/giphy.gif"
               alt="troste snupi"
               class="sp-gif sp-gif-no"
               onerror="this.src='https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2RuMTdtbHA0eHZ3MG5iaWI3OWtueG5lN2ZieHBxbXo2cmF1dDIzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/8boMf1VXVHoJy/giphy.gif'" />
        </div>
        <h2 class="sp-title sp-title-no">Está bien… 🥺</h2>
        <p class="sp-msg-no">
          I hate U bromita se que no me dirás q n0ooo t amo ASJDaskda💕<br/><br/>
          Este gatito y yo 😿😿😿<br/>
          pq te ganó la curiosidad y querias saber que habia en el no ASHJDAS TAMOOOOOO 🐱
        </p>
        <button class="sp-btn-retry" onclick="surpriseRetry()">
          💖 Quiero cambiar mi respuesta
        </button>
      </div>

    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

// Estado del pin sorpresa
let spPinValue = '';

window.spKeyPress = function(k) {
  if (k === '⌫') {
    spPinValue = spPinValue.slice(0, -1);
    renderSpPin();
    return;
  }
  if (k === '✓') {
    checkSecretPin();
    return;
  }
  if (spPinValue.length >= 8) return;
  spPinValue += k;
  renderSpPin();
};

function renderSpPin() {
  const el = document.getElementById('sp-pin-display');
  if (!el) return;
  el.innerHTML = Array.from({length: 8}, (_, i) =>
    `<span class="sp-dot ${i < spPinValue.length ? 'filled' : ''}"></span>`
  ).join('');
}

function checkSecretPin() {
  if (spPinValue === SECRET_PIN) {
    showSurprisePhase('surprise-question-phase');
  } else {
    const errEl = document.getElementById('sp-error');
    if (errEl) { errEl.textContent = 'Código incorrecto 💔 intenta de nuevo'; errEl.style.opacity = '1'; }
    const content = document.getElementById('surprise-content');
    if (content) { content.classList.add('shake'); setTimeout(() => content.classList.remove('shake'), 450); }
    spPinValue = '';
    renderSpPin();
    setTimeout(() => { if (errEl) errEl.style.opacity = '0'; }, 2000);
  }
}

window.surpriseAnswer = function(answer) {
  if (answer === 'si') {
    showSurprisePhase('surprise-yes-phase');
    launchSurpriseConfetti();
  } else {
    showSurprisePhase('surprise-no-phase');
  }
};

window.surpriseRetry = function() {
  showSurprisePhase('surprise-question-phase');
};

function showSurprisePhase(id) {
  document.querySelectorAll('.surprise-phase').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function launchSurpriseConfetti() {
  const area = document.getElementById('surprise-confetti');
  if (!area) return;
  const items = ['💖','🌸','✨','💛','🎊','💕','🥳','🌟'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('div');
    c.className = 'sc-piece';
    c.textContent = items[Math.floor(Math.random() * items.length)];
    c.style.left = Math.random() * 100 + '%';
    c.style.top  = '-10%';
    c.style.fontSize = (.9 + Math.random() * 1.1) + 'rem';
    c.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    c.style.animationDelay = (Math.random() * 1.2) + 's';
    area.appendChild(c);
  }
  setTimeout(() => { if (area) area.innerHTML = ''; }, 4000);
}

window.openSurprise = function() {
  spPinValue = '';
  renderSpPin();
  showSurprisePhase('surprise-lock-phase');
  document.getElementById('surprise-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeSurprise = function() {
  document.getElementById('surprise-modal').classList.remove('open');
  document.body.style.overflow = '';
};

/* ════════════════════════════════════════════
   3. JUEGO DE MEMORIA (PARES DE CARTAS)
════════════════════════════════════════════ */
const memoryData = [
  { emoji: '💖', label: 'Amor' },
  { emoji: '🌸', label: 'Flores' },
  { emoji: '🎵', label: 'Música' },
  { emoji: '🌙', label: 'Noche' },
  { emoji: '☕', label: 'Café' },
  { emoji: '🌍', label: 'Mundo' },
  { emoji: '✨', label: 'Magia' },
  { emoji: '🐱', label: 'Gatito' }
];

let memCards = [];
let memFlipped = [];
let memSolved = 0;
let memLocked = false;

function initMemoryGame() {
  const grid = document.getElementById('memory-grid');
  if (!grid) return;

  // Duplicar y mezclar
  const pairs = [...memoryData, ...memoryData].sort(() => Math.random() - .5);
  memCards = [];
  memFlipped = [];
  memSolved = 0;
  memLocked = false;

  grid.innerHTML = '';
  pairs.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'mem-card';
    card.dataset.index = i;
    card.dataset.label = item.label;
    card.innerHTML = `
      <div class="mem-card-inner">
        <div class="mem-front">💌</div>
        <div class="mem-back">${item.emoji}</div>
      </div>`;
    card.onclick = () => handleMemoryClick(i);
    grid.appendChild(card);
    memCards.push({ el: card, label: item.label, flipped: false, matched: false });
  });

  const counter = document.getElementById('memory-counter');
  if (counter) counter.textContent = `0 / ${memoryData.length} pares`;
}

function handleMemoryClick(index) {
  if (memLocked) return;
  const card = memCards[index];
  if (!card || card.flipped || card.matched) return;

  card.flipped = true;
  card.el.classList.add('flipped');
  memFlipped.push(index);

  if (memFlipped.length === 2) {
    memLocked = true;
    const [a, b] = memFlipped;
    if (memCards[a].label === memCards[b].label) {
      // Match!
      memCards[a].el.classList.add('matched');
      memCards[b].el.classList.add('matched');
      memCards[a].matched = true;
      memCards[b].matched = true;
      memSolved++;
      memFlipped = [];
      memLocked = false;
      const counter = document.getElementById('memory-counter');
      if (counter) counter.textContent = `${memSolved} / ${memoryData.length} pares`;
      if (memSolved === memoryData.length) {
        setTimeout(memoryComplete, 600);
      }
    } else {
      setTimeout(() => {
        memCards[a].el.classList.remove('flipped');
        memCards[b].el.classList.remove('flipped');
        memCards[a].flipped = false;
        memCards[b].flipped = false;
        memFlipped = [];
        memLocked = false;
      }, 1100);
    }
  }
}

function memoryComplete() {
  const msgEl = document.getElementById('memory-msg');
  const btnWrap = document.getElementById('memory-unlock-wrap');
  if (msgEl) { msgEl.textContent = '¡Lo encontraste todo! Igual que encontraste mi corazón 💖'; msgEl.style.opacity = '1'; }
  if (btnWrap) btnWrap.style.display = 'block';
}

/* ════════════════════════════════════════════
   4. JUEGO: ORDENA LA HISTORIA
════════════════════════════════════════════ */
const historyPhrases = [
  { id: 1, text: "Hablamos en el cum de la tama y me curé bastamte ASJDAJASDKSAK✨" },
  { id: 2, text: "Me enviaste soli, luego te meti a cf, después me dist laik a historia random y te hablé ASJsadjasjdas💬" },
  { id: 3, text: " T invité a salir y te fui a buscar al preu en cande y tomamos cafecito🌸" },
  { id: 4, text: "Comenzamos a salir seguido y te volviste parte de mi semana 💌" },
  { id: 5, text: "Halloweennnnnn nuestra primera noche que dormimos juntoss 💖" },
  { id: 6, text: " Comenzaron las salidas a la playita y te dije te quiero en un dia de noviembre que fuimos a comer pizza y habia vientito un poco heladito🌟" },
  { id: 7, text: "Me dijiste te amo mientras dormia y tmb fuiste el mjr regalo que he tenido💖✨" },
  { id: 8, text: "Nos dijimos te amo en la playita y se me pusieron los ojos llorosos y tu lloraste pq me amas mucho 💌✨" },
  { id: 9, text: "Te pedí que fueras mi novia y me dijiste que si, asíq ahora somos novios y estamos muy enamoradossss 💛💛 ✨" }
];

let sortDragSrc = null;
let sortOrder = [];

function initSortGame() {
  const container = document.getElementById('sort-phrases');
  if (!container) return;

  // Mezclar
  sortOrder = [...historyPhrases].sort(() => Math.random() - .5);

  container.innerHTML = '';
  sortOrder.forEach((phrase, i) => {
    const item = document.createElement('div');
    item.className = 'sort-item';
    item.draggable = true;
    item.dataset.id = phrase.id;
    item.innerHTML = `<span class="sort-num">${i + 1}</span><span class="sort-text">${phrase.text}</span>`;

    // Drag events
    item.addEventListener('dragstart', e => {
      sortDragSrc = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    item.addEventListener('dragenter', () => item.classList.add('drag-over'));
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (sortDragSrc && sortDragSrc !== item) {
        const items = [...container.children];
        const fromIdx = items.indexOf(sortDragSrc);
        const toIdx   = items.indexOf(item);
        if (fromIdx < toIdx) container.insertBefore(sortDragSrc, item.nextSibling);
        else container.insertBefore(sortDragSrc, item);
        updateSortNumbers();
      }
    });

    // Touch swap (mobile)
    let touchSrc = null;
    item.addEventListener('touchstart', e => { touchSrc = item; item.classList.add('dragging'); }, { passive: true });
    item.addEventListener('touchend', e => {
      item.classList.remove('dragging');
      const touch = e.changedTouches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.sort-item');
      if (target && target !== touchSrc && touchSrc) {
        const items = [...container.children];
        const fromIdx = items.indexOf(touchSrc);
        const toIdx   = items.indexOf(target);
        if (fromIdx < toIdx) container.insertBefore(touchSrc, target.nextSibling);
        else container.insertBefore(touchSrc, target);
        updateSortNumbers();
      }
    });

    container.appendChild(item);
  });

  const msgEl = document.getElementById('sort-msg');
  const btnWrap = document.getElementById('sort-unlock-wrap');
  if (msgEl) { msgEl.textContent = ''; msgEl.className = 'sort-msg'; }
  if (btnWrap) btnWrap.style.display = 'none';
}

function updateSortNumbers() {
  document.querySelectorAll('#sort-phrases .sort-num').forEach((num, i) => {
    num.textContent = i + 1;
  });
}

window.checkSortOrder = function() {
  const items = [...document.querySelectorAll('#sort-phrases .sort-item')];
  const order = items.map(el => parseInt(el.dataset.id));
  const correct = historyPhrases.map(p => p.id);
  const msgEl  = document.getElementById('sort-msg');
  const btnWrap = document.getElementById('sort-unlock-wrap');

  if (JSON.stringify(order) === JSON.stringify(correct)) {
    if (msgEl) { msgEl.textContent = '¡Perfecta! Así fue nuestra historia… y así la llevas en el corazón 💖'; msgEl.className = 'sort-msg sort-msg-ok'; }
    if (btnWrap) btnWrap.style.display = 'block';
    items.forEach(el => el.classList.add('sort-correct'));
  } else {
    if (msgEl) { msgEl.textContent = 'Hmm… el orden no es exacto, pero el amor sí 🌸 ¡Sigue intentando!'; msgEl.className = 'sort-msg sort-msg-wrong'; }
    items.forEach(el => { el.classList.add('sort-wrong'); setTimeout(() => el.classList.remove('sort-wrong'), 1000); });
  }
};

/* ════════════════════════════════════════════
   5. QUIZ EMOCIONAL DINÁMICO
════════════════════════════════════════════ */
const emojiQuiz = [
  {
    pregunta: "Si pudiéramos ir a cualquier lugar ahora mismo, ¿a dónde iríamos? 🌍",
    opciones: [
      { texto: "Una playa desierta 🏖️", resp: "A tomar sol juntos, comer rolls con juguito de naranja sin prisa y sin nadie, solo nosotros dos. Eso suena dms perfecto." },
      { texto: "Una ciudad nueva 🏙️", resp: "Explorando calles desconocidas, perdiéndonos y luego tratando de encontrarnos o encontrar lugares. ¡Me encantaría!" },
      { texto: "Una cabaña en el bosque 🌲", resp: "Lejos del ruido que genera la gente d mrda, solo el sonido de la naturaleza y tu voz. El plan más romántico algo como llifén entre bosque y playita es lo mjr del mundo contigo." },
      { texto: "Quedarnos en casa 🏠", resp: "A veces el mejor lugar del mundo es estar en casa contigo, alimentarte y poder dormir sin ropa contigo. No necesito nada más." }
    ]
  },
  {
    pregunta: "¿Cuál sería nuestro plan perfecto para un sábado? 🌸",
    opciones: [
      { texto: "Desayuno largo y rico ☕", resp: "Café o tecito, tostadas con huevito o mantequilla, y tú frente a mí mientras escuchamos las olas en curiñanco o estamos con los gatitos en mi casa. Los sábados deberían ser todos así." },
      { texto: "Salir a caminar sin rumbo 🚶‍♂️‍🚶‍♀️", resp: "Sin destino fijo, solo la mano de alguien que amas con tu alma !!!!osea yo¡¡¡ . Eso es libertad." },
      { texto: "Ver películas todo el día 🎬", resp: "Manta, snacks, y tú. Eso es lo que necesito para ser la persona más feliz, mentira no necesito todo eso, solo con estar contigo soy el más feliz, pero igual es buen plan." },
      { texto: "Sorprenderme con algo 🎁", resp: "Me encanta que quieras sorprenderme, como con el album. Cada momento contigo ya es una sorpresa bonita como tus ojos al mirarme." }
    ]
  },
  {
    pregunta: "¿Qué canción describe mejor lo que sientes ahora? 🎵",
    opciones: [
      { texto: "Una canción lenta y romántica estilo macccc 🎻", resp: "De esas que ponen en las películas cuando los protagonistas finalmente se miran. Eso somos." },
      { texto: "Algo alegre y bailable su sinaka💃", resp: "Pq el gozo contigo es lo mjr q hay. ¡t amo!!!!" },
      { texto: "Una canción tranquila de verano 🌊", resp: "Como ese momento en el que estamos en la playita relajados escuchando musica y abrazandonos." },
      { texto: "Algo profundo con letra bonita 📝", resp: "Pq con esas canciones te acuerdas de mi 🐱 y yo tmbbbbb pq te dediqué una cancion q nunca en la vida iba a dedicar x nada del mundo pero te la mereces!!!!!! aun que no es tan profunda la letra pero es una de mis canciones favoritas de hace muchisimos años atrás!!." }
    ]
  }
];

let quizIndex = 0;
let quizResponses = [];

function initEmotionalQuiz() {
  quizIndex = 0;
  quizResponses = [];
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = emojiQuiz[quizIndex];
  const qEl    = document.getElementById('equiz-question');
  const optsEl = document.getElementById('equiz-options');
  const countEl = document.getElementById('equiz-counter');
  const respEl = document.getElementById('equiz-response');

  if (!q) return;
  if (qEl) qEl.textContent = q.pregunta;
  if (countEl) countEl.textContent = `${quizIndex + 1} / ${emojiQuiz.length}`;
  if (respEl) { respEl.textContent = ''; respEl.style.opacity = '0'; }

  if (optsEl) {
    optsEl.innerHTML = '';
    q.opciones.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'equiz-opt';
      btn.textContent = opt.texto;
      btn.onclick = () => handleQuizAnswer(opt.resp, btn, optsEl);
      optsEl.appendChild(btn);
    });
  }
}

function handleQuizAnswer(respText, btnEl, optsEl) {
  // Bloquear otros botones
  optsEl.querySelectorAll('.equiz-opt').forEach(b => { b.disabled = true; b.classList.remove('selected'); });
  btnEl.classList.add('selected');
  quizResponses.push(respText);

  const respEl = document.getElementById('equiz-response');
  if (respEl) {
    respEl.textContent = respText;
    respEl.style.transition = 'opacity .5s ease';
    respEl.style.opacity = '1';
  }

  setTimeout(() => {
    quizIndex++;
    if (quizIndex < emojiQuiz.length) {
      renderQuizQuestion();
    } else {
      showQuizFinal();
    }
  }, 2000);
}

function showQuizFinal() {
  const card = document.getElementById('equiz-card');
  const finalEl = document.getElementById('equiz-final');
  if (card) card.style.display = 'none';
  if (finalEl) {
    finalEl.style.display = 'block';
    finalEl.innerHTML = `
      <div class="q-heart">💖</div>
      <h2 class="q-title">Gracias por responder, mi amor</h2>
      <div class="equiz-final-msgs">
        ${quizResponses.map(r => `<p class="equiz-final-msg">"${r}"</p>`).join('')}
      </div>
      <p class="q-hint" style="margin-top:1rem">Cada respuesta me hace quererte más 🌸</p>
      <div id="equiz-unlock-wrap" class="mt-3">
        <button class="btn-romantic" onclick="goToPhase('cards-screen')">
          <i class="fa-solid fa-cards-blank me-2"></i>Siguiente: Cartas 💌
        </button>
      </div>`;
  }
}

/* ════════════════════════════════════════════
   6. FIRESTORE — CARTAS DINÁMICAS
════════════════════════════════════════════ */
async function loadDynamicCartas() {
  try {
    const snap = await db.collection('cartas').orderBy('fecha', 'desc').get();
    if (snap.empty) return;

    const grid = document.getElementById('dynamic-cards-grid');
    if (!grid) return;

    snap.forEach(doc => {
      const data = doc.data();
      const card = document.createElement('div');
      card.className = 'dyn-card reveal';
      card.innerHTML = `
        <div class="dyn-card-header">
          <span class="dyn-card-icon">💌</span>
          <span class="dyn-card-autor">${data.autor || 'amor'}</span>
        </div>
        <h3 class="dyn-card-titulo">${data.titulo || ''}</h3>
        <p class="dyn-card-texto">${data.contenido || ''}</p>
        <p class="dyn-card-fecha">${formatDate(data.fecha?.toDate())}</p>`;
      grid.appendChild(card);
    });
  } catch (err) {
    console.warn('Error cargando cartas:', err);
  }
}

/* ════════════════════════════════════════════
   7. FIRESTORE + STORAGE — ÁLBUM DINÁMICO
════════════════════════════════════════════ */
async function loadDynamicAlbum() {
  try {
    const snap = await db.collection('fotos').orderBy('fecha', 'desc').get();
    if (snap.empty) return;

    const grid = document.getElementById('album-grid');
    if (!grid) return;

    snap.forEach(doc => {
      const data = doc.data();
      const item = document.createElement('div');
      item.className = 'album-item';
      item.dataset.caption = data.descripcion || '';
      item.onclick = function() { if (typeof openLightbox === 'function') openLightbox(this); };
      item.innerHTML = `
        <div class="album-frame">
          <img src="${data.url}" alt="${data.descripcion || 'Foto'}" loading="lazy" />
          <div class="album-overlay"><i class="fa-solid fa-expand"></i></div>
        </div>
        <p class="album-caption">${data.descripcion || ''}</p>`;
      grid.appendChild(item);
    });

    // Re-inicializar lightbox con las nuevas fotos
    if (typeof initAlbumAnimations === 'function') initAlbumAnimations();
  } catch (err) {
    console.warn('Error cargando fotos:', err);
  }
}

/* ════════════════════════════════════════════
   8. PANEL PRIVADO (subir fotos + crear cartas)
════════════════════════════════════════════ */
function initPrivatePanel() {
  const panel = document.getElementById('private-panel');
  if (!panel) return;

  const user = window._currentUser;
  if (!user) return;

  panel.style.display = 'block';

  // Verificar si es uno de los 2 usuarios permitidos
  const allowed = Object.values(ALLOWED_USERS).some(u => u.email === user.email);
  if (!allowed) { panel.style.display = 'none'; return; }
}

/* ════════════════════════════════════════════
   IMGBB API KEY — gratis en imgbb.com/api
   1. Ve a https://api.imgbb.com/
   2. Crea cuenta gratis y copia tu API key
   3. Pégala aquí abajo
════════════════════════════════════════════ */
const IMGBB_API_KEY = '788afa9311150d93136c35f995797225'; // ← reemplaza esto

window.uploadPhoto = async function() {
  const fileInput = document.getElementById('photo-upload-input');
  const descInput = document.getElementById('photo-upload-desc');

  if (!fileInput?.files?.length) {
    showUploadStatus('Selecciona una imagen primero 📷', 'error');
    return;
  }

  const file = fileInput.files[0];
  const MAX_SIZE = 32 * 1024 * 1024; // 32 MB (límite ImgBB)

  if (!file.type.startsWith('image/')) {
    showUploadStatus('Solo se permiten imágenes 🖼️', 'error');
    return;
  }
  if (file.size > MAX_SIZE) {
    showUploadStatus('La imagen es muy grande (máx. 32 MB) 📏', 'error');
    return;
  }

  const btn = document.getElementById('upload-photo-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Subiendo… 💕'; }

  try {
    // Subir a ImgBB (gratis, sin Firebase Storage)
    const formData = new FormData();
    formData.append('image', file);
    formData.append('key', IMGBB_API_KEY);

    const res  = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Error ImgBB');

    const url  = json.data.url;
    const desc = descInput?.value?.trim() || 'Un momento especial 💕';

    await db.collection('fotos').add({
      url,
      descripcion: desc,
      autor: window._currentUsername || 'amor',
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });

    showUploadStatus('¡Foto subida con amor! 💖', 'ok');
    if (descInput) descInput.value = '';
    fileInput.value = '';
    const preview = document.getElementById('photo-preview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    const previewWrap = document.getElementById('photo-preview-wrap');
    if (previewWrap) previewWrap.style.display = 'none';

    // Agregar al álbum dinámicamente
    const grid = document.getElementById('album-grid');
    if (grid) {
      const item = document.createElement('div');
      item.className = 'album-item revealed';
      item.dataset.caption = desc;
      item.onclick = function() { if (typeof openLightbox === 'function') openLightbox(this); };
      item.innerHTML = `
        <div class="album-frame">
          <img src="${url}" alt="${desc}" loading="lazy" />
          <div class="album-overlay"><i class="fa-solid fa-expand"></i></div>
        </div>
        <p class="album-caption">${desc}</p>`;
      grid.prepend(item);
    }

  } catch (err) {
    console.error(err);
    showUploadStatus('Error: ' + (err.message || 'intenta de nuevo 😔'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up me-2"></i>Subir foto'; }
  }
};

/* ════════════════════════════════════════════
   MÚSICA: GUARDAR CANCIÓN DE SPOTIFY EN FIRESTORE
   Acepta: https://open.spotify.com/track/...
           https://open.spotify.com/playlist/...
           https://open.spotify.com/album/...
════════════════════════════════════════════ */
window.addMusica = async function() {
  const urlInput    = document.getElementById('musica-url-input');
  const nombreInput = document.getElementById('musica-nombre-input');
  const urlRaw      = urlInput?.value?.trim();
  const nombre      = nombreInput?.value?.trim();

  if (!urlRaw || !nombre) {
    showMusicaStatus('Completa el nombre y la URL de Spotify 🎵', 'error');
    return;
  }

  // Convertir URL de Spotify a embed
  let embedUrl = urlRaw;
  const spMatch = urlRaw.match(/open\.spotify\.com\/(track|playlist|album|artist)\/([a-zA-Z0-9]+)/);
  if (spMatch) {
    embedUrl = `https://open.spotify.com/embed/${spMatch[1]}/${spMatch[2]}?utm_source=generator`;
  } else if (!urlRaw.includes('spotify.com/embed') && !urlRaw.startsWith('https://')) {
    showMusicaStatus('Pega una URL de Spotify válida 🎵', 'error');
    return;
  }

  const btn = document.getElementById('add-musica-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Guardando…'; }

  try {
    await db.collection('musica').add({
      nombre,
      embedUrl,
      autor: window._currentUsername || 'amor',
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });

    showMusicaStatus('¡Canción guardada! 🎶', 'ok');
    if (urlInput)    urlInput.value    = '';
    if (nombreInput) nombreInput.value = '';

    addSongToList({ nombre, embedUrl });

  } catch (err) {
    console.error(err);
    showMusicaStatus('Error al guardar 😔', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plus me-2"></i>Agregar canción'; }
  }
};

function addSongToList(data) {
  const list = document.getElementById('spotify-songs-list');
  if (!list) return;
  const noMsg = document.getElementById('spotify-no-songs');
  if (noMsg) noMsg.style.display = 'none';
  const item = document.createElement('div');
  item.className = 'spotify-song-item';
  item.innerHTML = `<button class="spotify-song-btn" onclick="playSpotifySong('${data.embedUrl.replace(/'/g, "\'")}', this)"><i class="fa-brands fa-spotify me-2"></i>${data.nombre}</button>`;
  list.prepend(item);
}

window.playSpotifySong = function(embedUrl, btn) {
  const player = document.getElementById('spotify-embed-container');
  if (!player) return;
  document.querySelectorAll('.spotify-song-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  player.innerHTML = `<iframe style="border-radius:12px; width:100%;" src="${embedUrl}" height="152" frameborder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
  player.style.display = 'block';
};

async function loadDynamicMusica() {
  try {
    const snap = await db.collection('musica').orderBy('fecha', 'desc').get();
    if (snap.empty) return;
    snap.forEach(doc => addSongToList(doc.data()));
  } catch (err) {
    console.warn('Error cargando música:', err);
  }
}

function showMusicaStatus(msg, type) {
  const el = document.getElementById('musica-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'panel-status ' + (type === 'ok' ? 'status-ok' : 'status-error');
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

window.createCarta = async function() {
  const tituloEl   = document.getElementById('carta-titulo-input');
  const contenidoEl = document.getElementById('carta-contenido-input');
  const statusEl   = document.getElementById('carta-status');

  const titulo    = tituloEl?.value?.trim();
  const contenido = contenidoEl?.value?.trim();

  if (!titulo || !contenido) {
    showCartaStatus('Completa título y contenido 💌', 'error');
    return;
  }

  const btn = document.getElementById('create-carta-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando… 💕'; }

  try {
    await db.collection('cartas').add({
      titulo,
      contenido,
      autor: window._currentUsername || 'amor',
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });

    showCartaStatus('¡Carta guardada con amor! 💖', 'ok');
    if (tituloEl)   tituloEl.value   = '';
    if (contenidoEl) contenidoEl.value = '';
    loadDynamicCartas();

  } catch (err) {
    console.error(err);
    showCartaStatus('Error al guardar. Intenta de nuevo 😔', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💌 Enviar carta'; }
  }
};

function showUploadStatus(msg, type) {
  const el = document.getElementById('upload-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'panel-status ' + (type === 'ok' ? 'status-ok' : 'status-error');
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

function showCartaStatus(msg, type) {
  const el = document.getElementById('carta-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'panel-status ' + (type === 'ok' ? 'status-ok' : 'status-error');
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

/* ════════════════════════════════════════════
   9. LOGOUT
════════════════════════════════════════════ */
window.logoutUser = async function() {
  await auth.signOut();
  sessionStorage.clear();
  window.location.href = 'login.html';
};

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */
function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ════════════════════════════════════════════
   DOM READY — inicializar todo
════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  injectSurpriseSection();
  renderSpPin();
  initMemoryGame();
  initSortGame();
  initEmotionalQuiz();

  // Inyectar estilos extra para animación de propuesta
  const style = document.createElement('style');
  style.textContent = `
    /* Corazones flotantes de fondo en la fase de propuesta */
    .sp-hearts-bg {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
      border-radius: inherit;
    }
    .sp-hearts-bg span {
      position: absolute;
      bottom: -10%;
      font-size: 1.3rem;
      opacity: 0;
      animation: spHeartFloat 5s ease-in infinite;
    }
    .sp-hearts-bg span:nth-child(1)  { left: 5%;  animation-delay: 0s;   animation-duration: 5s; }
    .sp-hearts-bg span:nth-child(2)  { left: 15%; animation-delay: 0.7s; animation-duration: 6s; }
    .sp-hearts-bg span:nth-child(3)  { left: 28%; animation-delay: 1.4s; animation-duration: 4.5s; }
    .sp-hearts-bg span:nth-child(4)  { left: 42%; animation-delay: 0.3s; animation-duration: 5.5s; }
    .sp-hearts-bg span:nth-child(5)  { left: 58%; animation-delay: 1s;   animation-duration: 5s; }
    .sp-hearts-bg span:nth-child(6)  { left: 70%; animation-delay: 2s;   animation-duration: 4s; }
    .sp-hearts-bg span:nth-child(7)  { left: 83%; animation-delay: 0.5s; animation-duration: 6.5s; }
    .sp-hearts-bg span:nth-child(8)  { left: 93%; animation-delay: 1.8s; animation-duration: 5s; }
    @keyframes spHeartFloat {
      0%   { transform: translateY(0) scale(1);   opacity: 0; }
      10%  { opacity: 0.7; }
      90%  { opacity: 0.4; }
      100% { transform: translateY(-110vh) scale(1.3); opacity: 0; }
    }

    /* Anillo con auras pulsantes */
    .sp-ring-wrap {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 1rem auto 0.5rem;
      width: 90px;
      height: 90px;
      z-index: 1;
    }
    .sp-ring-pulse {
      position: absolute;
      width: 90px; height: 90px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(230,49,102,0.35), transparent 70%);
      animation: spPulse 2s ease-out infinite;
    }
    .sp-ring-pulse-2 { animation-delay: 1s; }
    @keyframes spPulse {
      0%   { transform: scale(1);   opacity: 1; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    .sp-icon-ring {
      position: relative;
      font-size: 3.2rem;
      z-index: 2;
      animation: spRingBounce 1.6s ease-in-out infinite;
      display: block;
      line-height: 1;
    }
    @keyframes spRingBounce {
      0%, 100% { transform: translateY(0) rotate(-8deg) scale(1); }
      30%       { transform: translateY(-10px) rotate(8deg) scale(1.1); }
      60%       { transform: translateY(-5px) rotate(-4deg) scale(1.05); }
    }

    /* Línea decorativa de estrellas */
    .sp-divider-stars {
      color: #e63166;
      letter-spacing: 8px;
      font-size: 0.75rem;
      opacity: 0.6;
      margin: 0.5rem 0;
      z-index: 1;
      position: relative;
    }

    /* Pregunta grande con gradiente animado */
    .sp-big-question {
      font-size: clamp(1.4rem, 5vw, 2rem);
      font-family: 'Dancing Script', cursive;
      font-weight: 700;
      text-align: center;
      line-height: 1.3;
      margin: 0.8rem 0 1.2rem;
      z-index: 1;
      position: relative;
      background: linear-gradient(135deg, #e63166, #ff85a1, #e63166);
      background-size: 200% 200%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: spGradientShift 3s ease infinite;
    }
    @keyframes spGradientShift {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .sp-big-question em {
      font-style: italic;
      -webkit-text-fill-color: transparent;
    }

    /* Botones de respuesta mejorados */
    #surprise-question-phase {
      position: relative;
      overflow: hidden;
    }
    .sp-subtitle-q {
      position: relative;
      z-index: 1;
    }
    .sp-title-special {
      position: relative;
      z-index: 1;
    }
    .sp-answer-btns {
      position: relative;
      z-index: 1;
    }
    .sp-btn-si {
      animation: spBtnPulse 2.5s ease-in-out infinite;
    }
    @keyframes spBtnPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(230,49,102,0.4); }
      50%       { box-shadow: 0 0 0 10px rgba(230,49,102,0); }
    }
  `;
  document.head.appendChild(style);
});

// Exponer funciones globales necesarias
window.initMemoryGame  = initMemoryGame;
window.initSortGame    = initSortGame;
window.initEmotionalQuiz = initEmotionalQuiz;
window.checkSortOrder  = window.checkSortOrder;
