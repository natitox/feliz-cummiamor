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
    password: "200617snupi",
    display:  "snupi"
  },
  natito: {
    email:    "natito@amor.app",
    password: "200409natito",
    display:  "natito"
  }
};

const SECRET_PIN = "20061709";
