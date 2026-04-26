'use strict';

/* ════════════════════════════════════════════
   CORRECCIÓN PRINCIPAL:
   - Se elimina la doble inicialización de Firebase
     (firebase-config.js ya lo hace con el check apps.length)
   - Se agrega loadAndApplyEditableContent() para AMBOS usuarios
   - El editor visual (botón lápiz) solo se activa para natito
   - Se agrega chat interno natito ↔ snupi en tiempo real
════════════════════════════════════════════ */

// Reutilizar referencias globales de firebase-config.js
const auth    = window.auth;
const db      = window.db;
const storage = window.storage;

/* ════════════════════════════════════════════
   HELPERS DE SEGURIDAD
════════════════════════════════════════════ */
function isAllowedEmail(email) {
  return ALLOWED_EMAILS.includes((email || '').toLowerCase());
}

function isNatitoUser() {
  return (sessionStorage.getItem('_lu') || '') === 'natito';
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
  panelBtn.style.display = allowed ? '' : 'none';
  panelTab.style.display = 'none';
}

/* ════════════════════════════════════════════
   1. AUTH GUARD — si no hay sesión → login
════════════════════════════════════════════ */
auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = 'login.html'; return; }

  const signedEmail = (user.email || '').toLowerCase();
  if (!isAllowedEmail(signedEmail)) {
    await auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  window._currentUser     = user;
  window._currentUsername = sessionStorage.getItem('_lu') || 'amor';

  const nameEl = document.getElementById('user-display-name');
  if (nameEl) nameEl.textContent = window._currentUsername;

  initPrivatePanel();

  /* ──────────────────────────────────────────────
     CARGA DE CONTENIDO EDITABLE PARA AMBOS USUARIOS
     Este era el bug principal: solo natito llamaba al editor
     y cargaba los datos editados. snupi siempre veía el
     contenido hardcodeado original porque nunca leía Firestore.
     ────────────────────────────────────────────── */
  await loadAndApplyEditableContent();

  // Editor visual: SOLO para natito
  if (isNatitoUser() && typeof window.initNatitoEditor === 'function') {
    window.initNatitoEditor();
  }

  // Cargar datos dinámicos
  loadDynamicCartas();
  loadDynamicAlbum();
  loadDynamicMusica();

  // Chat para ambos usuarios
  initChat();
});

/* ════════════════════════════════════════════
   1B. CARGAR Y APLICAR CONTENIDO EDITABLE
   Se ejecuta para natito Y snupi. Aplica en runtime:
   preguntas, storyLines, textos, flip cards, puzzle image.
════════════════════════════════════════════ */
async function loadAndApplyEditableContent() {
  try {
    const snap = await db.collection('editor_data').doc('content').get();
    if (!snap.exists) return;
    const data = snap.data() || {};

    if (data.pin && window.CONFIG) window.CONFIG.PIN = String(data.pin);

    if (data.textos) {
      setHtmlSafe('.lock-title',        data.textos.lockTitle);
      setHtmlSafe('.lock-subtitle',     data.textos.lockSubtitle);
      setHtmlSafe('.welcome-title',     data.textos.welcomeTitle);
      setHtmlSafe('.final-letter-text', data.textos.finalLetter);
      setHtmlSafe('.letter-intro',      data.textos.letterIntro);
    }

    if (Array.isArray(data.preguntas) && data.preguntas.length) {
      window.preguntas               = JSON.parse(JSON.stringify(data.preguntas));
      window.__PREGUNTAS_EDITABLES__ = JSON.parse(JSON.stringify(data.preguntas));
    }

    if (Array.isArray(data.storyLines) && data.storyLines.length) {
      window.storyLines                = JSON.parse(JSON.stringify(data.storyLines));
      window.__STORY_LINES_EDITABLES__ = JSON.parse(JSON.stringify(data.storyLines));
    }

    if (Array.isArray(data.flipCards) && data.flipCards.length) {
      data.flipCards.forEach((card, i) => {
        setTextSafe(`#fc${i} .fc-front-title`, card.titulo || '');
        setTextSafe(`#fc${i} .fc-back-title`,  card.titulo || '');
        setTextSafe(`#fc${i} .fc-back-text`,   card.texto  || '');
        setTextSafe(`#fc${i} .fc-icon`,        card.icono  || '💌');
      });
    }

    if (data.puzzleImage) {
      window._puzzleImageUrl = data.puzzleImage;
      document.querySelectorAll('.puzzle-cell').forEach(cell => {
        cell.style.backgroundImage = `url("${data.puzzleImage}")`;
      });
    }

    console.log('✅ Contenido editable aplicado para:', window._currentUsername);
  } catch (err) {
    console.warn('⚠️ No se pudo cargar contenido editable:', err);
  }
}

function setHtmlSafe(selector, value) {
  if (!value) return;
  const el = document.querySelector(selector);
  if (el) el.innerHTML = value;
}

function setTextSafe(selector, value) {
  if (!value) return;
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

/* ════════════════════════════════════════════
   2. SECCIÓN SORPRESA FLOTANTE 💌
════════════════════════════════════════════ */
function injectSurpriseSection() {
  const html = `
  <button id="surprise-float-btn" class="surprise-float-btn" onclick="openSurprise()" aria-label="Sección secreta">💌<span class="surprise-badge">✨</span></button>
  <div id="surprise-modal" class="surprise-modal" role="dialog" aria-modal="true">
    <div class="surprise-backdrop" onclick="closeSurprise()"></div>
    <div class="surprise-content" id="surprise-content">
      <div id="surprise-lock-phase" class="surprise-phase active">
        <button class="surprise-close" onclick="closeSurprise()">✕</button>
        <div class="sp-deco">✦ ✦ ✦</div>
        <div class="sp-icon">🔐</div>
        <h2 class="sp-title">Eres muy especial <br/><em> para mi 🌹 </em></h2>
        <p class="sp-hint">Ingresa la clave q me se yo nms </p>
        <div class="sp-pin-display" id="sp-pin-display"></div>
        <div class="sp-keypad">
          ${[1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].map(k=>`<button class="sp-key ${k==='✓'?'sp-key-ok':k==='⌫'?'sp-key-del':''}" onclick="spKeyPress('${k}')">${k}</button>`).join('')}
        </div>
        <p class="sp-error" id="sp-error"></p>
      </div>
      <div id="surprise-question-phase" class="surprise-phase">
        <button class="surprise-close" onclick="closeSurprise()">✕</button>
        <div class="sp-hearts-bg" aria-hidden="true"><span>💖</span><span>🌸</span><span>💛</span><span>✨</span><span>💕</span><span>🌹</span><span>💖</span><span>🌸</span></div>
        <div class="sp-ring-wrap"><div class="sp-ring-pulse"></div><div class="sp-ring-pulse sp-ring-pulse-2"></div><div class="sp-icon sp-icon-ring">💍</div></div>
        <h2 class="sp-title sp-title-special">espero<br/> que le guste.<br/><em>eres mi vida sabías¿</em></h2>
        <div class="sp-divider-stars" aria-hidden="true">✦ ✦ ✦</div>
        <p class="sp-subtitle-q">Te lo queria decir antes, pero me daba cosita, pero estoy demasiado seguro de que quiero estár contigo.<br/>Estar a tu lado me hace tan felizzz y espero que también te de seguridad que yo solo quiero estar contigo<br/>y por eso queria preguntarte esto...</p>
        <p class="sp-big-question">¿Quieres<br/><em>pololear conmigo?</em> 💍</p>
        <div class="sp-answer-btns">
          <button class="sp-btn-si" onclick="surpriseAnswer('si')"><span class="sp-btn-icon">🐱</span><span>¡Sí, quiero!</span></button>
          <button class="sp-btn-no" onclick="surpriseAnswer('no')"><span class="sp-btn-icon">😢</span><span>No…</span></button>
        </div>
      </div>
      <div id="surprise-yes-phase" class="surprise-phase">
        <div class="surprise-confetti" id="surprise-confetti"></div>
        <button class="surprise-close" onclick="closeSurprise()">✕</button>
        <div class="sp-deco">🎉 💖 🎉</div>
        <div class="sp-gif-wrap"><img src="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2F0cXl4MHFyNG1pOTRwdzZmcWwxbm9kcGFsdTl4aWRtdTZhZG82NyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/1kymxb4RCuOwE/giphy.gif" alt="snoopy" class="sp-gif sp-gif-yes" /></div>
        <h2 class="sp-title sp-title-yes">¡¡Me dijo que siiiiiii!!!!!!! 🎊</h2>
        <p class="sp-msg-yes">Esto solo es el comienzo mi vida, te amo muchisimo 🌸😿<br/><br/>Prometo estar siempre para tí .<br/>Eres mi persona favorita .<br/><br/><em>Te amo infinitamente, mi nupi limda 💖</em></p>
        <p class="sp-hearts-row">💖 💛 🌸 💖 🌸 💛 💖</p>
      </div>
      <div id="surprise-no-phase" class="surprise-phase">
        <button class="surprise-close" onclick="closeSurprise()">✕</button>
        <div class="sp-deco">😿 🥺 😿</div>
        <div class="sp-gif-wrap"><img src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2RuMTdtbHA0eHZ3MG5iaWI3OWtueG5lN2ZieHBxbXo2cmF1dDIzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/8boMf1VXVHoJy/giphy.gif" alt="troste snupi" class="sp-gif sp-gif-no" /></div>
        <h2 class="sp-title sp-title-no">Está bien… 🥺</h2>
        <p class="sp-msg-no">I hate U bromita se que no me dirás q n0ooo t amo ASJDaskda💕<br/><br/>Este gatito y yo 😿😿😿<br/>pq te ganó la curiosidad y querias saber que habia en el no ASHJDAS TAMOOOOOO 🐱</p>
        <button class="sp-btn-retry" onclick="surpriseRetry()">💖 Quiero cambiar mi respuesta</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

let spPinValue = '';
window.spKeyPress = function(k) {
  if (k==='⌫'){spPinValue=spPinValue.slice(0,-1);renderSpPin();return;}
  if (k==='✓'){checkSecretPin();return;}
  if (spPinValue.length>=8) return;
  spPinValue+=k; renderSpPin();
};
function renderSpPin(){
  const el=document.getElementById('sp-pin-display');
  if(!el) return;
  el.innerHTML=Array.from({length:8},(_,i)=>`<span class="sp-dot ${i<spPinValue.length?'filled':''}"></span>`).join('');
}
function checkSecretPin(){
  if(spPinValue===SECRET_PIN){showSurprisePhase('surprise-question-phase');}
  else{
    const errEl=document.getElementById('sp-error');
    if(errEl){errEl.textContent='Código incorrecto 💔 intenta de nuevo';errEl.style.opacity='1';}
    const content=document.getElementById('surprise-content');
    if(content){content.classList.add('shake');setTimeout(()=>content.classList.remove('shake'),450);}
    spPinValue='';renderSpPin();
    setTimeout(()=>{if(errEl)errEl.style.opacity='0';},2000);
  }
}
window.surpriseAnswer=function(answer){
  if(answer==='si'){showSurprisePhase('surprise-yes-phase');launchSurpriseConfetti();}
  else{showSurprisePhase('surprise-no-phase');}
};
window.surpriseRetry=function(){showSurprisePhase('surprise-question-phase');};
function showSurprisePhase(id){
  document.querySelectorAll('.surprise-phase').forEach(p=>p.classList.remove('active'));
  const el=document.getElementById(id);if(el)el.classList.add('active');
}
function launchSurpriseConfetti(){
  const area=document.getElementById('surprise-confetti');if(!area)return;
  const items=['💖','🌸','✨','💛','🎊','💕','🥳','🌟'];
  for(let i=0;i<60;i++){
    const c=document.createElement('div');c.className='sc-piece';
    c.textContent=items[Math.floor(Math.random()*items.length)];
    c.style.left=Math.random()*100+'%';c.style.top='-10%';
    c.style.fontSize=(.9+Math.random()*1.1)+'rem';
    c.style.animationDuration=(1.5+Math.random()*2)+'s';
    c.style.animationDelay=(Math.random()*1.2)+'s';
    area.appendChild(c);
  }
  setTimeout(()=>{if(area)area.innerHTML='';},4000);
}
window.openSurprise=function(){
  spPinValue='';renderSpPin();showSurprisePhase('surprise-lock-phase');
  document.getElementById('surprise-modal').classList.add('open');
  document.body.style.overflow='hidden';
};
window.closeSurprise=function(){
  document.getElementById('surprise-modal').classList.remove('open');
  document.body.style.overflow='';
};

/* ════════════════════════════════════════════
   3. JUEGO DE MEMORIA
════════════════════════════════════════════ */
const memoryData=[
  {emoji:'💖',label:'Amor'},{emoji:'🌸',label:'Flores'},{emoji:'🎵',label:'Música'},
  {emoji:'🌙',label:'Noche'},{emoji:'☕',label:'Café'},{emoji:'🌍',label:'Mundo'},
  {emoji:'✨',label:'Magia'},{emoji:'🐱',label:'Gatito'}
];
let memCards=[],memFlipped=[],memSolved=0,memLocked=false;
function initMemoryGame(){
  const grid=document.getElementById('memory-grid');if(!grid)return;
  const pairs=[...memoryData,...memoryData].sort(()=>Math.random()-.5);
  memCards=[];memFlipped=[];memSolved=0;memLocked=false;grid.innerHTML='';
  pairs.forEach((item,i)=>{
    const card=document.createElement('div');card.className='mem-card';
    card.dataset.index=i;card.dataset.label=item.label;
    card.innerHTML=`<div class="mem-card-inner"><div class="mem-front">💌</div><div class="mem-back">${item.emoji}</div></div>`;
    card.onclick=()=>handleMemoryClick(i);grid.appendChild(card);
    memCards.push({el:card,label:item.label,flipped:false,matched:false});
  });
  const counter=document.getElementById('memory-counter');
  if(counter)counter.textContent=`0 / ${memoryData.length} pares`;
}
function handleMemoryClick(index){
  if(memLocked)return;const card=memCards[index];
  if(!card||card.flipped||card.matched)return;
  card.flipped=true;card.el.classList.add('flipped');memFlipped.push(index);
  if(memFlipped.length===2){
    memLocked=true;const[a,b]=memFlipped;
    if(memCards[a].label===memCards[b].label){
      memCards[a].el.classList.add('matched');memCards[b].el.classList.add('matched');
      memCards[a].matched=true;memCards[b].matched=true;memSolved++;memFlipped=[];memLocked=false;
      const counter=document.getElementById('memory-counter');
      if(counter)counter.textContent=`${memSolved} / ${memoryData.length} pares`;
      if(memSolved===memoryData.length)setTimeout(memoryComplete,600);
    }else{
      setTimeout(()=>{
        memCards[a].el.classList.remove('flipped');memCards[b].el.classList.remove('flipped');
        memCards[a].flipped=false;memCards[b].flipped=false;memFlipped=[];memLocked=false;
      },1100);
    }
  }
}
function memoryComplete(){
  const msgEl=document.getElementById('memory-msg');const btnWrap=document.getElementById('memory-unlock-wrap');
  if(msgEl){msgEl.textContent='¡Lo encontraste todo! Igual que encontraste mi corazón 💖';msgEl.style.opacity='1';}
  if(btnWrap)btnWrap.style.display='block';
}

/* ════════════════════════════════════════════
   4. JUEGO: ORDENA LA HISTORIA
════════════════════════════════════════════ */
const historyPhrases=[
  {id:1,text:"Hablamos en el cum de la tama y me curé bastamte ASJDAJASDKSAK✨"},
  {id:2,text:"Me enviaste soli, luego te meti a cf, después me dist laik a historia random y te hablé ASJsadjasjdas💬"},
  {id:3,text:" T invité a salir y te fui a buscar al preu en cande y tomamos cafecito🌸"},
  {id:4,text:"Comenzamos a salir seguido y te volviste parte de mi semana 💌"},
  {id:5,text:"Halloweennnnnn nuestra primera noche que dormimos juntoss 💖"},
  {id:6,text:" Comenzaron las salidas a la playita y te dije te quiero en un dia de noviembre que fuimos a comer pizza y habia vientito un poco heladito🌟"},
  {id:7,text:"Me dijiste te amo mientras dormia y tmb fuiste el mjr regalo que he tenido💖✨"},
  {id:8,text:"Nos dijimos te amo en la playita y se me pusieron los ojos llorosos y tu lloraste pq me amas mucho 💌✨"},
  {id:9,text:"Te pedí que fueras mi novia y me dijiste que si, asíq ahora somos novios y estamos muy enamoradossss 💛💛 ✨"}
];
let sortDragSrc=null,sortOrder=[];
function initSortGame(){
  const container=document.getElementById('sort-phrases');if(!container)return;
  sortOrder=[...historyPhrases].sort(()=>Math.random()-.5);container.innerHTML='';
  sortOrder.forEach((phrase,i)=>{
    const item=document.createElement('div');item.className='sort-item';
    item.draggable=true;item.dataset.id=phrase.id;
    item.innerHTML=`<span class="sort-num">${i+1}</span><span class="sort-text">${phrase.text}</span>`;
    item.addEventListener('dragstart',e=>{sortDragSrc=item;item.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    item.addEventListener('dragend',()=>item.classList.remove('dragging'));
    item.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';});
    item.addEventListener('dragenter',()=>item.classList.add('drag-over'));
    item.addEventListener('dragleave',()=>item.classList.remove('drag-over'));
    item.addEventListener('drop',e=>{
      e.preventDefault();item.classList.remove('drag-over');
      if(sortDragSrc&&sortDragSrc!==item){
        const items=[...container.children];
        const fromIdx=items.indexOf(sortDragSrc);const toIdx=items.indexOf(item);
        if(fromIdx<toIdx)container.insertBefore(sortDragSrc,item.nextSibling);
        else container.insertBefore(sortDragSrc,item);
        updateSortNumbers();
      }
    });
    let touchSrc=null;
    item.addEventListener('touchstart',e=>{touchSrc=item;item.classList.add('dragging');},{passive:true});
    item.addEventListener('touchend',e=>{
      item.classList.remove('dragging');
      const touch=e.changedTouches[0];
      const target=document.elementFromPoint(touch.clientX,touch.clientY)?.closest('.sort-item');
      if(target&&target!==touchSrc&&touchSrc){
        const items=[...container.children];
        const fromIdx=items.indexOf(touchSrc);const toIdx=items.indexOf(target);
        if(fromIdx<toIdx)container.insertBefore(touchSrc,target.nextSibling);
        else container.insertBefore(touchSrc,target);
        updateSortNumbers();
      }
    });
    container.appendChild(item);
  });
  const msgEl=document.getElementById('sort-msg');const btnWrap=document.getElementById('sort-unlock-wrap');
  if(msgEl){msgEl.textContent='';msgEl.className='sort-msg';}if(btnWrap)btnWrap.style.display='none';
}
function updateSortNumbers(){
  document.querySelectorAll('#sort-phrases .sort-num').forEach((num,i)=>{num.textContent=i+1;});
}
window.checkSortOrder=function(){
  const items=[...document.querySelectorAll('#sort-phrases .sort-item')];
  const order=items.map(el=>parseInt(el.dataset.id));const correct=historyPhrases.map(p=>p.id);
  const msgEl=document.getElementById('sort-msg');const btnWrap=document.getElementById('sort-unlock-wrap');
  if(JSON.stringify(order)===JSON.stringify(correct)){
    if(msgEl){msgEl.textContent='¡Perfecta! Así fue nuestra historia… y así la llevas en el corazón 💖';msgEl.className='sort-msg sort-msg-ok';}
    if(btnWrap)btnWrap.style.display='block';
    items.forEach(el=>el.classList.add('sort-correct'));
  }else{
    if(msgEl){msgEl.textContent='Hmm… el orden no es exacto, pero el amor sí 🌸 ¡Sigue intentando!';msgEl.className='sort-msg sort-msg-wrong';}
    items.forEach(el=>{el.classList.add('sort-wrong');setTimeout(()=>el.classList.remove('sort-wrong'),1000);});
  }
};

/* ════════════════════════════════════════════
   5. QUIZ EMOCIONAL
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
      { texto: "Salir a caminar sin rumbo 🚶‍♂️🚶‍♀️", resp: "Sin destino fijo, solo la mano de alguien que amas con tu alma !!!!osea yo¡¡¡ . Eso es libertad." },
      { texto: "Ver películas todo el día 🎬", resp: "Manta, snacks, y tú. Eso es lo que necesito para ser la persona más feliz, mentira no necesito todo eso, solo con estar contigo soy el más feliz, pero igual es buen plan." },
      { texto: "Sorprenderme con algo 🎁", resp: "Me encanta que quieras sorprenderme, como con el album. Cada momento contigo ya es una sorpresa bonita como tus ojos al mirarme." }
    ]
  },
  {
    pregunta: "¿Qué canción describe mejor lo que sientes ahora? 🎵",
    opciones: [
      { texto: "Una canción lenta y romántica estilo macccc 🎻", resp: "De esas que ponen en las películas cuando los protagonistas finalmente se miran. Eso somos." },
      { texto: "Algo alegre y bailable su sinaka 💃", resp: "Pq el gozo contigo es lo mjr q hay. ¡t amo!!!!" },
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
  const qEl = document.getElementById('equiz-question');
  const optsEl = document.getElementById('equiz-options');
  const countEl = document.getElementById('equiz-counter');
  const respEl = document.getElementById('equiz-response');
  const resultEl = document.getElementById('equiz-result');
  const cardEl = document.getElementById('equiz-card');
  const finalEl = document.getElementById('equiz-final');

  if (!q) return;

  if (resultEl) resultEl.style.display = 'none';
  if (finalEl) finalEl.style.display = 'none';
  if (cardEl) cardEl.style.display = 'block';

  if (qEl) qEl.textContent = q.pregunta;
  if (countEl) countEl.textContent = `${quizIndex + 1} / ${emojiQuiz.length}`;
  if (respEl) {
    respEl.textContent = '';
    respEl.style.opacity = '0';
  }

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
  optsEl.querySelectorAll('button').forEach(b => {
    b.disabled = true;
    b.classList.remove('selected');
  });

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
  const resultEl = document.getElementById('equiz-result');

  if (card) card.style.display = 'none';
  if (resultEl) resultEl.style.display = 'none';

  if (finalEl) {
    finalEl.style.display = 'block';
    finalEl.innerHTML = `
      <div class="q-heart">💖</div>
      <h3 style="margin-bottom:.6rem;">Nuestro quiz emocional terminó ✨</h3>
      <p style="line-height:1.6;">
        Cada respuesta tuya me hace sentir más cerquita de ti, más enamorado y más seguro de que quiero seguir viviendo muchísimos momentos bonitos contigo.
      </p>
      <p style="line-height:1.6;margin-top:.8rem;">
        Gracias por responder este quiz, mi amorcito hermoso. Eres mi lugar favorito. 💕
      </p>
    `;
  }
}

window.initEmotionalQuiz = initEmotionalQuiz;

/* ════════════════════════════════════════════
   6. CARGAR CARTAS / ÁLBUM / MÚSICA
════════════════════════════════════════════ */
window.loadDynamicCartas=async function(){
  const list=document.getElementById('dynamic-cards-grid') || document.getElementById('cartas-list');
  if(!list)return;
  try{
    const snap=await db.collection('cartas').orderBy('fecha','desc').get();
    if(snap.empty){
      list.innerHTML='<div class="dyn-empty">Aún no hay cartitas guardadas ✉️</div>';
      return;
    }
    list.innerHTML='';
    snap.forEach(doc=>{
      const d=doc.data()||{};
      const item=document.createElement('article');
      item.className='dyn-card';
      const autor=(d.autor||'natito').toString();
      const fecha=d.fecha?.toDate?formatDate(d.fecha.toDate()):'';
      item.innerHTML=`
        <div class="dyn-card-header">
          <span class="dyn-card-icon">💌</span>
          <span class="dyn-card-autor">${escapeHtml(autor)}</span>
        </div>
        <h3 class="dyn-card-titulo">${escapeHtml(d.titulo||'Sin título')}</h3>
        <div class="dyn-card-texto">${escapeHtml(d.contenido||'').replace(/\n/g,'<br>')}</div>
        <div class="dyn-card-fecha">${fecha || 'Con amor 💖'}</div>`;
      list.appendChild(item);
    });
  }catch(e){console.warn('loadDynamicCartas error:',e);}
};
function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildSpotifyEmbedUrl(url) {
  if (!url) return '';
  const clean = String(url).trim();

  if (clean.includes('open.spotify.com/embed/')) return clean;

  const match = clean.match(/open\.spotify\.com\/(track|album|playlist|episode|artist)\/([a-zA-Z0-9]+)/);
  if (match) {
    const [, type, id] = match;
    return `https://open.spotify.com/embed/${type}/${id}`;
  }

  return clean;
}

window.loadDynamicAlbum = async function () {
  const grid = document.getElementById('album-grid');
  if (!grid) return;

  try {
    Array.from(grid.querySelectorAll('.album-item.dynamic-album-item, .album-empty')).forEach(el => el.remove());

    let snap;
    try {
      snap = await db.collection('fotos').orderBy('fecha', 'desc').get();
    } catch (_) {
      snap = await db.collection('fotos').get();
    }

    if (snap.empty) {
      const empty = document.createElement('div');
      empty.className = 'album-empty';
      empty.textContent = 'Aún no hay fotitos nuevas en el álbum 🌸';
      grid.appendChild(empty);
      return;
    }

    const docs = snap.docs.slice().sort((a, b) => {
      const ad = a.data()?.fecha?.toMillis ? a.data().fecha.toMillis() : 0;
      const bd = b.data()?.fecha?.toMillis ? b.data().fecha.toMillis() : 0;
      return bd - ad;
    });

    docs.forEach(doc => {
      const d = doc.data() || {};
      const url = d.url || d.imageUrl || d.photoURL || d.src || d.downloadURL || '';
      const descripcion = d.descripcion || d.description || d.caption || '';

      if (!url) return;

      const item = document.createElement('div');
      item.className = 'album-item dynamic-album-item revealed';
      item.dataset.caption = descripcion;
      item.onclick = function () {
        if (typeof openLightbox === 'function') openLightbox(this);
      };

      item.innerHTML = `
        <div class="album-frame">
          <img src="${escapeAttr(url)}" alt="${escapeAttr(descripcion || 'Foto especial')}" loading="lazy" />
          <div class="album-overlay"><i class="fa-solid fa-expand"></i></div>
        </div>
        <p class="album-caption">${escapeHtml(descripcion || '')}</p>
      `;

      grid.appendChild(item);
    });

    if (typeof initAlbumAnimations === 'function') initAlbumAnimations();
  } catch (e) {
    console.warn('loadDynamicAlbum error:', e);
  }
};

window.loadDynamicMusica=async function(){
  const list=document.getElementById('spotify-songs-list');
  const empty=document.getElementById('spotify-no-songs');
  const embed=document.getElementById('spotify-embed-container');
  if(!list)return;
  try{
    Array.from(list.querySelectorAll('.spotify-song-item')).forEach(el=>el.remove());
    let snap;
    try { snap=await db.collection('musica').orderBy('fecha','desc').get(); }
    catch (_) { snap=await db.collection('musica').get(); }
    if(snap.empty){ if(empty) empty.style.display='block'; if(embed) embed.style.display='none'; return; }
    if(empty) empty.style.display='none';
    const docs=snap.docs.slice().sort((a,b)=>{
      const ad=a.data()?.fecha?.toMillis ? a.data().fecha.toMillis() : 0;
      const bd=b.data()?.fecha?.toMillis ? b.data().fecha.toMillis() : 0;
      return bd-ad;
    });
    let firstEmbed='';
    docs.forEach((doc,idx)=>{
      const d=doc.data()||{};
      const item=document.createElement('a');
      item.className='spotify-song-item';
      item.href=d.url||'#';
      item.target='_blank';
      item.rel='noopener noreferrer';
      item.innerHTML=`<span class="spotify-song-name"><i class="fa-brands fa-spotify"></i> ${escapeHtml(d.nombre||'Canción')}</span><span class="spotify-song-open">Abrir</span>`;
      list.appendChild(item);
      if(idx===0) firstEmbed = buildSpotifyEmbedUrl(d.url||'');
    });
    if(embed){
      if(firstEmbed){
        embed.innerHTML=`<iframe style="border-radius:12px" src="${escapeAttr(firstEmbed)}" width="100%" height="152" frameborder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
        embed.style.display='block';
      } else {
        embed.innerHTML='';
        embed.style.display='none';
      }
    }
  }catch(e){console.warn('loadDynamicMusica error:',e);}
};

/* ════════════════════════════════════════════
   7. PANEL: ENVIAR CARTA / UPLOAD FOTO / MÚSICA
════════════════════════════════════════════ */
window.createCarta=async function(){
  const btn=document.getElementById('create-carta-btn');
  const tituloEl=document.getElementById('carta-titulo-input');
  const contenidoEl=document.getElementById('carta-contenido-input');
  if(!tituloEl||!contenidoEl)return;
  const titulo=tituloEl.value.trim();
  const contenido=contenidoEl.value.trim();
  if(!titulo||!contenido){showCartaStatus('Completa título y contenido 💌','error');return;}
  if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin me-2"></i>Guardando…';}
  try{
    await db.collection('cartas').add({
      titulo,
      contenido,
      fecha:firebase.firestore.FieldValue.serverTimestamp(),
      autor:window._currentUsername||'natito'
    });
    showCartaStatus('¡Carta enviada con amor! 💖','ok');
    tituloEl.value=''; contenidoEl.value='';
    await loadDynamicCartas();
  }catch(err){console.error(err);showCartaStatus('Error al guardar. Intenta de nuevo 😔','error');}
  finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-paper-plane me-2"></i>Enviar carta';}}
};
window.enviarCarta = window.createCarta;

window.uploadPhoto=async function(){
  const fileInput=document.getElementById('photo-upload-input');
  const descInput=document.getElementById('photo-upload-desc');
  const btn=document.getElementById('upload-photo-btn');
  const previewWrap=document.getElementById('photo-preview-wrap');
  const previewImg=document.getElementById('photo-preview');
  if(!fileInput?.files?.length){showUploadStatus('Selecciona una foto 📷','error');return;}
  const file=fileInput.files[0];
  if(!file.type.startsWith('image/')){showUploadStatus('Solo se permiten imágenes','error');return;}
  if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin me-2"></i>Subiendo…';}
  try{
    const ref=storage.ref(`fotos/${Date.now()}_${file.name}`);
    await ref.put(file);
    const url=await ref.getDownloadURL();
    await db.collection('fotos').add({
      url,
      descripcion:descInput?.value?.trim()||'',
      fecha:firebase.firestore.FieldValue.serverTimestamp(),
      autor:window._currentUsername||'natito'
    });
    showUploadStatus('¡Foto subida! 🌸','ok');
    fileInput.value='';
    if(descInput)descInput.value='';
    if(previewWrap)previewWrap.style.display='none';
    if(previewImg)previewImg.src='';
    await loadDynamicAlbum();
  }catch(err){console.error(err);showUploadStatus('Error al subir. Intenta de nuevo','error');}
  finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-cloud-arrow-up me-2"></i>Subir foto al álbum';}}
};

window.addMusica=async function(){
  const nameInput=document.getElementById('musica-nombre-input');
  const urlInput=document.getElementById('musica-url-input');
  const btn=document.getElementById('add-musica-btn');
  const status=document.getElementById('musica-status');
  const nombre=nameInput?.value?.trim()||'';
  const url=urlInput?.value?.trim()||'';
  if(!nombre||!url){
    if(status){status.textContent='Completa nombre y enlace de Spotify 🎵';status.className='panel-status status-error';status.style.display='block';}
    return;
  }
  if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin me-2"></i>Guardando…';}
  try{
    await db.collection('musica').add({
      nombre,
      url,
      fecha:firebase.firestore.FieldValue.serverTimestamp(),
      autor:window._currentUsername||'natito'
    });
    if(status){status.textContent='Canción agregada 🎶';status.className='panel-status status-ok';status.style.display='block';}
    nameInput.value=''; urlInput.value='';
    await loadDynamicMusica();
  }catch(err){
    console.error(err);
    if(status){status.textContent='No se pudo guardar la canción';status.className='panel-status status-error';status.style.display='block';}
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-plus me-2"></i>Agregar canción';}
    if(status) setTimeout(()=>{status.style.display='none';},3000);
  }
};

function showUploadStatus(msg,type){
  const el=document.getElementById('upload-status');if(!el)return;
  el.textContent=msg;el.className='panel-status '+(type==='ok'?'status-ok':'status-error');
  el.style.display='block';setTimeout(()=>el.style.display='none',3000);
}
function showCartaStatus(msg,type){
  const el=document.getElementById('carta-status');if(!el)return;
  el.textContent=msg;el.className='panel-status '+(type==='ok'?'status-ok':'status-error');
  el.style.display='block';setTimeout(()=>el.style.display='none',3000);
}

/* ════════════════════════════════════════════
   8. LOGOUT
════════════════════════════════════════════ */
window.logoutUser=async function(){
  await auth.signOut();sessionStorage.clear();window.location.href='login.html';
};

function formatDate(date){
  if(!date)return'';
  return date.toLocaleDateString('es-CL',{year:'numeric',month:'long',day:'numeric'});
}

/* ════════════════════════════════════════════
   9. CHAT INTERNO natito ↔ snupi
   Colección: support_chat
   Campos: from, to, text, createdAt, read
   Además:
   - notificaciones web locales para natito
   - apertura del chat desde service worker
════════════════════════════════════════════ */
let chatOpen = false;
let chatUnsubscribe = null;
let chatNewCount = 0;
let chatLastNotifiedId = null;

function initChat() {
  injectChatUI();
  bindChatNotificationBridge();
  maybeEnableNatitoNotifications();
  listenChatMessages();
}

function injectChatUI() {
  if (document.getElementById('chat-widget')) return;
  const isNatito = isNatitoUser();
  const label = isNatito ? 'Chat con snupi' : 'Hablar con natito';
  const html = `
  <button id="chat-float-btn" class="chat-float-btn" onclick="toggleChat()" aria-label="Chat">
    <span class="chat-float-icon">💬</span>
    <span class="chat-badge" id="chat-badge"></span>
  </button>
  <div id="chat-widget" class="chat-widget" role="dialog" aria-label="Chat">
    <div class="chat-header">
      <span class="chat-header-avatar">${isNatito ? '🐱' : '🩷'}</span>
      <span class="chat-header-title">${label}</span>
      <button class="chat-close-btn" onclick="toggleChat()">✕</button>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div class="chat-empty-msg">Todavía no hay mensajes… di algo bonito 🌸</div>
    </div>
    <div class="chat-input-area">
      <textarea id="chat-input" class="chat-input" placeholder="Escribe algo bonito… 💖" rows="1" onkeydown="chatKeydown(event)"></textarea>
      <button class="chat-send-btn" onclick="sendChatMessage()" aria-label="Enviar">
        <i class="fa-solid fa-paper-plane"></i>
      </button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function getChatParticipants() {
  return ['natito', 'snupi'];
}

function isChatMessageAllowed(data) {
  const users = getChatParticipants();
  return users.includes(data.from) && users.includes(data.to);
}

window.toggleChat = function() {
  const widget = document.getElementById('chat-widget');
  if (!widget) return;
  chatOpen = !chatOpen;
  widget.classList.toggle('chat-widget-open', chatOpen);
  if (chatOpen) {
    chatNewCount = 0;
    updateChatBadge();
    markMessagesRead();
    setTimeout(() => {
      const msgs = document.getElementById('chat-messages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
      const input = document.getElementById('chat-input');
      if (input) input.focus();
    }, 100);
  }
};

window.chatKeydown = function(e) {
  const input = e.target;
  if (input) {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
};

window.sendChatMessage = async function() {
  const input = document.getElementById('chat-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  const from = window._currentUsername || 'anon';
  const to = from === 'natito' ? 'snupi' : 'natito';

  try {
    await db.collection('support_chat').add({
      from,
      to,
      text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      read: false
    });
  } catch (err) {
    console.error('Error enviando mensaje:', err);
    showToast('No se pudo enviar el mensaje 💔');
  }
};

function listenChatMessages() {
  if (chatUnsubscribe) chatUnsubscribe();

  chatUnsubscribe = db.collection('support_chat')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      const msgs = document.getElementById('chat-messages');
      if (!msgs) return;

      const me = window._currentUsername || '';
      const docs = snap.docs.filter(doc => isChatMessageAllowed(doc.data() || {}));

      if (!docs.length) {
        msgs.innerHTML = '<div class="chat-empty-msg">Todavía no hay mensajes… ¡di algo bonito! 🌸</div>';
        return;
      }

      msgs.innerHTML = '';

      docs.forEach(doc => {
        const d = doc.data() || {};
        const isMe = d.from === me;
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isMe ? 'chat-bubble-me' : 'chat-bubble-them'}`;
        const time = d.createdAt?.toDate
          ? d.createdAt.toDate().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
          : '';
        bubble.innerHTML = `<div class="chat-bubble-text">${escapeHtml(d.text || '')}</div><div class="chat-bubble-meta"><span class="chat-time">${time}</span>${isMe && d.read ? '<span class="chat-read">✓✓</span>' : ''}</div>`;
        msgs.appendChild(bubble);
      });

      msgs.scrollTop = msgs.scrollHeight;

      const unread = docs.filter(doc => {
        const d = doc.data() || {};
        return d.to === me && !d.read;
      });

      if (!chatOpen) {
        chatNewCount = unread.length;
        updateChatBadge();
      } else if (unread.length) {
        markMessagesRead();
      }

      maybeNotifyNatito(unread);
    }, err => console.warn('listenChatMessages error:', err));
}

function markMessagesRead() {
  const me = window._currentUsername || '';
  db.collection('support_chat')
    .where('to', '==', me)
    .where('read', '==', false)
    .get()
    .then(snap => {
      if (snap.empty) return;
      const batch = db.batch();
      snap.docs.forEach(doc => batch.update(doc.ref, { read: true }));
      return batch.commit();
    })
    .catch(err => console.warn('markMessagesRead error:', err));
}

function updateChatBadge() {
  const badge = document.getElementById('chat-badge');
  if (!badge) return;
  if (chatNewCount > 0) {
    badge.textContent = chatNewCount > 9 ? '9+' : String(chatNewCount);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function bindChatNotificationBridge() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'OPEN_CHAT') {
        const widget = document.getElementById('chat-widget');
        if (!widget) return;
        if (!chatOpen) window.toggleChat();
        window.location.hash = 'chat';
      }
    });
  }

  if (window.location.hash === '#chat') {
    setTimeout(() => {
      const widget = document.getElementById('chat-widget');
      if (widget && !chatOpen) window.toggleChat();
    }, 350);
  }
}

function maybeEnableNatitoNotifications() {
  if (!isNatitoUser()) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    setTimeout(() => {
      Notification.requestPermission().catch(() => {});
    }, 1200);
  }
}

async function maybeNotifyNatito(unreadDocs) {
  if (!isNatitoUser()) return;
  if (!Array.isArray(unreadDocs) || !unreadDocs.length) return;
  if (!document.hidden) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const newest = unreadDocs[unreadDocs.length - 1];
  if (!newest || newest.id === chatLastNotifiedId) return;

  const data = newest.data() || {};
  chatLastNotifiedId = newest.id;

  const payload = {
    type: 'CHAT_NOTIFY',
    title: '💬 Mensaje de snupi',
    body: (data.text || 'Tienes un mensaje nuevo 💖').slice(0, 120),
    url: './index.html#chat',
    tag: 'chat-snupi'
  };

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.active) {
      registration.active.postMessage(payload);
    } else {
      new Notification(payload.title, { body: payload.body });
    }
  } catch (err) {
    console.warn('No se pudo mostrar notificación:', err);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ════════════════════════════════════════════
   DOM READY
════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  injectSurpriseSection();
  renderSpPin();
  initMemoryGame();
  initSortGame();
  initEmotionalQuiz();

  const style=document.createElement('style');
  style.textContent=`
    .sp-hearts-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;border-radius:inherit}
    .sp-hearts-bg span{position:absolute;bottom:-10%;font-size:1.3rem;opacity:0;animation:spHeartFloat 5s ease-in infinite}
    .sp-hearts-bg span:nth-child(1){left:5%;animation-delay:0s;animation-duration:5s}
    .sp-hearts-bg span:nth-child(2){left:15%;animation-delay:.7s;animation-duration:6s}
    .sp-hearts-bg span:nth-child(3){left:28%;animation-delay:1.4s;animation-duration:4.5s}
    .sp-hearts-bg span:nth-child(4){left:42%;animation-delay:.3s;animation-duration:5.5s}
    .sp-hearts-bg span:nth-child(5){left:58%;animation-delay:1s;animation-duration:5s}
    .sp-hearts-bg span:nth-child(6){left:70%;animation-delay:2s;animation-duration:4s}
    .sp-hearts-bg span:nth-child(7){left:83%;animation-delay:.5s;animation-duration:6.5s}
    .sp-hearts-bg span:nth-child(8){left:93%;animation-delay:1.8s;animation-duration:5s}
    @keyframes spHeartFloat{0%{transform:translateY(0) scale(1);opacity:0}10%{opacity:.7}90%{opacity:.4}100%{transform:translateY(-110vh) scale(1.3);opacity:0}}
    .sp-ring-wrap{position:relative;display:flex;align-items:center;justify-content:center;margin:1rem auto .5rem;width:90px;height:90px;z-index:1}
    .sp-ring-pulse{position:absolute;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,rgba(230,49,102,.35),transparent 70%);animation:spPulse 2s ease-out infinite}
    .sp-ring-pulse-2{animation-delay:1s}
    @keyframes spPulse{0%{transform:scale(1);opacity:1}100%{transform:scale(2.2);opacity:0}}
    .sp-icon-ring{position:relative;font-size:3.2rem;z-index:2;animation:spRingBounce 1.6s ease-in-out infinite;display:block;line-height:1}
    @keyframes spRingBounce{0%,100%{transform:translateY(0) rotate(-8deg) scale(1)}30%{transform:translateY(-10px) rotate(8deg) scale(1.1)}60%{transform:translateY(-5px) rotate(-4deg) scale(1.05)}}
    .sp-divider-stars{color:#e63166;letter-spacing:8px;font-size:.75rem;opacity:.6;margin:.5rem 0;z-index:1;position:relative}
    .sp-big-question{font-size:clamp(1.4rem,5vw,2rem);font-family:'Dancing Script',cursive;font-weight:700;text-align:center;line-height:1.3;margin:.8rem 0 1.2rem;z-index:1;position:relative;background:linear-gradient(135deg,#e63166,#ff85a1,#e63166);background-size:200% 200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:spGradientShift 3s ease infinite}
    @keyframes spGradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
    .sp-big-question em{font-style:italic;-webkit-text-fill-color:transparent}
    #surprise-question-phase{position:relative;overflow:hidden}
    .sp-subtitle-q,.sp-title-special,.sp-answer-btns{position:relative;z-index:1}
    .sp-btn-si{animation:spBtnPulse 2.5s ease-in-out infinite}
    @keyframes spBtnPulse{0%,100%{box-shadow:0 0 0 0 rgba(230,49,102,.4)}50%{box-shadow:0 0 0 10px rgba(230,49,102,0)}}
  `;
  document.head.appendChild(style);
});

window.initMemoryGame=initMemoryGame;
window.initSortGame=initSortGame;
window.initEmotionalQuiz=initEmotionalQuiz;
