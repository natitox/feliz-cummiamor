'use strict';

(() => {
  const MAX_BYTES = 32 * 1024 * 1024;
  let busy = false, activeTask = null, cancelled = false, previewURL = '', pending = null;
  const el = id => document.getElementById(id);
  const mimeFor = file => file.type || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp' }[file.name.split('.').pop().toLowerCase()] || '');
  function validate(file) {
    if (!file) throw new Error('Selecciona una foto primero 📷');
    if (!file.size) throw new Error('La imagen está vacía. Elige otra foto.');
    if (file.size > MAX_BYTES) throw new Error('La foto supera los 32 MB. Elige una versión más pequeña.');
    if (/hei[cf]/i.test(file.type + file.name)) throw new Error('Esta foto está en HEIC. Expórtala como JPG o PNG para poder verla en todos los dispositivos.');
    if (!/^image\/(jpeg|png|webp|gif|avif|bmp)$/.test(mimeFor(file))) throw new Error('Elige una foto JPG, PNG, WebP, GIF, AVIF o BMP.');
  }
  function status(message, type = 'error') {
    const target = el('upload-status');
    target.textContent = message;
    target.className = 'panel-status ' + (type === 'ok' ? 'status-ok' : 'status-error');
    target.style.display = 'block';
    target.dataset.state = type;
  }
  function progress(value, label) {
    el('photo-progress').value = value;
    el('photo-progress-text').textContent = label;
  }
  function errorMessage(error) {
    const messages = {
      'storage/unauthorized': 'Tu cuenta no tiene permiso para subir fotos. Natito debe revisar los permisos de fotos en Firebase.',
      'storage/unauthenticated': 'Tu sesión venció. Vuelve a iniciar sesión y prueba de nuevo.',
      'storage/quota-exceeded': 'El almacenamiento no está disponible por su cuota o plan. Natito debe revisar Storage y el plan Blaze en Firebase.',
      'storage/bucket-not-found': 'No se encontró el álbum en el almacenamiento. Natito debe revisar el bucket configurado en Firebase.',
      'storage/no-default-bucket': 'Falta configurar el almacenamiento del álbum en Firebase.',
      'storage/project-not-found': 'No se encontró el proyecto de almacenamiento. Revisa la configuración de Firebase.',
      'storage/retry-limit-exceeded': 'La subida tardó demasiado. Revisa tu conexión y vuelve a intentar.',
      'storage/canceled': 'Subida cancelada. Puedes volver a intentarlo con la misma foto.',
      'storage/invalid-checksum': 'La foto llegó incompleta. Vuelve a intentar la subida.',
      'storage/unknown': 'El servidor de fotos no respondió como esperaba. Revisa la conexión; si persiste, Natito debe revisar Storage en Firebase.',
      'permission-denied': 'La imagen se subió, pero no hay permiso para agregarla al álbum. Revisa los permisos de la colección fotos y reintenta.',
      'unavailable': 'No pudimos conectar con el álbum. Conservamos tu selección para reintentar.'
    };
    return messages[error.code] || (error.code ? `No se pudo guardar la foto (${error.code}). Conservamos tu selección para reintentar.` : error.message) || 'No se pudo subir la foto. Vuelve a intentarlo.';
  }
  async function optimize(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('No pudimos abrir esta imagen. Prueba con otra foto JPG o PNG.')); img.src = url; });
      const mime = mimeFor(file);
      // Conservar las animaciones y evitar conversiones que aumenten el tamaño.
      if (mime === 'image/gif' || mime === 'image/avif') return { blob: file, mime };
      const ratio = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const outputMime = mime === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise(resolve => canvas.toBlob(resolve, outputMime, 0.9));
      return blob && blob.size < file.size ? { blob, mime: outputMime } : { blob: file, mime };
    } finally { URL.revokeObjectURL(url); }
  }
  window.previewPhoto = input => {
    if (busy) return;
    if (!input.files?.length) return;
    try {
      const file = input.files[0]; validate(file);
      if (previewURL) URL.revokeObjectURL(previewURL);
      previewURL = URL.createObjectURL(file);
      el('photo-preview').src = previewURL;
      el('photo-preview').alt = 'Vista previa de ' + file.name;
      el('photo-preview-wrap').style.display = 'block';
      el('photo-file-label').querySelector('.file-name-txt').textContent = `${file.name} · ${(file.size / 1048576).toFixed(1)} MB`;
      el('upload-status').style.display = 'none';
    } catch (error) {
      input.value = '';
      el('photo-preview-wrap').style.display = 'none';
      status(error.message);
    }
  };
  window.cancelPhotoUpload = () => {
    cancelled = true;
    if (activeTask) activeTask.cancel();
  };
  window.uploadPhoto = async () => {
    if (busy) return;
    const fileInput = el('photo-upload-input'), descInput = el('photo-upload-desc'), button = el('upload-photo-btn');
    const file = fileInput.files?.[0];
    try {
      validate(file);
      if (!window.auth?.currentUser) throw new Error('Vuelve a iniciar sesión antes de subir la foto.');
      if (!navigator.onLine) throw new Error('Estás sin conexión. Conserva la foto y reintenta al volver a conectarte.');
      if (!window.storage) throw new Error('No se cargó el almacenamiento. Recarga la página y prueba de nuevo.');
    } catch (error) { status(error.message); return; }
    busy = true; cancelled = false;
    const oldButton = button.innerHTML;
    button.disabled = true; fileInput.disabled = true; descInput.disabled = true;
    button.textContent = 'Guardando tu recuerdo…';
    el('photo-progress-wrap').hidden = false;
    el('cancel-photo-upload').hidden = false;
    el('upload-status').style.display = 'none';
    progress(0, 'Preparando tu foto…');
    try {
      // La misma referencia al reintentar evita duplicados si falló la escritura del álbum.
      if (!pending || pending.file !== file) {
        const doc = window.db.collection('fotos').doc();
        pending = { file, id: doc.id, path: '', uploaded: false, url: '' };
      }
      if (!pending.uploaded) {
        const optimized = await optimize(file);
        if (cancelled) throw { code: 'storage/canceled' };
        const extension = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/bmp':'bmp'})[optimized.mime];
        pending.path = `fotos/${pending.id}.${extension}`;
        const ref = window.storage.ref(pending.path);
        activeTask = ref.put(optimized.blob, { contentType: optimized.mime, cacheControl: 'public,max-age=31536000', customMetadata: { uploader: window.auth.currentUser.uid } });
        await new Promise((resolve, reject) => activeTask.on('state_changed', snap => {
          const value = Math.round(snap.bytesTransferred / Math.max(1, snap.totalBytes) * 100);
          progress(value, `Subiendo tu foto · ${value}%`);
        }, reject, resolve));
        pending.uploaded = true;
        pending.size = optimized.blob.size;
        activeTask = null;
      }
      // La subida terminó; cancelar ya no puede deshacer una escritura en curso.
      el('cancel-photo-upload').hidden = true;
      progress(100, 'Agregando la foto al álbum…');
      if (!pending.url) pending.url = await window.storage.ref(pending.path).getDownloadURL();
      await window.db.collection('fotos').doc(pending.id).set({
        url: pending.url, storagePath: pending.path, size: pending.size,
        descripcion: descInput.value.trim(), fecha: firebase.firestore.FieldValue.serverTimestamp(),
        autor: window._currentUsername, originalName: file.name
      }, { merge: true });
      pending = null;
      status('¡Tu foto ya está en el álbum! 🌸', 'ok');
      fileInput.value = ''; descInput.value = '';
      el('photo-preview-wrap').style.display = 'none';
      el('photo-preview').removeAttribute('src');
      el('photo-file-label').querySelector('.file-name-txt').textContent = 'Selecciona una imagen · hasta 32 MB';
      if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = ''; }
      await window.loadDynamicAlbum();
    } catch (error) {
      console.warn('Subida de foto:', error.code || error.message);
      status(errorMessage(error));
    } finally {
      busy = false; activeTask = null;
      button.disabled = false; fileInput.disabled = false; descInput.disabled = false;
      button.innerHTML = oldButton;
      el('photo-progress-wrap').hidden = true;
    }
  };
})();
