# Spec 014 — Base limpia, guardas y bitácora

- Estado: en-progreso
- Sprint: 5
- Módulos del plan: base (DT-04-10)

## Contexto
La app publicada usa el mismo proyecto de Supabase que el desarrollo y las pruebas, con 140 reses de
ejemplo, y `npm run db:seed` borra todas las tablas. Miguel va a registrar sus animales reales: la base
de producción debe quedar limpia y protegida de los scripts y las pruebas.

## Requisitos (EARS)
- R1 — Al cerrar el sprint, la base de producción deberá quedar sin datos de ejemplo ni de pruebas
  (animales, lotes, fincas, costos, ventas…), conservando los usuarios reales con perfil y la fila de
  `parametros`, y sin el usuario de prueba del verificador.
- R2 — Si `npm run db:seed` o la suite E2E se ejecutan contra el proyecto de producción, el sistema
  deberá negarse antes de escribir nada, con un mensaje que diga por qué.
- R3 — Mientras no exista un proyecto de pruebas, `DEPLOY.md` y el README deberán explicar cómo
  crearlo y configurarlo (`.env.test`, `PROYECTO_PRUEBAS`).
- R4 — La retroalimentación del cliente deberá quedar en `docs/retroalimentacion.md`, con fecha,
  quién lo pidió y su estado.

## Fuera de alcance
- Crear el proyecto de pruebas (bloqueado por el límite de proyectos gratis de la organización).

## Diseño
- `scripts/seed-supabase.mjs` y `tests/e2e/helpers.js` comparan el host de `VITE_SUPABASE_URL` con
  `PROYECTO_PRODUCCION` (`eiszvbwwpqcqognkcfew`) y abortan.
- Limpieza al final del sprint, con SQL en el orden de las llaves foráneas y borrado del bucket de fotos.

## Tareas
- [ ] T1 Bitácora `docs/retroalimentacion.md` — verifica: el archivo existe con las 22 entradas
- [ ] T2 Guardas en seed y E2E — verifica: `npm run db:seed` contra producción termina con error y no borra nada
- [ ] T3 Documentar el proyecto de pruebas en `DEPLOY.md` — verifica: lectura
- [ ] T4 Limpiar producción (último paso del sprint) — verifica: conteos en 0 y solo usuarios reales

## Criterios de aceptación para el verificador
- Con la base limpia, la app abre sin errores y muestra estados vacíos útiles en cada pantalla.

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-10-04 (plan v2 del Sprint 05)
