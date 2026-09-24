# Bibliotecas de conversión

Estas dependencias se cargan localmente y solo cuando el formato las necesita.
Se descargaron de los paquetes oficiales de npm; se verificó su integridad SHA-512.

| Archivo | Procedencia | Licencia |
| --- | --- | --- |
| `libheif-1.22.2.mjs` | `heic-to@1.5.2/src/lib/libheif-without-unsafe-eval.js` | LGPL-3.0-or-later; ver `heic-to-LICENSE.txt` |
| `utif-3.1.0.js` | `utif@3.1.0/UTIF.js` | MIT; ver `utif-LICENSE.txt` |
| `pako-inflate-1.0.11.min.js` | `pako@1.0.11/dist/pako_inflate.min.js` | MIT y Zlib; ver `pako-LICENSE.txt` |

Los archivos de las bibliotecas no fueron modificados; solo se cambió su nombre.
El módulo HEIF se importa dinámicamente y se puede reemplazar por una versión
compatible. El adaptador de este proyecto está en `../photo-converter.worker.js`.

Código fuente e instrucciones de compilación de los autores:

- https://github.com/hoppergee/heic-to
- https://github.com/strukturag/libheif/tree/v1.22.2
- https://github.com/strukturag/libde265/tree/v1.0.16
- https://github.com/photopea/UTIF.js
- https://github.com/nodeca/pako/tree/1.0.11

El encabezado del decodificador indica libheif 1.22.2, libde265 1.0.16 y
`USE_UNSAFE_EVAL=0`. Se mantienen los avisos y las licencias de los autores.
