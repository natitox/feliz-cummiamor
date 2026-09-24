# Fotos del panel: Natito y Snupi

Versión 6 · 24 de septiembre de 2026

## Cómo instalar

1. Descomprime este ZIP y copia el contenido de `feliz-cummiamor-main` sobre tu proyecto actual, reemplazando los archivos de código.
2. Incluye los archivos nuevos `photo-upload-config.js`, `photo-formats.js`, `photo-converter.worker.js` y la carpeta `vendor` completa. No necesitan npm, compilación ni un servidor nuevo.
3. Conserva tus carpetas actuales `img` y `music`: sus archivos no estaban en el ZIP recibido. No borres tus fotos ni tus canciones locales al copiar esta actualización.
4. Publica los archivos de la misma manera que publicas actualmente la página. Abre el sitio con HTTPS, no haciendo doble clic sobre `index.html`.
5. Recarga la página. Si la tenías abierta durante la publicación, ciérrala y vuelve a abrirla para cargar la versión nueva. La caché y las referencias a los scripts se actualizaron a v6.
6. Inicia sesión como Natito, selecciona una imagen y pulsa «Subir foto al álbum». Repite con Snupi. Comprueba también una foto tomada por el celular.

La clave de ImgBB que proporcionaste ya está configurada. No tienes que volver a pegarla.

## Qué cambió

- Ambos usuarios suben a ImgBB. Firebase Auth identifica la cuenta y Firestore guarda el enlace, autor, descripción y fecha en `fotos`.
- La subida ya no utiliza Firebase Storage ni necesita activar ese servicio para las fotos nuevas.
- El autor se obtiene de la cuenta autenticada; no depende de una variable global que pueda estar incompleta o desactualizada.
- La selección identifica imágenes por su contenido. Un JPG no se rechaza por tener un MIME genérico o vacío.
- HEIC/HEIF y TIFF se convierten con bibliotecas incluidas en `vendor`. La decodificación se hace en un worker que se puede cancelar; no se carga el decodificador HEIC para un JPG normal.
- Se conserva el GIF original para no perder su animación. Se mantiene la transparencia en las conversiones a PNG.
- Hay vista previa, tamaño antes/después, arrastrar y soltar, progreso, cancelación y mensajes diferenciados para ImgBB y Firestore.
- Si ImgBB terminó y falla Firestore, se conserva la referencia para reintentar sin enviar otra copia. Normalmente se recupera también después de recargar, mientras se conserve el almacenamiento local de ese navegador.
- El reintento comprueba si la foto ya existe antes de crearla. Así Snupi no necesita permiso de edición cuando el primer guardado sí llegó al servidor pero se perdió la respuesta.
- Las selecciones y los pendientes se separan por cuenta. Un cambio de sesión cancela la subida en curso.
- Se corrigieron los anclajes del chat en móvil y se ajustó el panel de fotos para pantallas pequeñas.
- Ambos pueden ver las canciones; el formulario para agregarlas se muestra solo a Natito, de acuerdo con tus reglas.

## Formatos y límites reales

| Entrada | Resultado |
| --- | --- |
| JPG / JPEG / JFIF | JPG optimizado |
| PNG, WebP, AVIF, BMP, SVG, ICO | PNG, si el navegador puede decodificar ese formato |
| HEIC / HEIF / HIF | JPG, mediante libheif incluido |
| TIFF / TIF | PNG de la primera página |
| GIF | Archivo original, incluida la animación |

Las fotos estáticas se reducen a un máximo de 2400 píxeles en su lado mayor. WebP/AVIF animados y secuencias HEIF se convierten en una imagen estática.

No existe compatibilidad universal con cualquier archivo: RAW, PSD, formatos propietarios, variantes de códec no compatibles y archivos dañados pueden necesitar exportarse como JPG o PNG. El programa informa el problema sin dejar el formulario bloqueado.

Se aceptan originales de hasta 128 MiB para prepararlos; ImgBB recibe como máximo 32 MB. Los GIF de más de 32 MB no se comprimen para evitar perder la animación. La conversión HEIC/TIFF tiene un límite de 80 megapíxeles y 90 segundos para limitar el consumo del dispositivo.

## Firebase y reintentos

El código conserva todos los campos exigidos por las reglas que compartiste: `url`, `storagePath`, `descripcion`, `fecha`, `autor` y `originalName`. Para las fotos nuevas, `storagePath` contiene una referencia `imgbb/ID`; no representa un archivo en Firebase Storage.

Si están publicadas esas reglas y las cuentas usan `natito@amor.app` y `snupi@amor.app`, ambos tienen permiso para crear fotos. No hace falta abrir la base de datos al público ni cambiar el plan de Firebase para esta subida a ImgBB.

Si aparece «La foto ya está en ImgBB, pero Firebase no permitió agregarla al álbum», la imagen sí se subió. Revisa las reglas publicadas de `fotos` y reintenta con «Guardar foto en el álbum». La clave de ImgBB no corrige un permiso denegado por Firestore.

Se evita duplicar las subidas cuyo enlace ya se recibió. Si se pierde la conexión antes de recibir la respuesta de ImgBB, no es posible saber desde el cliente si ImgBB alcanzó a guardarla; un reintento podría generar otra copia.

Los enlaces de fotos antiguas siguen usándose como estaban. Eliminar un elemento del álbum desde el editor borra su documento de Firestore; no elimina automáticamente la imagen en ImgBB ni sus archivos antiguos en Firebase Storage.

En este sitio estático, la clave de ImgBB es visible en el JavaScript. Ocultarla requeriría un servidor intermediario. No se incluye en las URLs de las peticiones ni en los mensajes de error.

## Comprobaciones realizadas

- 27 comprobaciones locales: conversiones con archivos reales, HEIC también sin OffscreenCanvas, conservación del GIF y transparencia, reducción de resolución, cancelación y recuperación de errores.
- Subida y guardado como Natito y Snupi con Firebase e ImgBB simulados, incluida la restricción de Snupi a crear documentos.
- Prueba real separada de la clave de ImgBB: respuesta HTTP 200 y `success: true`, con una imagen de prueba configurada para expirar a los 60 segundos.
- Comprobación CORS de ImgBB: permite origen `*` y métodos GET, POST y OPTIONS.
- Revisión de sintaxis JavaScript y referencias entre los archivos incluidos.

No se inició sesión en tu Firebase ni se publicó tu página desde aquí. Por eso queda la prueba final contra tus reglas publicadas y tus dispositivos al reemplazar los archivos. La revisión del diseño se hizo sobre HTML/CSS; no se validó visualmente en un navegador real.

## Mejoras visuales para una siguiente versión

1. Separar el panel en pestañas «Fotos», «Cartas» y «Música» para acortar el recorrido en celular.
2. Unificar la tipografía del contenido y reservar la letra manuscrita para títulos y detalles románticos.
3. Dar más contraste a fechas, autores y textos secundarios.
4. Mostrar fecha y autor en las fotos, y permitir deslizar el dedo al abrir el álbum.
5. Agrupar los accesos flotantes para que chat, música, sorpresa y editor tengan posiciones previsibles.

Se conservaron los textos personales, el contenido de las cartas, los juegos, la paleta romántica y las rutas de tus imágenes y canciones.
