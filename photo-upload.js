'use strict';

(() => {
  const MAX_BYTES = 32 * 1024 * 1024;
  const IMGBB_API_KEY = 'PEGA_AQUI_TU_API_KEY';
  let busy = false, activeTask = null, cancelled = false, previewURL = '', pending = null;
  const el = id => document.getElementById(id);
  const mimeFor = file => file.type || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp' }[file.name.split('.').pop().toLowerCase()] || '');
  function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.split(',')[1];

      if (!base64) {
        reject(new Error('No se pudo convertir la foto para subirla.'));
        return;
      }

      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error('No se pudo leer la foto.'));
    };

    reader.readAsDataURL(blob);
  });
}
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
      'imgbb/invalid-key': 'La API key de ImgBB no es válida o fue rechazada.',
      'imgbb/upload-failed': 'ImgBB no aceptó la foto. Revisa la API key o intenta con otra imagen.',
      'imgbb/network': 'No pudimos conectar con ImgBB. Revisa tu conexión y vuelve a intentar.',
      'storage/canceled': 'Subida cancelada. Puedes volver a intentarlo con la misma foto.',
      'permission-denied': 'La foto se subió, pero no hay permiso para agregarla al álbum en Firestore.',
      'unavailable': 'No pudimos conectar con el álbum. Conservamos tu selección para reintentar.'
    };

    return (
      messages[error.code] ||
      error.message ||
      'No se pudo subir la foto. Vuelve a intentarlo.'
    );
  }
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

    const fileInput = el('photo-upload-input');
    const descInput = el('photo-upload-desc');
    const button = el('upload-photo-btn');
    const file = fileInput.files?.[0];

    try {
      validate(file);

      if (!window.auth?.currentUser) {
        throw new Error('Vuelve a iniciar sesión antes de subir la foto.');
      }

      if (!navigator.onLine) {
        throw new Error('Estás sin conexión. Conserva la foto y reintenta al volver a conectarte.');
      }

      if (!window.db) {
        throw new Error('No se cargó la base de datos. Recarga la página y prueba de nuevo.');
      }

      if (!IMGBB_API_KEY || IMGBB_API_KEY === 'PEGA_AQUI_TU_API_KEY') {
        throw new Error('Falta configurar la API key de ImgBB en photo-upload.js.');
      }
    } catch (error) {
      status(error.message);
      return;
    }

    busy = true;
    cancelled = false;

    const oldButton = button.innerHTML;
    button.disabled = true;
    fileInput.disabled = true;
    descInput.disabled = true;
    button.textContent = 'Guardando tu recuerdo…';

    el('photo-progress-wrap').hidden = false;
    el('cancel-photo-upload').hidden = false;
    el('upload-status').style.display = 'none';
    progress(0, 'Preparando tu foto…');

    try {
      // Mantener el mismo doc si reintentas
      if (!pending || pending.file !== file) {
        const doc = window.db.collection('fotos').doc();
        pending = {
          file,
          id: doc.id,
          path: '',
          uploaded: false,
          url: '',
          size: 0
        };
      }

      if (!pending.uploaded) {
        progress(15, 'Optimizando tu foto…');
        const optimized = await optimize(file);

        if (cancelled) throw { code: 'storage/canceled' };

        progress(35, 'Preparando la subida a ImgBB…');
        const base64 = await blobToBase64(optimized.blob);

        if (cancelled) throw { code: 'storage/canceled' };

        progress(60, 'Subiendo tu foto a ImgBB…');

        const controller = new AbortController();
        activeTask = {
          cancel: () => controller.abort()
        };

        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', base64);
        formData.append('name', file.name.replace(/\.[^.]+$/, '').slice(0, 80));

        let response;
        let result;

        try {
          response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData,
            signal: controller.signal
          });
        } catch (err) {
          if (err.name === 'AbortError') {
            throw { code: 'storage/canceled' };
          }
          const e = new Error('No pudimos conectar con ImgBB.');
          e.code = 'imgbb/network';
          throw e;
        } finally {
          activeTask = null;
        }

        try {
          result = await response.json();
        } catch (_) {
          const e = new Error('ImgBB devolvió una respuesta inválida.');
          e.code = 'imgbb/upload-failed';
          throw e;
        }

        if (!response.ok || !result?.success || !result?.data?.url) {
          const apiMessage =
            result?.error?.message ||
            result?.data?.error?.message ||
            'ImgBB rechazó la subida.';

          const e = new Error(apiMessage);
          e.code = /api key/i.test(apiMessage)
            ? 'imgbb/invalid-key'
            : 'imgbb/upload-failed';
          throw e;
        }

        pending.uploaded = true;
        pending.url = result.data.url;
        pending.path = `imgbb/${result.data.id || pending.id}`;
        pending.size = optimized.blob.size;
      }

      el('cancel-photo-upload').hidden = true;
      progress(100, 'Agregando la foto al álbum…');

      await window.db.collection('fotos').doc(pending.id).set({
        url: pending.url,
        storagePath: pending.path,
        size: pending.size,
        descripcion: descInput.value.trim(),
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
        autor: window._currentUsername,
        originalName: file.name
      }, { merge: true });

      pending = null;

      status('¡Tu foto ya está en el álbum! 🌸', 'ok');

      fileInput.value = '';
      descInput.value = '';
      el('photo-preview-wrap').style.display = 'none';
      el('photo-preview').removeAttribute('src');
      el('photo-file-label').querySelector('.file-name-txt').textContent =
        'Selecciona una imagen · hasta 32 MB';

      if (previewURL) {
        URL.revokeObjectURL(previewURL);
        previewURL = '';
      }

      await window.loadDynamicAlbum();
    } catch (error) {
      console.warn('Subida de foto:', error.code || error.message);
      status(errorMessage(error));
    } finally {
      busy = false;
      activeTask = null;
      button.disabled = false;
      fileInput.disabled = false;
      descInput.disabled = false;
      button.innerHTML = oldButton;
      el('photo-progress-wrap').hidden = true;
    }
  };
})();
