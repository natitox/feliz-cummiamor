'use strict';

/* CONFIG ORIGINAL (tuya) */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyABfB3ZeItipmcMGzmSkRqMT-B6Vz0Hn8I",
  authDomain: "cartasnupi.firebaseapp.com",
  projectId: "cartasnupi",
  storageBucket: "cartasnupi.firebasestorage.app",
  messagingSenderId: "780189476433",
  appId: "1:780189476433:web:1126b03a855a4e8b7dba70"
};

/* Alias públicos */
const USERNAME_TO_EMAIL = Object.freeze({
  snupi:  "snupi@amor.app",
  natito: "natito@amor.app"
});

const ALLOWED_EMAILS = Object.freeze(Object.values(USERNAME_TO_EMAIL));

/* PIN visual */
const SECRET_PIN = "20061709";

/* =========================
   🔥 INICIALIZACIÓN REAL
========================= */

// Inicializar Firebase UNA sola vez
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

// login.html solo carga Auth; no invocar servicios cuyo SDK no está presente.
window.auth = firebase.auth();
if (typeof firebase.firestore === 'function') window.db = firebase.firestore();
// Las fotos nuevas se envían a ImgBB; no se inicializa Firebase Storage.
