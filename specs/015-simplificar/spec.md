# Spec 015 — Simplificar para Miguel

- Estado: hecha
- Sprint: 5
- Módulos del plan: M9, M10, M12, diseño (002)

## Contexto
Miguel tiene 60 años y la app le resultó "engorrosa": muchas secciones, cifras pequeñas, clima y
dólar que no usa. Esta spec quita lo que sobra y deja a la vista solo lo de todos los días.

## Requisitos (EARS)
- R1 — El sistema no deberá mostrar el clima ni la TRM, ni usarlos en la recomendación (se quita la
  regla de sequía; el riesgo de pasto sale solo del semáforo que registra Miguel).
- R2 — El menú principal deberá tener 4 entradas: Inicio, Animales, Gastos y ¿Vendo?; el resto
  (Pesaje, Lotes, Fincas, Al partir, Ventas, Precio y pasto, Reporte, Importar) irá en "Más".
  Indicadores sale del menú pero su ruta sigue funcionando.
- R3 — Inicio deberá ofrecer 4 accesos grandes (Registrar animal, Pesar, Anotar gasto, ¿Vendo hoy?)
  y un resumen corto (reses activas, caballos, precio de referencia, alertas).
- R4 — El texto base deberá ser de al menos 18 px, con contraste AA, y los controles táctiles de al
  menos 56 px de alto en el celular.
- R5 — "¿Vendo?" deberá mostrar primero la respuesta en grande con una frase y el margen; escenarios,
  sensibilidad y punto de equilibrio irán en "Ver detalles".
- R6 — Si el usuario desplaza más allá del final de la página, la barra inferior no deberá moverse ni
  descuadrarse (celular y escritorio).

## Fuera de alcance
- Cambiar la identidad visual "Hierro y sabana".

## Diseño
- Se borran `src/api/weather.js`, `useClima`, `useTRM`, las tarjetas de clima y TRM; `analizarLoteV2`
  deja de recibir `clima`.
- `Layout.jsx`: `NAV` con 4 principales; `overscroll-behavior: none` en `html, body` y barra fija con
  `padding-bottom: env(safe-area-inset-bottom)`.
- `index.css`: `font-size` base 18 px; grises claros de texto reemplazados por tokens de más contraste.

## Tareas
- [ ] T1 Quitar clima y TRM (UI, datos y motor) — verifica: `npx vitest run`, búsqueda de "clima"
- [ ] T2 Menú 4 + Más e Inicio con accesos — verifica: E2E de navegación
- [ ] T3 Tipografía, contraste y botones — verifica: inspección a 375 px
- [ ] T4 ¿Vendo? simplificado — verifica: E2E de recomendación
- [ ] T5 Barra inferior estable — verifica: desplazar al final a 375 px

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-10-04 (plan v2 del Sprint 05)
