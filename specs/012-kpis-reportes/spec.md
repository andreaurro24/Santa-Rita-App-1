# Spec 012 — Indicadores del proyecto, reportes y formato de cifras

- Estado: en-progreso
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

## Desvíos durante la implementación (2026-09-28)
- **R3:**
  - El paquete inicial pasó de 940 kB a 530 kB sin comprimir: **154 KB comprimido (gzip)**.
    Queda 30 kB por encima de la meta sin comprimir porque supabase-js, React, el router y
    TanStack Query se necesitan antes de la primera pantalla.
  - Recharts (352 kB) ya solo se descarga en las pantallas con gráficos.
  - Se propone medir la meta en tamaño comprimido (< 200 KB), que es lo que se descarga en el
    campo. Lo decide el humano.
- **Pantalla de indicadores:** reemplaza la tarjeta "Metas del proyecto" del panel, que ahora
  enlaza a `/indicadores`.
- **Acciones de las tarjetas:** en la impresión se ocultan todas (`Card` las marca `no-print`).
- **Formato es-CO (R2):** pendiente. Se hará después de integrar el Sprint 3 en `main`, porque
  toca casi todas las pantallas y las pruebas del verificador.

## Tareas
- [ ] T1 Formato es-CO en toda la app + pruebas
- [x] T2 División del código por rutas
- [x] T3 KPI y página de indicadores
- [x] T4 Ficha imprimible
- [ ] T5 Verificador

## Aprobación
- [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs de los sprints antes de que se escribieran. Hay que confirmarlo al revisar.
