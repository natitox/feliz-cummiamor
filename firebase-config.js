
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyABfB3ZeItipmcMGzmSkRqMT-B6Vz0Hn8I",
  authDomain:        "cartasnupi.firebaseapp.com",
  projectId:         "cartasnupi",
  storageBucket:     "cartasnupi.firebasestorage.app",
  messagingSenderId: "780189476433",
  appId:             "1:780189476433:web:1126b03a855a4e8b7dba70"
};

/* Alias públicos solo para mantener el login bonito */
const USERNAME_TO_EMAIL = Object.freeze({
  snupi:  "snupi@amor.app",
  natito: "natito@amor.app"
});

const ALLOWED_EMAILS = Object.freeze(Object.values(USERNAME_TO_EMAIL));

/* Esto no protege datos reales; solo desbloquea una sección visual */
const SECRET_PIN = "20061709";
