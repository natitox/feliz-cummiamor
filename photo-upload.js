'use strict';

(() => {
  const config = window.PHOTO_UPLOAD_CONFIG;
  const el = id => document.getElementById(id);
  const journalPrefix = 'amor-photo-v6:';
  let selection = null, busy = false, phase = '', controller = null, previewURL = '';
  let generation = 0, lastUid = window.auth?.currentUser?.uid || null;

  function status(message, type = 'error') {
    const target = el('upload-status');
    target.textContent = message;
    target.className = 'panel-status status-' + type;
    target.style.display = 'block'; target.dataset.state = type;
  }
  function progress(value, label) {
    if (value === null) el('photo-progress').removeAttribute('value');
    else el('photo-progress').value = value;
    el('photo-progress-text').textContent = label;
  }
  function actor() {
    const user = window.auth?.currentUser;
    if (!user) throw new Error('Vuelve a iniciar sesión antes de subir la foto.');
    const email = (user.email || '').toLowerCase();
    const author = Object.keys(USERNAME_TO_EMAIL).find(name => USERNAME_TO_EMAIL[name] === email);
    if (!['natito', 'snupi'].includes(author)) throw new Error('Esta cuenta no tiene acceso al álbum.');
    return { user, author };
  }
  function refreshControls() {
    const uploaded = !!selection?.uploaded;
    el('photo-upload-input').disabled = busy || uploaded;
    el('photo-upload-desc').disabled = busy;
    el('photo-remove-btn').disabled = busy || uploaded;
    el('photo-remove-btn').hidden = !selection || uploaded;
    el('upload-photo-btn').disabled = busy || !selection;
    el('upload-photo-btn').textContent = busy
      ? (phase === 'prepare' ? 'Preparando tu foto…' : phase === 'save' ? 'Guardando en el álbum…' : 'Subiendo tu recuerdo…')
      : uploaded ? 'Guardar foto en el álbum' : 'Subir foto al álbum';
    el('photo-progress-wrap').hidden = !busy;
    el('cancel-photo-upload').hidden = !busy || phase === 'save';
    el('photo-file-label').classList.toggle('photo-disabled', busy || uploaded);
    el('photo-file-label').setAttribute('aria-busy', String(busy));
  }
  function preview(blobOrURL, name) {
    if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = ''; }
    const src = typeof blobOrURL === 'string' ? blobOrURL : (previewURL = URL.createObjectURL(blobOrURL));
    el('photo-preview').src = src; el('photo-preview').alt = 'Vista previa de ' + name;
    el('photo-preview-wrap').style.display = 'block';
  }
  function resetSelection(clearDescription = false) {
    selection = null;
    if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = ''; }
    el('photo-upload-input').value = '';
    el('photo-preview').removeAttribute('src'); el('photo-preview-wrap').style.display = 'none';
    el('photo-file-label').querySelector('.file-name-txt').textContent = 'Elegir una foto';
    el('photo-file-meta').textContent = 'Desde tu galería o tus archivos';
    if (clearDescription) el('photo-upload-desc').value = '';
    refreshControls();
  }
  function readableSize(size) {
    return size < 1000000 ? Math.max(1, Math.round(size / 1000)) + ' KB' : (size / 1000000).toFixed(1) + ' MB';
  }
  function safeImageURL(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && /(^|\.)ibb\.co$/.test(parsed.hostname) ? parsed.href : '';
    } catch (_) { return ''; }
  }
  function journalKey(record) { return journalPrefix + record.uid + ':' + record.docId; }
  function keepPending(record) {
    try { localStorage.setItem(journalKey(record), JSON.stringify(record)); return true; }
    catch (_) { return false; }
  }
  function removePending(record) { try { localStorage.removeItem(journalKey(record)); } catch (_) {} }
  function restorePending(user) {
    if (busy || selection || !user) return;
    try {
      const prefix = journalPrefix + user.uid + ':';
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(prefix)) continue;
        const record = JSON.parse(localStorage.getItem(key));
        if (!record || record.uid !== user.uid || typeof record.docId !== 'string' || record.docId.includes('/') ||
          !safeImageURL(record.url) || typeof record.providerId !== 'string' || !record.originalName || !record.mime) continue;
        selection = { uploaded: record, uid: user.uid, docId: record.docId };
        preview(record.url, record.originalName);
        el('photo-file-label').querySelector('.file-name-txt').textContent = record.originalName;
        el('photo-file-meta').textContent = 'La imagen ya está subida. Falta agregarla al álbum.';
        el('photo-upload-desc').value = record.descripcion || '';
        status('Recuperamos una foto pendiente. Pulsa «Guardar foto en el álbum» para terminar sin volver a subirla.', 'info');
        refreshControls(); break;
      }
    } catch (_) { /* El álbum funciona aunque el navegador limite el almacenamiento local. */ }
  }
  function errorMessage(error) {
    if (error.name === 'AbortError') return 'Operación cancelada. Tu selección sigue disponible para reintentar.';
    if (error.code === 'permission-denied') return 'La foto ya está en ImgBB, pero Firebase no permitió agregarla al álbum. Revisa las reglas de la colección fotos y pulsa «Guardar foto en el álbum» para reintentar.';
    if (error.code === 'unavailable' || error.code === 'deadline-exceeded') return 'No pudimos conectar con el álbum. Conservamos la foto para que puedas reintentar.';
    if (error.code?.startsWith('auth/')) return 'No pudimos comprobar tu sesión. Vuelve a iniciar sesión y reintenta.';
    return error.message || 'No se pudo guardar la foto. Conservamos tu selección para reintentar.';
  }
  async function prepareSelection(job, signal) {
    if (job.prepared) return;
    phase = 'prepare'; refreshControls();
    job.prepared = await window.PhotoFormats.prepare(job.file, { signal, onProgress: label => progress(null, label) });
    if (signal.aborted) throw new DOMException('Operación cancelada.', 'AbortError');
    preview(job.prepared.blob, job.file.name);
    el('photo-file-meta').textContent = `${readableSize(job.file.size)} → ${readableSize(job.prepared.blob.size)} · ${job.prepared.width} × ${job.prepared.height}`;
  }
  window.previewPhoto = async input => {
    if (busy || selection?.uploaded || !input.files?.length) return;
    const file = input.files[0]; resetSelection();
    try { window.PhotoFormats.validate(file); }
    catch (error) { status(error.message); return; }
    const job = { file, prepared: null, uploaded: null, uid: null, docId: null };
    selection = job; const run = ++generation;
    controller = new AbortController(); busy = true;
    el('photo-file-label').querySelector('.file-name-txt').textContent = file.name;
    el('photo-file-meta').textContent = readableSize(file.size);
    status('Estamos preparando tu foto…', 'info');
    try {
      await prepareSelection(job, controller.signal);
      if (run === generation) status('Tu foto está lista. Agrega una descripción si quieres y súbela al álbum.', 'info');
    } catch (error) {
      if (run === generation) status(errorMessage(error));
    } finally {
      if (run === generation) { busy = false; controller = null; phase = ''; refreshControls(); }
    }
  };
  window.removePhotoSelection = () => {
    if (busy || selection?.uploaded) return;
    ++generation; resetSelection(); el('upload-status').style.display = 'none';
  };
  window.cancelPhotoUpload = () => { if (phase !== 'save' && controller) controller.abort(); };

  function uploadToImgBB(job, author, signal) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(); let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true; signal.removeEventListener('abort', abort);
        error ? reject(error) : resolve(result);
      };
      const abort = () => { xhr.abort(); finish(new DOMException('Operación cancelada.', 'AbortError')); };
      if (signal.aborted) { abort(); return; }
      xhr.open('POST', config.endpoint, true); xhr.timeout = config.timeoutMs;
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) {
          const value = Math.round(event.loaded / event.total * 100);
          progress(value, value === 100 ? 'ImgBB está procesando tu foto…' : `Subiendo tu foto · ${value}%`);
        }
      };
      xhr.onload = () => {
        let body; try { body = JSON.parse(xhr.responseText); } catch (_) {}
        if (xhr.status >= 200 && xhr.status < 300 && body?.success === true) {
          const url = safeImageURL(body.data?.url || body.data?.display_url), id = body.data?.id;
          if (url && typeof id === 'string' && id.length) { finish(null, { url, id }); return; }
        }
        const detail = String(body?.error?.message || body?.status_txt || '');
        let message = 'ImgBB no pudo guardar la imagen. Conservamos tu selección; vuelve a intentarlo.';
        if (xhr.status === 401 || xhr.status === 403 || /api.*key|invalid.*key/i.test(detail)) message = 'ImgBB rechazó la clave de subida. Natito debe revisar la configuración de fotos.';
        else if (xhr.status === 429) message = 'ImgBB recibió demasiadas solicitudes. Espera un momento y vuelve a intentar.';
        else if (xhr.status === 413) message = 'ImgBB indica que la imagen es demasiado grande. Elige una copia más pequeña.';
        else if (xhr.status >= 500) message = 'ImgBB está teniendo un problema temporal. Tu foto sigue seleccionada para reintentar.';
        finish(new Error(message));
      };
      xhr.onerror = () => finish(new Error('No pudimos conectar con ImgBB. Revisa tu conexión y vuelve a intentar.'));
      xhr.ontimeout = () => finish(new Error('ImgBB tardó demasiado en responder. Conservamos tu foto para reintentar.'));
      xhr.onabort = () => finish(new DOMException('Operación cancelada.', 'AbortError'));
      signal.addEventListener('abort', abort, { once: true });
      const form = new FormData();
      // La clave va en el cuerpo, sin incluirla en URLs ni mensajes de error.
      form.append('key', config.apiKey);
      form.append('image', job.prepared.blob, `${author}-${job.docId}.${job.prepared.extension}`);
      form.append('name', `${author}-${job.docId}`);
      try { xhr.send(form); } catch (_) { finish(new Error('No se pudo iniciar la subida. Revisa la conexión y reintenta.')); }
    });
  }
  async function saveAlbum(record, user, author) {
    const ref = window.db.collection('fotos').doc(record.docId);
    // Reintento idempotente: Snupi solo necesita permiso para crear, no update.
    await window.db.runTransaction(async transaction => {
      if (window.auth.currentUser?.uid !== user.uid) throw new Error('Tu sesión cambió. Inicia sesión con la cuenta que subió esta foto.');
      const existing = await transaction.get(ref);
      if (existing.exists) {
        const data = existing.data();
        if (data.url === record.url && data.autor === author) return;
        throw new Error('Ya existe otra foto con esta referencia. Recarga el álbum antes de reintentar.');
      }
      transaction.set(ref, {
        url: record.url,
        // Referencia de ImgBB, conservada por compatibilidad con tus reglas.
        storagePath: 'imgbb/' + record.providerId,
        provider: 'imgbb', providerId: record.providerId,
        descripcion: record.descripcion, fecha: firebase.firestore.FieldValue.serverTimestamp(),
        autor: author, originalName: record.originalName,
        size: record.size, contentType: record.mime, width: record.width, height: record.height
      });
    });
  }
  window.uploadPhoto = async () => {
    if (busy) return;
    let identity;
    try {
      identity = actor();
      if (!selection) throw new Error('Selecciona una foto primero.');
      if (!navigator.onLine) throw new Error('Estás sin conexión. Tu selección sigue disponible para reintentar.');
      if (!window.db) throw new Error('No se cargó el álbum. Recarga la página y vuelve a intentar.');
      if (!config?.apiKey || !window.PhotoFormats) throw new Error('No se cargó la configuración de fotos. Recarga la página.');
    } catch (error) { status(errorMessage(error)); return; }
    const { user, author } = identity, job = selection;
    if (job.uid && job.uid !== user.uid) { status('Esta foto pendiente pertenece a otra sesión. Vuelve a entrar con esa cuenta.'); return; }
    const run = ++generation;
    controller = new AbortController(); const signal = controller.signal;
    busy = true; phase = job.uploaded ? 'save' : 'upload'; refreshControls();
    el('upload-status').style.display = 'none'; progress(null, 'Comprobando tu sesión…');
    try {
      await user.getIdToken();
      if (signal.aborted) throw new DOMException('Operación cancelada.', 'AbortError');
      job.uid = user.uid;
      if (!job.docId) job.docId = window.db.collection('fotos').doc().id;
      const description = el('photo-upload-desc').value.trim();
      if (!job.uploaded) {
        await prepareSelection(job, signal);
        phase = 'upload'; refreshControls(); progress(0, 'Subiendo tu foto…');
        const uploaded = await uploadToImgBB(job, author, signal);
        job.uploaded = {
          uid: user.uid, docId: job.docId, author, providerId: uploaded.id, url: uploaded.url,
          originalName: job.file.name, descripcion: description, size: job.prepared.blob.size,
          mime: job.prepared.mime, width: job.prepared.width, height: job.prepared.height
        };
      }
      job.uploaded.descripcion = description; keepPending(job.uploaded);
      if (signal.aborted) throw new DOMException('Operación cancelada.', 'AbortError');
      phase = 'save'; refreshControls(); progress(null, 'Agregando tu foto al álbum…');
      await saveAlbum(job.uploaded, user, author); removePending(job.uploaded);
      if (run === generation) {
        resetSelection(true); status('¡Tu foto ya está en el álbum! 🌸', 'ok');
        // No confundir un fallo al refrescar con un fallo al guardar.
        try { await window.loadDynamicAlbum?.(); } catch (_) {}
      }
    } catch (error) {
      if (run === generation) status(errorMessage(error));
      console.warn('Subida de foto:', error.code || error.name || 'error');
    } finally {
      if (run === generation) { busy = false; controller = null; phase = ''; refreshControls(); }
    }
  };
  const dropZone = el('photo-file-label');
  ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, event => {
    event.preventDefault(); if (!busy && !selection?.uploaded) dropZone.classList.add('photo-dragover');
  }));
  ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, event => {
    event.preventDefault(); dropZone.classList.remove('photo-dragover');
  }));
  dropZone.addEventListener('drop', event => {
    if (!busy && !selection?.uploaded && event.dataTransfer?.files?.length) window.previewPhoto({ files: event.dataTransfer.files });
  });
  window.auth?.onAuthStateChanged(user => {
    const uid = user?.uid || null;
    if (lastUid && lastUid !== uid) {
      controller?.abort(); ++generation; busy = false; controller = null; phase = '';
      resetSelection(true); el('upload-status').style.display = 'none';
    }
    lastUid = uid; restorePending(user);
  });
  window.addEventListener('beforeunload', event => {
    if (!busy) return;
    event.preventDefault(); event.returnValue = '';
  });
  refreshControls();
})();
