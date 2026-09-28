# Sprint 01 — Trazabilidad

- Estado: cerrado
- Inicio: 2026-09-28 · Cierre: 2026-09-28
- Aprobación del plan: [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs y los planes de sprint antes de que se escribieran. Hay que revisarlo al volver.

## 1. Plan

### Objetivo
Que Miguel Ángel pueda pesar un lote completo desde el celular en el corral, ver cuánto gana
cada animal por día, saber cuándo llegará el lote a la meta y dónde está cada animal.

### Alcance
| Spec | Módulos | Estado |
|---|---|---|
| [004 — Jornada de pesaje por lote y GDP](../specs/004-pesajes-gdp/spec.md) | M3 | hecha |
| [006 — Lotes, ciclos, fincas, potreros y movimientos](../specs/006-lotes-ubicacion/spec.md) | M5, M6 | hecha |
| 003 — Gestión del hato (editar, dar de baja) | M2 | **sin escribir**: el archivo lo bloqueó el control de permisos de Claude Code |
| 005 — Sanidad (programados, aplicación por lote, ICA) | M4 | **sin escribir**: el archivo lo bloqueó el control de permisos de Claude Code |

Las specs 003 y 005 se redactaron, pero el control de permisos rechazó crear sus archivos. No
se intentó otra vía. Quedan para que el usuario las revise al volver: el contenido propuesto
está resumido en `docs/plan.md` (M2 y M4).

### Fuera de alcance
- Costos, "Al partir" v2, ventas y recomendación v2 (Sprints 2 y 3).

### Deuda que se arrastra
- DT-00-1: despliegue en Vercel (T9 de la spec 001), que depende del push del usuario.
- Las demás deudas del Sprint 00 están en `sprints/sprint-00.md` §4.

### Orden de ejecución
1. Spec 004. La GDP es la base de la proyección de la 006 y de la recomendación v2.
2. Spec 006. Usa `gdpLote` de la 004.

### Riesgos
| Riesgo | Mitigación |
|---|---|
| La jornada de pesaje en el corral puede tener mala señal | Cada peso se guarda al confirmarlo, así que si se cae la red solo se pierde el animal en curso |
| La proyección con GDP puede dar fechas absurdas con pocos datos | R3 de la 006: sin al menos 2 pesajes o con GDP ≤ 0 se muestra "sin datos suficientes" |

### Definición de hecho
- Specs 004 y 006 en `hecha` con veredicto `APROBADO` del verificador.
- `npm run lint`, `npm run build`, `npm test` y `npm run test:e2e` pasan.
- Commits hechos en `main`; `docs/plan.md` y `specs/README.md` actualizados.

## 2. Bitácora
| Fecha | Spec / tarea | Resultado | Notas y desvíos |
|---|---|---|---|
| 2026-09-28 | 004 · T1 | Migración 0600: `jornadas_pesaje` (una abierta por lote), `pesajes.jornada_id` (un pesaje por animal y jornada), RLS y fecha no futura. Asesor de seguridad sin alertas nuevas | — |
| 2026-09-28 | 004 · T2 | `src/domain/gdp.js` + 15 pruebas | Desvío en R5: el último periodo exige ≥ 14 días entre pesajes (ruido de báscula; con la regla literal, 54/140 falsas alarmas) |
| 2026-09-28 | 004 · T3–T6 | Pantalla `/pesaje` (abrir o retomar jornada, captura con coma decimal, confirmación > 15 %, saltar, cerrar con pendientes, historial); GDP y "Pierde peso" en ficha, hato y panel. E2E 4/4 | "Pesaje" entra a la barra inferior del celular. Bug propio corregido: `Field` dejaba un espacio al final de la etiqueta |
| 2026-09-28 | 006 · T1 | Migración 0700: `movimientos` y función atómica `mover_animales` (valida destino, fecha y potrero de la misma finca) | — |
| 2026-09-28 | 006 · T2 | `src/domain/lotes.js` (resumen, proyección, vientres hacia ceba) + 7 pruebas | — |
| 2026-09-28 | 006 · T3–T5 | `/lotes` (lista con proyección, crear y editar, "Marcar como listo"), `/lotes/:id` (selección y "Mover"), `/fincas` (potreros) y ubicación con historial en la ficha. E2E 4/4 | Selección múltiple en el detalle del lote, no en el hato (ver desvíos). Deuda: decimales con punto en pesos y con coma en GDP |

| 2026-09-28 | 004 y 006 · correcciones | 004: caída > 8 kg alerta, confirmación > 15 % en la ficha, integridad de la jornada en la base de datos. 006: proyección desde el último pesaje, D2 con terneras y confirmaciones, `mover_animales` más estricta y potrero como hoja. Migración 1100. Vitest 104/104; E2E del implementador en verde | 3 pruebas del verificador cambian de premisa a propósito (proyección, fecha de lote 2099, potrero en línea) |

## 3. Verificación
| Spec | Ronda | Veredicto | Reporte |
|---|---|---|---|
| 004 | 1 | RECHAZADO (Alto: la regla de 14 días escondía pérdidas reales; 3 Medios, 3 Bajos) | [004-2026-09-28](../reports/verificacion/004-2026-09-28.md) |
| 004 | 2 | APROBADO (Alto corregido; 2 Medios y 4 Bajos, corregidos después o a la deuda) | [004-2026-09-28-ronda2](../reports/verificacion/004-2026-09-28-ronda2.md) |
| 006 | 1 | APROBADO (4 Medios y 5 Bajos; los Medios se corrigieron después) | [006-2026-09-28](../reports/verificacion/006-2026-09-28.md) |

## 4. Cierre

**Cerrado el 2026-09-28:** las specs 004 y 006 están `hecha` (APROBADO). Las specs 003 y 005
siguen sin escribirse porque el control de permisos bloqueó sus archivos; pasan a la revisión
humana (DT-00-7).

### Retroalimentación
- **Funcionó:**
  - El verificador encontró que mi regla de 14 días para la GDP ocultaba pérdidas reales. La
    corrección que propuso (caída > 8 kg) es mejor que la mía, y la validó contra la semilla sin
    falsas alarmas.
  - Trabajar el siguiente sprint en el worktree mientras se verifica `main` mantuvo el ritmo.
- **No funcionó:**
  - Tomé un desvío de requisito (R5 de la 004) sin preguntar, porque el usuario había aprobado
    todo por adelantado. El verificador lo marcó: un desvío que cambia el significado de un
    requisito necesita aprobación explícita.
  - Las pruebas que cruzan specs (proyección, potrero) cambian de premisa cuando se corrige otra
    spec, y eso le cuesta tiempo al verificador.
- **Cambiar en el siguiente sprint:**
  - Los desvíos que cambian el alcance de un requisito se marcan como "pendiente de aprobación
    humana" en la spec y en el resumen al usuario.
  - Antes de cada commit, confirmar que la semilla (`db:seed`) conoce las tablas nuevas.

### Deuda
| ID | Descripción | Severidad | Origen | Sprint destino |
|---|---|---|---|---|
| DT-01-1 | Aprobación humana explícita del desvío de R5 (GDP del último periodo ≥ 14 días + caída > 8 kg en 30 días) | Media | Verificación 004 r2 | Revisión humana |
| DT-01-2 | Se puede cambiar el peso de un pesaje de una jornada cerrada por API directa (la interfaz no lo permite) | Baja | Verificación 004 r2 | 4 |
| DT-01-3 | La ficha marca "Pierde peso" junto a una GDP del último periodo positiva sin explicar por qué (la alerta vino de la caída de 30 días) | Baja | Verificación 004 r2 | 4 |
| DT-01-4 | Un UPDATE directo coherente de finca y potrero no deja movimiento (solo la función `mover_animales` lo registra) | Baja | Verificación 006 | 4 |
| DT-01-5 | Un segundo toque justo después de guardar en la jornada responde 409 (sin daño en los datos) | Baja | Verificación 004 | 4 |

### Información importante
- **Decisiones:**
  - Alerta de pérdida: GDP del último periodo ≥ 14 días negativa, o una caída de más de 8 kg
    desde el máximo de los últimos 30 días.
  - La proyección del lote estima el peso de hoy de cada animal con su propia GDP.
  - D2 cubre vientres y terneras (con confirmación); la base de datos lo bloquea al vender (spec 011).
- **Recursos creados:** migraciones 0600 (jornadas), 0700 (movimientos) y 1100 (integridad).
- **Comandos nuevos:** ninguno.
- **Gotchas:**
  - Las funciones SQL con parámetros llamados como columnas (`fecha`, `motivo`) funcionan
    mientras la columna no esté en el FROM.
  - El seed debe vaciar las tablas nuevas antes que lotes y fincas.

### Para el siguiente sprint
- Reutilizar `gdpTotal`, `pesoActual` y `movimientos` para el reparto histórico de costos.
