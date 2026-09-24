'use strict';

(() => {
  const config = window.PHOTO_UPLOAD_CONFIG;
  const workerURL = new URL('./photo-converter.worker.js?v=6', document.currentScript.src).href;
  const mimeByExtension = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
    heic: 'image/heic', heif: 'image/heif', hif: 'image/heif',
    tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml', ico: 'image/x-icon'
  };
  function abortError() { return new DOMException('Operación cancelada.', 'AbortError'); }
  function checkAbort(signal) { if (signal && signal.aborted) throw abortError(); }
  function validate(file) {
    if (!file) throw new Error('Selecciona una foto primero.');
    if (!file.size) throw new Error('La imagen está vacía. Elige otra foto.');
    if (file.size > config.maxSourceBytes) throw new Error('El archivo supera los 128 MB. Elige una copia más pequeña para poder prepararla.');
  }

  async function detectType(file) {
    const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
    const ascii = (a, b) => String.fromCharCode(...bytes.slice(a, b));
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
    if (bytes[0] === 137 && ascii(1, 4) === 'PNG') return 'image/png';
    if (/^GIF8[79]a$/.test(ascii(0, 6))) return 'image/gif';
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
    if (ascii(0, 2) === 'BM') return 'image/bmp';
    if ((ascii(0, 2) === 'II' && bytes[2] === 42) || (ascii(0, 2) === 'MM' && bytes[3] === 42)) return 'image/tiff';
    if (ascii(4, 8) === 'ftyp') {
      // Leer marcas alineadas, sin confundir AVIF (también HEIF) con HEIC.
      const brands = [];
      for (let offset = 8; offset < Math.min(bytes.length, 64); offset += 4) {
        if (offset !== 12) brands.push(ascii(offset, offset + 4));
      }
      if (brands.some(brand => /^(avif|avis)$/.test(brand))) return 'image/avif';
      if (brands.some(brand => /^(heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1)$/.test(brand))) return 'image/heic';
    }
    if (/<svg[\s>]/i.test(new TextDecoder().decode(bytes))) return 'image/svg+xml';
    const extension = (file.name || '').split('.').pop().toLowerCase();
    // El MIME que informa un celular puede estar vacío o ser application/octet-stream.
    return mimeByExtension[extension] || (file.type === 'image/jpg' ? 'image/jpeg' : file.type) || '';
  }

  function loadImage(blob, signal) {
    return new Promise((resolve, reject) => {
      checkAbort(signal);
      const image = new Image(), url = URL.createObjectURL(blob);
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', abort);
        image.onload = null; image.onerror = null;
      };
      const fail = error => {
        if (settled) return;
        settled = true; cleanup(); image.src = ''; URL.revokeObjectURL(url); reject(error);
      };
      const abort = () => fail(abortError());
      const timer = setTimeout(() => fail(new Error('El dispositivo tardó demasiado en abrir la imagen. Prueba con una copia más pequeña.')), 45000);
      if (signal) signal.addEventListener('abort', abort, { once: true });
      image.onload = () => {
        settled = true; cleanup();
        resolve({ image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) });
      };
      image.onerror = () => fail(new Error('Este archivo está dañado o su formato no se puede abrir en este navegador. Prueba exportándolo como JPG o PNG.'));
      image.src = url;
    });
  }

  function decodeInWorker(file, kind, signal) {
    return new Promise((resolve, reject) => {
      checkAbort(signal);
      if (typeof Worker !== 'function') {
        reject(new Error('Este navegador necesita actualizarse para convertir HEIC o TIFF. También puedes seleccionar una copia JPG.'));
        return;
      }
      const worker = new Worker(workerURL);
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true; clearTimeout(timer); worker.terminate();
        if (signal) signal.removeEventListener('abort', abort);
        error ? reject(error) : resolve(result);
      };
      const abort = () => finish(abortError());
      const timer = setTimeout(() => finish(new Error('La conversión tardó demasiado. Elige una copia de menor resolución y vuelve a intentar.')), 90000);
      if (signal) signal.addEventListener('abort', abort, { once: true });
      worker.onmessage = event => event.data.error ? finish(new Error(event.data.error)) : finish(null, event.data);
      worker.onerror = () => finish(new Error('No se pudo cargar el conversor de fotos. Recarga la página y vuelve a intentar.'));
      file.arrayBuffer().then(buffer => {
        if (!settled) worker.postMessage({ buffer, kind, maxSide: config.maxSide }, [buffer]);
      }).catch(error => finish(error));
    });
  }

  async function encode(source, width, height, mime, signal) {
    checkAbort(signal);
    if (!width || !height) throw new Error('La imagen no tiene dimensiones válidas.');
    const ratio = Math.min(1, config.maxSide / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('El dispositivo no pudo preparar la imagen. Cierra otras pestañas y reintenta.');
      if (mime === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, 0.88));
      checkAbort(signal);
      if (!blob || !blob.size) throw new Error('No se pudo convertir la foto. Prueba con una copia más pequeña.');
      return { blob, width: canvas.width, height: canvas.height };
    } finally { canvas.width = 1; canvas.height = 1; }
  }

  async function encodePixels(decoded, mime, signal) {
    const data = new ImageData(new Uint8ClampedArray(decoded.pixels), decoded.width, decoded.height);
    let source;
    try {
      if (typeof createImageBitmap === 'function') source = await createImageBitmap(data);
      else {
        source = document.createElement('canvas'); source.width = decoded.width; source.height = decoded.height;
        source.getContext('2d').putImageData(data, 0, 0);
      }
      return await encode(source, decoded.width, decoded.height, mime, signal);
    } finally {
      if (source && source.close) source.close();
      else if (source) { source.width = 1; source.height = 1; }
    }
  }

  async function prepare(file, { signal, onProgress = () => {} } = {}) {
    validate(file); checkAbort(signal);
    const mime = await detectType(file);
    checkAbort(signal);
    let result;
    if (/^image\/hei[cf]/.test(mime) || mime === 'image/tiff') {
      const kind = mime === 'image/tiff' ? 'tiff' : 'heif';
      onProgress(kind === 'tiff' ? 'Convirtiendo TIFF…' : 'Convirtiendo la foto HEIC/HEIF…');
      const decoded = await decodeInWorker(file, kind, signal);
      result = decoded.blob ? decoded : await encodePixels(decoded, kind === 'tiff' ? 'image/png' : 'image/jpeg', signal);
    } else {
      onProgress('Preparando tu foto…');
      const typed = mime.startsWith('image/') ? file.slice(0, file.size, mime) : file;
      const loaded = await loadImage(typed, signal);
      try {
        if (mime === 'image/gif') result = { blob: typed, width: loaded.width, height: loaded.height };
        else result = await encode(loaded.image, loaded.width, loaded.height, mime === 'image/jpeg' ? 'image/jpeg' : 'image/png', signal);
      } finally { loaded.release(); }
    }
    checkAbort(signal);
    if (result.blob.size > config.maxUploadBytes) {
      throw new Error('La imagen preparada supera los 32 MB que admite ImgBB. Si es un GIF, elige una versión más corta o pequeña.');
    }
    result.mime = result.blob.type;
    result.extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' })[result.mime];
    result.sourceMime = mime;
    if (!result.extension) throw new Error('No se pudo convertir la imagen a un formato compatible.');
    return result;
  }

  window.PhotoFormats = Object.freeze({ prepare, detectType, validate });
})();
