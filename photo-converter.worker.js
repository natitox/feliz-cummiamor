'use strict';

// La decodificación pesada se ejecuta fuera de la interfaz. Al cancelar,
// el cliente termina este worker y libera también el decodificador.
const MAX_PIXELS = 80 * 1000 * 1000;

function checkDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('La imagen no tiene dimensiones válidas.');
  }
  if (width * height > MAX_PIXELS) {
    throw new Error('Esta imagen tiene demasiada resolución para convertirla aquí. Exporta una copia de menor resolución.');
  }
}

async function decodeHeif(buffer) {
  const { default: buildLibheif } = await import('./vendor/libheif-1.22.2.mjs');
  const lib = await buildLibheif();
  let decoder, images;
  try {
    decoder = new lib.HeifDecoder();
    images = decoder.decode(buffer);
    if (!images.length) throw new Error('No se encontró una imagen HEIC/HEIF válida.');
    const image = images[0]; // Live Photos / secuencias: conservar la foto principal.
    const width = image.get_width(), height = image.get_height();
    checkDimensions(width, height);
    const rgba = { width, height, data: new Uint8ClampedArray(width * height * 4) };
    for (let i = 3; i < rgba.data.length; i += 4) rgba.data[i] = 255;
    return await new Promise((resolve, reject) => {
      image.display(rgba, decoded => decoded ? resolve(decoded) : reject(new Error('No se pudo decodificar esta foto HEIC/HEIF.')));
    });
  } finally {
    if (images) images.forEach(image => image.free());
    if (decoder && decoder.decoder) lib.heif_context_free(decoder.decoder);
  }
}

function decodeTiff(buffer) {
  importScripts('./vendor/pako-inflate-1.0.11.min.js', './vendor/utif-3.1.0.js');
  const pages = self.UTIF.decode(buffer);
  const page = pages.find(item => item.t256 && item.t257);
  if (!page) throw new Error('No se encontró una imagen TIFF válida.');
  checkDimensions(Number(page.t256[0]), Number(page.t257[0]));
  self.UTIF.decodeImage(buffer, page);
  const data = self.UTIF.toRGBA8(page);
  return { width: page.width, height: page.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
}

self.onmessage = async event => {
  const { buffer, kind, maxSide } = event.data;
  try {
    const decoded = kind === 'tiff' ? decodeTiff(buffer) : await decodeHeif(buffer);
    // Escalar aquí evita transferir todos los píxeles a la interfaz en móviles.
    if (typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function') {
      const ratio = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
      const width = Math.max(1, Math.round(decoded.width * ratio));
      const height = Math.max(1, Math.round(decoded.height * ratio));
      let bitmap;
      const canvas = new OffscreenCanvas(width, height);
      try {
        bitmap = await createImageBitmap(new ImageData(decoded.data, decoded.width, decoded.height), {
          resizeWidth: width, resizeHeight: height, resizeQuality: 'high'
        });
        const ctx = canvas.getContext('2d');
        if (kind !== 'tiff') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); }
        ctx.drawImage(bitmap, 0, 0, width, height);
        const mime = kind === 'tiff' ? 'image/png' : 'image/jpeg';
        const blob = await canvas.convertToBlob({ type: mime, quality: 0.88 });
        self.postMessage({ blob, width, height });
        return;
      } finally {
        if (bitmap) bitmap.close();
        canvas.width = 1; canvas.height = 1;
      }
    }
    const data = decoded.data;
    self.postMessage({ pixels: data, width: decoded.width, height: decoded.height }, [data.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message || 'No se pudo convertir esta imagen.' });
  }
};
