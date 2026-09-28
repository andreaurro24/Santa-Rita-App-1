# Sprint 01 — Trazabilidad

- Estado: en-ejecucion
- Inicio: 2026-09-28 · Cierre: —
- Aprobación del plan: [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs y los planes de sprint antes de que se escribieran. Hay que revisarlo al volver.

## 1. Plan

### Objetivo
Que Miguel Ángel pueda pesar un lote completo desde el celular en el corral, ver cuánto gana
cada animal por día, saber cuándo llegará el lote a la meta y dónde está cada animal.

### Alcance
| Spec | Módulos | Estado |
|---|---|---|
| [004 — Jornada de pesaje por lote y GDP](../specs/004-pesajes-gdp/spec.md) | M3 | en-verificacion |
| [006 — Lotes, ciclos, fincas, potreros y movimientos](../specs/006-lotes-ubicacion/spec.md) | M5, M6 | aprobada |
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

## 3. Verificación
| Spec | Ronda | Veredicto | Reporte |
|---|---|---|---|

## 4. Cierre

### Retroalimentación
- Funcionó:
- No funcionó:
- Cambiar en el siguiente sprint:

### Deuda
| ID | Descripción | Severidad | Origen | Sprint destino |
|---|---|---|---|---|

### Información importante
- Decisiones:
- Recursos creados (sin secretos):
- Comandos nuevos:
- Gotchas:

### Para el siguiente sprint
- 
