'use strict';

// Fotos en ImgBB; Firebase Auth y Firestore conservan las cuentas y el álbum.
// En un sitio estático, esta clave es visible en el navegador. No es una
// contraseña de Firebase. Para ocultarla, la subida necesita un servidor propio.
window.PHOTO_UPLOAD_CONFIG = Object.freeze({
  apiKey: '788afa9311150d93136c35f995797225',
  endpoint: 'https://api.imgbb.com/1/upload',
  maxSourceBytes: 128 * 1024 * 1024,
  // ImgBB permite hasta 32 MB por imagen. Se comprime antes de aplicar el límite.
  maxUploadBytes: 32 * 1000 * 1000,
  maxSide: 2400,
  timeoutMs: 120000
});
