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

/* 👇 LO MÁS IMPORTANTE */
window.auth = firebase.auth();
window.db = firebase.firestore();
window.storage = firebase.storage();

/* Debug */
console.log('🔥 Firebase inicializado:', {
  auth: !!window.auth,
  db: !!window.db,
  storage: !!window.storage
});
