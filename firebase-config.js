/* ═══════════════════════════════════════════════════════
   firebase-config.js
   ─────────────────────────────────────────────────────
   INSTRUCCIONES:
   1. Ve a https://console.firebase.google.com
   2. Crea un proyecto (o usa uno existente)
   3. Activa Authentication → Email/Password
   4. Activa Firestore Database
   5. Activa Storage
   6. Ve a Configuración del proyecto → Tus apps → Web
   7. Copia los valores y pégalos abajo
═══════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBspoBUsOIr_BoDyW3zWntRenu2aqXJaZ0",
  authDomain:        "cartasnupi.firebaseapp.com",
  projectId:         "cartasnupi",
  storageBucket:     "cartasnupi.firebasestorage.app",
  messagingSenderId: "780189476433",
  appId:             "1:780189476433:web:1126b03a855a4e8b7dba70"
};

/* ═══════════════════════════════════════════════════════
   USUARIOS PERMITIDOS
   ─────────────────────────────────────────────────────
   Estos son los únicos 2 usuarios que pueden acceder.
   Los emails son internos (no los verá nadie en pantalla).
   La contraseña de Firebase debe coincidir con la que
   configures en Firebase Authentication.

   PASOS PARA CREAR LOS USUARIOS EN FIREBASE:
   1. Ve a Authentication → Users → Add user
   2. Crea:  snupi@amor.app / 200617snupi
   3. Crea:  natito@amor.app / 200409natito
   (Puedes poner cualquier email/pass siempre que coincidan aquí)
═══════════════════════════════════════════════════════ */

const ALLOWED_USERS = {
  snupi: {
    email:    "snupi@amor.app",
    password: "200617snupi",       // ← CAMBIA ESTO antes de subir a producción
    display:  "snupi"
  },
  natito: {
    email:    "natito@amor.app",
    password: "200409natito",      // ← CAMBIA ESTO antes de subir a producción
    display:  "natito"
  }
};

/* Clave secreta para la sección sorpresa (8 dígitos)
   Puedes cambiarla por cualquier número de 8 dígitos */
const SECRET_PIN = "20061709";
