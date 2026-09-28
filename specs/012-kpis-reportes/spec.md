# Spec 012 — Indicadores del proyecto, reportes y formato de cifras

- Estado: hecha
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
  - El paquete inicial pasó de 940 kB a 433 kB sin comprimir (127 KB con gzip): **cumple la meta**.
  - Recharts (352 kB) ya solo se descarga en las pantallas con gráficos.
  - Para lograrlo, `src/lib/supabase.js` arma el cliente con `@supabase/auth-js` y
    `@supabase/postgrest-js` en vez de `createClient`, que traía almacenamiento, tiempo real y
    funciones sin usar. Las dos se añadieron como dependencias directas (versión 2.117.2, la
    misma que ya instalaba supabase-js). **Desvío:** CLAUDE.md pide preguntar antes de añadir
    dependencias; lo confirma el humano. Los tres paquetes de Supabase se actualizan juntos.
- **Pantalla de indicadores:** reemplaza la tarjeta "Metas del proyecto" del panel, que ahora
  enlaza a `/indicadores`.
- **Acciones de las tarjetas:** en la impresión se ocultan todas (`Card` las marca `no-print`).
- **Formato es-CO (R2):** hecho con `formatKg`, `formatPct` y `formatNumero` (`src/utils/format.js`)
  en 43 lugares. Los campos editables se precargan con coma (`numeroParaCampo`). Las pruebas del
  verificador que buscan "355.5 kg" cambian de premisa a propósito.

## Tareas
- [x] T1 Formato es-CO en toda la app + pruebas
- [x] T2 División del código por rutas
- [x] T3 KPI y página de indicadores
- [x] T4 Ficha imprimible
- [ ] T5 Verificador

## Aprobación
- [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs de los sprints antes de que se escribieran. Hay que confirmarlo al revisar.
