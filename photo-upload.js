'use strict';

(() => {
  const MAX_BYTES = 32 * 1024 * 1024;

  // =========================================================
  // IMGBB
  // =========================================================
  const IMGBB_API_KEY = '788afa9311150d93136c35f995797225';

  let busy = false;
  let activeTask = null;
  let cancelled = false;
  let previewURL = '';
  let pending = null;

  const el = id => document.getElementById(id);

  const mimeFor = file =>
    file.type ||
    ({
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      avif: 'image/avif',
      bmp: 'image/bmp'
    }[file.name.split('.').pop().toLowerCase()] || '');


  // =========================================================
  // VALIDAR FOTO
  // =========================================================
  function validate(file) {
    if (!file) {
      throw new Error('Selecciona una foto primero 📷');
    }

    if (!file.size) {
      throw new Error('La imagen está vacía. Elige otra foto.');
    }

    if (file.size > MAX_BYTES) {
      throw new Error(
        'La foto supera los 32 MB. Elige una versión más pequeña.'
      );
    }

    if (/hei[cf]/i.test(file.type + file.name)) {
      throw new Error(
        'Esta foto está en HEIC. Expórtala como JPG o PNG para poder verla en todos los dispositivos.'
      );
    }

    if (!/^image\/(jpeg|png|webp|gif|avif|bmp)$/.test(mimeFor(file))) {
      throw new Error(
        'Elige una foto JPG, PNG, WebP, GIF, AVIF o BMP.'
      );
    }
  }


  // =========================================================
  // ESTADO / MENSAJES
  // =========================================================
  function status(message, type = 'error') {
    const target = el('upload-status');

    if (!target) {
      console.warn(message);
      return;
    }

    target.textContent = message;
    target.className =
      'panel-status ' +
      (type === 'ok' ? 'status-ok' : 'status-error');

    target.style.display = 'block';
    target.dataset.state = type;
  }


  // =========================================================
  // PROGRESO
  // =========================================================
  function progress(value, label) {
    const bar = el('photo-progress');
    const text = el('photo-progress-text');

    if (bar) {
      bar.value = value;
    }

    if (text) {
      text.textContent = label;
    }
  }


  // =========================================================
  // MENSAJES DE ERROR
  // =========================================================
  function errorMessage(error) {
    const messages = {
      'imgbb/invalid-key':
        'La API key de ImgBB no es válida o fue rechazada.',

      'imgbb/upload-failed':
        'ImgBB no aceptó la foto. Revisa la API key o intenta con otra imagen.',

      'imgbb/network':
        'No pudimos conectar con ImgBB. Revisa tu conexión y vuelve a intentar.',

      'upload/canceled':
        'Subida cancelada. Puedes volver a intentarlo con la misma foto.',

      'permission-denied':
        'La foto se subió a ImgBB, pero Firestore no permitió agregarla al álbum.',

      'unavailable':
        'No pudimos conectar con el álbum. Conservamos tu selección para reintentar.'
    };

    return (
      messages[error?.code] ||
      error?.message ||
      'No se pudo subir la foto. Vuelve a intentarlo.'
    );
  }


  // =========================================================
  // OPTIMIZAR IMAGEN
  // =========================================================
  async function optimize(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();

    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;

        img.onerror = () =>
          reject(
            new Error(
              'No pudimos abrir esta imagen. Prueba con otra foto JPG o PNG.'
            )
          );

        img.src = url;
      });

      const mime = mimeFor(file);

      // Conservamos GIF y AVIF originales.
      if (mime === 'image/gif' || mime === 'image/avif') {
        return {
          blob: file,
          mime
        };
      }

      // Máximo 2400 px en el lado más grande.
      const ratio = Math.min(
        1,
        2400 / Math.max(img.naturalWidth, img.naturalHeight)
      );

      const canvas = document.createElement('canvas');

      canvas.width = Math.max(
        1,
        Math.round(img.naturalWidth * ratio)
      );

      canvas.height = Math.max(
        1,
        Math.round(img.naturalHeight * ratio)
      );

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return {
          blob: file,
          mime
        };
      }

      ctx.drawImage(
        img,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const outputMime =
        mime === 'image/png'
          ? 'image/png'
          : 'image/jpeg';

      const blob = await new Promise(resolve => {
        canvas.toBlob(
          resolve,
          outputMime,
          0.9
        );
      });

      // Si la optimización genera un archivo más grande,
      // conservamos el original.
      if (blob && blob.size < file.size) {
        return {
          blob,
          mime: outputMime
        };
      }

      return {
        blob: file,
        mime
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }


  // =========================================================
  // VISTA PREVIA
  // =========================================================
  window.previewPhoto = input => {
    if (busy) return;

    if (!input?.files?.length) {
      return;
    }

    try {
      const file = input.files[0];

      validate(file);

      if (previewURL) {
        URL.revokeObjectURL(previewURL);
      }

      previewURL = URL.createObjectURL(file);

      const preview = el('photo-preview');
      const previewWrap = el('photo-preview-wrap');
      const label = el('photo-file-label');
      const uploadStatus = el('upload-status');

      if (preview) {
        preview.src = previewURL;
        preview.alt = 'Vista previa de ' + file.name;
      }

      if (previewWrap) {
        previewWrap.style.display = 'block';
      }

      if (label) {
        const text = label.querySelector('.file-name-txt');

        if (text) {
          text.textContent =
            `${file.name} · ${(file.size / 1048576).toFixed(1)} MB`;
        }
      }

      if (uploadStatus) {
        uploadStatus.style.display = 'none';
      }
    } catch (error) {
      input.value = '';

      const previewWrap = el('photo-preview-wrap');

      if (previewWrap) {
        previewWrap.style.display = 'none';
      }

      status(error.message);
    }
  };


  // =========================================================
  // CANCELAR SUBIDA
  // =========================================================
  window.cancelPhotoUpload = () => {
    cancelled = true;

    if (activeTask?.cancel) {
      activeTask.cancel();
    }
  };


  // =========================================================
  // SUBIR FOTO A IMGBB
  // =========================================================
  window.uploadPhoto = async () => {
    if (busy) return;

    const fileInput = el('photo-upload-input');
    const descInput = el('photo-upload-desc');
    const button = el('upload-photo-btn');

    if (!fileInput || !button) {
      console.error(
        'No se encontró el formulario para subir fotos.'
      );

      return;
    }

    const file = fileInput.files?.[0];

    try {
      validate(file);

      if (!window.auth?.currentUser) {
        throw new Error(
          'Vuelve a iniciar sesión antes de subir la foto.'
        );
      }

      if (!navigator.onLine) {
        throw new Error(
          'Estás sin conexión. Conserva la foto y reintenta al volver a conectarte.'
        );
      }

      if (!window.db) {
        throw new Error(
          'No se cargó Firestore. Recarga la página y prueba de nuevo.'
        );
      }

      if (
        !IMGBB_API_KEY ||
        IMGBB_API_KEY === 'PEGA_AQUI_TU_API_KEY'
      ) {
        throw new Error(
          'Falta configurar la API key de ImgBB en photo-upload.js.'
        );
      }
    } catch (error) {
      status(error.message);
      return;
    }


    // =======================================================
    // BLOQUEAR FORMULARIO DURANTE LA SUBIDA
    // =======================================================
    busy = true;
    cancelled = false;

    const oldButton = button.innerHTML;

    button.disabled = true;
    fileInput.disabled = true;

    if (descInput) {
      descInput.disabled = true;
    }

    button.textContent = 'Guardando tu recuerdo…';

    const progressWrap = el('photo-progress-wrap');
    const cancelButton = el('cancel-photo-upload');
    const uploadStatus = el('upload-status');

    if (progressWrap) {
      progressWrap.hidden = false;
    }

    if (cancelButton) {
      cancelButton.hidden = false;
    }

    if (uploadStatus) {
      uploadStatus.style.display = 'none';
    }

    progress(0, 'Preparando tu foto…');


    try {
      // =====================================================
      // CREAR ID DE FIRESTORE
      // =====================================================
      if (!pending || pending.file !== file) {
        const doc =
          window.db
            .collection('fotos')
            .doc();

        pending = {
          file,
          id: doc.id,
          uploaded: false,
          url: '',
          imgbbId: '',
          size: 0
        };
      }


      // =====================================================
      // SUBIR A IMGBB
      // =====================================================
      if (!pending.uploaded) {
        progress(
          15,
          'Optimizando tu foto…'
        );

        const optimized = await optimize(file);

        if (cancelled) {
          throw {
            code: 'upload/canceled'
          };
        }


        progress(
          35,
          'Preparando la subida…'
        );


        // Controlador para poder cancelar fetch()
        const controller =
          new AbortController();

        activeTask = {
          cancel: () => controller.abort()
        };


        // ImgBB acepta directamente un archivo Blob
        // mediante multipart/form-data.
        const formData = new FormData();

        const extension =
          optimized.mime === 'image/png'
            ? 'png'
            : optimized.mime === 'image/webp'
              ? 'webp'
              : optimized.mime === 'image/gif'
                ? 'gif'
                : optimized.mime === 'image/avif'
                  ? 'avif'
                  : optimized.mime === 'image/bmp'
                    ? 'bmp'
                    : 'jpg';

        const cleanName =
          file.name
            .replace(/\.[^.]+$/, '')
            .replace(/[^\w\-]+/g, '-')
            .slice(0, 80) ||
          pending.id;

        formData.append(
          'image',
          optimized.blob,
          `${cleanName}.${extension}`
        );

        formData.append(
          'name',
          cleanName
        );


        progress(
          55,
          'Subiendo tu foto a ImgBB…'
        );


        let response;

        try {
          response = await fetch(
            'https://api.imgbb.com/1/upload?key=' +
              encodeURIComponent(IMGBB_API_KEY),
            {
              method: 'POST',
              body: formData,
              signal: controller.signal
            }
          );
        } catch (error) {
          if (error.name === 'AbortError') {
            throw {
              code: 'upload/canceled'
            };
          }

          const networkError =
            new Error(
              'No pudimos conectar con ImgBB.'
            );

          networkError.code =
            'imgbb/network';

          throw networkError;
        } finally {
          activeTask = null;
        }


        progress(
          85,
          'Procesando la foto…'
        );


        // =====================================================
        // LEER RESPUESTA DE IMGBB
        // =====================================================
        let result;

        try {
          result =
            await response.json();
        } catch (error) {
          const invalidResponse =
            new Error(
              'ImgBB devolvió una respuesta inválida.'
            );

          invalidResponse.code =
            'imgbb/upload-failed';

          throw invalidResponse;
        }


        if (
          !response.ok ||
          !result?.success ||
          !result?.data?.url
        ) {
          const apiMessage =
            result?.error?.message ||
            result?.data?.error?.message ||
            `ImgBB rechazó la subida (${response.status}).`;

          const apiError =
            new Error(apiMessage);

          if (/key|api/i.test(apiMessage)) {
            apiError.code =
              'imgbb/invalid-key';
          } else {
            apiError.code =
              'imgbb/upload-failed';
          }

          throw apiError;
        }


        // =====================================================
        // DATOS DEVUELTOS POR IMGBB
        // =====================================================
        pending.uploaded = true;

        pending.url =
          result.data.url;

        pending.imgbbId =
          result.data.id || '';

        pending.size =
          optimized.blob.size;


        progress(
          95,
          'Foto subida. Guardando en el álbum…'
        );
      }


      // =====================================================
      // GUARDAR EN FIRESTORE
      // =====================================================
      if (cancelButton) {
        cancelButton.hidden = true;
      }

      progress(
        100,
        'Agregando la foto al álbum…'
      );


      await window.db
        .collection('fotos')
        .doc(pending.id)
        .set(
          {
            url: pending.url,

            // Lo mantenemos para que tu código/reglas actuales
            // que esperan storagePath sigan funcionando.
            storagePath:
              `imgbb/${pending.imgbbId || pending.id}`,

            size: pending.size,

            descripcion:
              descInput
                ? descInput.value.trim()
                : '',

            fecha:
              firebase.firestore.FieldValue.serverTimestamp(),

            autor:
              window._currentUsername,

            originalName:
              file.name
          },
          {
            merge: true
          }
        );


      // =====================================================
      // ÉXITO
      // =====================================================
      pending = null;

      status(
        '¡Tu foto ya está en el álbum! 🌸',
        'ok'
      );


      fileInput.value = '';

      if (descInput) {
        descInput.value = '';
      }


      const previewWrap =
        el('photo-preview-wrap');

      const preview =
        el('photo-preview');

      const fileLabel =
        el('photo-file-label');


      if (previewWrap) {
        previewWrap.style.display =
          'none';
      }

      if (preview) {
        preview.removeAttribute('src');
      }

      if (fileLabel) {
        const text =
          fileLabel.querySelector(
            '.file-name-txt'
          );

        if (text) {
          text.textContent =
            'Selecciona una imagen · hasta 32 MB';
        }
      }


      if (previewURL) {
        URL.revokeObjectURL(
          previewURL
        );

        previewURL = '';
      }


      // Recargar el álbum
      if (
        typeof window.loadDynamicAlbum ===
        'function'
      ) {
        await window.loadDynamicAlbum();
      }

    } catch (error) {
      console.error(
        'Error al subir foto:',
        error
      );

      status(
        errorMessage(error)
      );
    } finally {
      // =====================================================
      // RESTAURAR INTERFAZ
      // =====================================================
      busy = false;
      activeTask = null;

      button.disabled = false;
      fileInput.disabled = false;

      if (descInput) {
        descInput.disabled = false;
      }

      button.innerHTML =
        oldButton;

      if (progressWrap) {
        progressWrap.hidden = true;
      }

      if (cancelButton) {
        cancelButton.hidden = true;
      }
    }
  };

})();
