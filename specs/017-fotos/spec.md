# Spec 017 — Fotos de los animales

- Estado: hecha
- Sprint: 5
- Módulos del plan: M2

## Contexto
Miguel quiere ver la foto de algunos animales. Las fotos del celular pesan 3–8 MB; hay que reducirlas
sin perder calidad visible antes de subirlas.

## Requisitos (EARS)
- R1 — Desde la ficha, el sistema deberá permitir tomar o elegir una foto y reemplazarla o quitarla
  (una foto por animal, bovino o caballo).
- R2 — Antes de subirla, el sistema deberá reducirla en el dispositivo a un lado máximo de 1.280 px,
  en WebP (o JPEG si el navegador no tiene WebP), con calidad 0,82; el archivo final no deberá pasar
  de 1 MB.
- R3 — Las fotos deberán guardarse en el bucket privado `fotos-animales`, que solo pueden leer y
  escribir los usuarios con perfil activo; no deberá aceptar otros tipos ni archivos de más de 1 MB.
- R4 — La lista de animales deberá mostrar una miniatura cuando haya foto.
- R5 — Subir fotos no deberá aumentar el paquete inicial: el código de almacenamiento se carga solo
  cuando se usa.
- R6 — Si la foto no se puede leer o subir, el sistema deberá decirlo con un mensaje claro sin perder
  la foto anterior.

## Diseño
- Migración 1700: bucket `fotos-animales` (privado, 1 MB, `image/webp`, `image/jpeg`) y políticas en
  `storage.objects` con `private.es_miembro()`; `animales.foto_path`.
- `src/lib/fotos.js`: `reducirImagen(file)` con `createImageBitmap` + `canvas.toBlob`; subida y URL
  firmada con fetch directo a la API de Storage usando el token de la sesión (sin storage-js).

## Tareas
- [ ] T1 Bucket y políticas — verifica: subir sin sesión devuelve 4xx
- [ ] T2 Reducir y subir desde la ficha; miniatura en la lista — verifica: E2E con una imagen de 3000×2000

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-10-04 (plan v2 del Sprint 05)
