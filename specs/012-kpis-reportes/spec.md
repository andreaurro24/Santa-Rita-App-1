# Spec 012 — Indicadores del proyecto, reportes y formato de cifras

- Estado: aprobada
- Sprint: 4
- Módulos del plan: M12 (+ deuda DT-00-2 y DT-00-5)

## Contexto
El proyecto se evalúa contra la línea base AS-IS (`docs/plan.md` §8). La app debe medir esos
KPI con los datos reales, no con textos fijos. Además, las cifras usan hoy dos separadores
decimales distintos (DT-00-2), y el paquete de JavaScript pesa 940 kB (DT-00-5), algo que se
nota en el celular del campo.

## Requisitos (EARS)
- R1 — El sistema deberá mostrar una pantalla de indicadores con los KPI del plan §8
  calculados:
  - porcentaje del hato con registro digital;
  - porcentaje de animales con historial de peso (≥ 2 pesajes);
  - días desde el último pesaje por lote;
  - fuentes externas integradas;
  - ventas registradas con la recomendación guardada, y cuántas la siguieron.
- R2 — El sistema deberá mostrar cada kilo, porcentaje y cifra decimal con coma decimal y
  punto de miles (es-CO), en toda la app y en el reporte impreso.
- R3 — El sistema deberá cargar cada pantalla por separado (división del código por rutas),
  con un paquete inicial de menos de 500 kB.
- R4 — El sistema deberá ofrecer la ficha del animal imprimible (identificación, pesos, sanidad,
  ubicación y costos) con el mismo estilo del reporte.

## Diseño
- `src/utils/format.js`: `formatKg`, `formatPct` y `formatDecimal` con `Intl.NumberFormat('es-CO')`,
  usados en todas las páginas.
- `React.lazy` + `Suspense` en `App.jsx`, por ruta.
- Página `/indicadores`, con el dominio en `src/domain/kpis.js` y sus pruebas.
- Los E2E que buscan textos como "355.5 kg" se actualizan a "355,5 kg".

## Tareas
- [ ] T1 Formato es-CO en toda la app + pruebas
- [ ] T2 División del código por rutas
- [ ] T3 KPI y página de indicadores
- [ ] T4 Ficha imprimible
- [ ] T5 Verificador

## Aprobación
- [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs de los sprints antes de que se escribieran. Hay que confirmarlo al revisar.
