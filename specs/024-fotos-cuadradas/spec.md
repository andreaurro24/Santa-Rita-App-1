# Spec 024 — Fotos desde el celular, recortadas en cuadrado

- Estado: en-verificacion
- Sprint: 6
- Módulos del plan: M2

## Contexto
Hoy la foto solo se sube desde la ficha y se guarda tal cual sale de la cámara, reducida. El equipo
quiere ponerla desde el mismo registro del animal, tomarla o elegirla del celular, cuadrarla para
que el animal quede bien en el recuadro y aceptar fotos de cualquier peso, sin llenar el storage.
Además, las miniaturas descargan hoy la foto completa (DT-05-3).

## Requisitos (EARS)
- R1 — El formulario de registro y el de edición deberán tener un recuadro de foto con dos
  botones: **Tomar foto** (abre la cámara trasera del celular) y **Elegir de la galería**.
- R2 — Al elegir una foto, el sistema deberá abrir un **recortador cuadrado**:
  - Se arrastra la foto con el dedo o el mouse, y se acerca con un control deslizante o con dos
    dedos (pellizco).
  - Hay botones grandes "Listo", "Girar" y "Otra foto".
  - La parte fuera del cuadro se ve oscurecida.
- R3 — El sistema deberá aceptar fotos de cualquier tamaño o peso que el navegador sepa abrir (JPG,
  PNG, WebP; HEIC cuando el celular lo convierte), sin límite de entrada práctico (hasta 30 MB). Si
  no puede abrirla, deberá decirlo en palabras simples y pedir otra.
- R4 — Del recorte, el sistema deberá guardar dos imágenes WebP (JPEG si el navegador no hace
  WebP): una de **800 × 800 px** (calidad 0,82, máximo 300 KB) para la ficha y una **miniatura de
  200 × 200 px** (máximo 40 KB) para listas y tablas. El bucket sigue con su límite de 1 MB por
  archivo.
- R5 — No deberán quedar archivos huérfanos en el storage:
  - Al reemplazar una foto se borran la foto y la miniatura anteriores.
  - Al eliminar el animal se borran las dos.
  - Si falla la subida de una, se borra la otra.
  - Si el animal no llega a guardarse, no se sube nada.
- R6 — Si el animal se guarda pero la foto falla al subir, el animal deberá quedar guardado y la
  app deberá decir "El animal quedó guardado, pero la foto no subió: vuelve a intentarlo desde su
  ficha".
- R7 — Las listas y tablas deberán pedir solo la miniatura; la ficha pide la foto grande. El
  recortador se carga solo cuando se usa: el paquete inicial no crece más de 5 kB.

## Fuera de alcance
- Varias fotos por animal (galería).
- Filtros o edición de color.
- Editores de terceros: el recortador se hace sin dependencias nuevas, con canvas y eventos de
  puntero.

## Diseño
- Datos: no cambian las tablas. La miniatura vive junto a la foto con el mismo nombre más `-mini`
  (`<animal>/<ts>.webp` y `<animal>/<ts>-mini.webp`); `foto_path` guarda solo la grande y la ruta
  de la miniatura se deriva. Producción no tiene fotos, así que no hay nada que migrar.
- `src/lib/fotos.js`:
  - `abrirImagen(archivo)`: `createImageBitmap` con la orientación EXIF y un mensaje claro si
    falla.
  - `recortarCuadrado(bitmap, recorte, lado)`.
  - `subirFotoConMiniatura(animalId, recorte)`: sube las dos y, si falla una, borra la otra.
  - `borrarFoto(ruta)` borra también la miniatura.
- `src/components/RecortadorFoto.jsx` (carga diferida):
  - Un cuadro de 280 px en el celular y 360 px en escritorio.
  - Eventos de puntero para arrastrar y pellizcar; un control deslizante de zoom de 1× a 4×.
  - "Girar" rota 90°.
  - El recorte siempre llena el cuadro: no deja bordes vacíos.
- `src/components/CampoFoto.jsx` va en `AnimalForm`:
  - Guarda el recorte en memoria y lo sube después de que el animal tiene id.
  - Al editar, reemplaza y borra la anterior.
  - `FotoAnimal` de la ficha usa el mismo recortador.
- `src/data/fotos.js`: `useFotos(rutas, { mini: true })` firma las miniaturas.
- Decisión clave: un recortador propio y no `react-easy-crop`. Cuesta unas 150 líneas, evita una
  dependencia (CLAUDE.md pide preguntar antes de agregarlas) y deja controlar los tamaños de toque de
  48 px. Si el pellizco falla en algún celular, el control deslizante hace lo mismo.

## Tareas
- [x] T1 `fotos.js`: abrir, recortar, subir el par y borrar el par, con pruebas unitarias de la geometría del recorte y de los nombres — verifica: `npm test`
- [x] T2 `RecortadorFoto` con arrastre, zoom, pellizco y girar — verifica: E2E en 375 px (arrastrar y hacer zoom cambia el recorte; "Listo" entrega 800×800)
- [x] T3 `CampoFoto` en el formulario y en la ficha, subida después de guardar y limpieza de huérfanos — verifica: E2E (crear con foto → 2 objetos en el bucket; reemplazar → siguen 2; eliminar el animal → 0)
- [x] T4 Listas y tablas con miniatura (cierra DT-05-3) — verifica: en la red, la tabla solo pide archivos `-mini`

## Criterios de aceptación para el verificador
- Una foto de 8 MB y 4000×3000 px tomada en vertical queda derecha, cuadrada y por debajo de 300 KB.
- Reemplazar la foto tres veces deja exactamente 2 objetos del animal en el bucket.
- Con la red cortada al subir, el animal queda guardado, aparece el aviso de R6 y no queda ningún
  objeto suelto.
- El paquete inicial no crece más de 5 kB (comparar `npm run build`).

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-10-05 ("Aprobo. Construye todo de una.")
