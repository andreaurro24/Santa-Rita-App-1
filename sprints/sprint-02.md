# Sprint 02 — Terceros y costos

- Estado: en-ejecucion
- Inicio: 2026-09-28 · Cierre: —
- Aprobación del plan: [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs y los planes antes de que se escribieran. Hay que confirmarlo al revisar.

## 1. Plan

### Objetivo
Saber cuánto cuesta de verdad cada animal y cada lote, y tener bajo control los animales que
están en fincas de tenedores "Al partir".

### Alcance
| Spec | Módulos | Estado |
|---|---|---|
| [008 — Insumos y costos](../specs/008-costos/spec.md) | M8 | en-verificacion (ronda 2) |
| [007 — "Al partir": tenedores, contratos y visitas](../specs/007-al-partir/spec.md) | M7 | en-verificacion (ronda 2) |

### Fuera de alcance
- Recomendación v2, ventas y liquidación del tenedor (Sprint 3).

### Deuda que se arrastra
- DT-00-1: despliegue en Vercel (push del usuario).
- DT-00-2: separador decimal inconsistente (punto en kg, coma en GDP), para el Sprint 4.
- Specs 003 y 005 sin escribir (bloqueadas por el control de permisos).

### Orden de ejecución
1. 008. La recomendación v2 (Sprint 3) depende del costo acumulado.
2. 007. Reutiliza pesajes, movimientos y GDP.

### Riesgos
| Riesgo | Mitigación |
|---|---|
| El reparto de costos por fecha exige saber qué animales estaban en el lote en esa fecha | Simplificación declarada en la 008: se usa la pertenencia actual más la fecha de ingreso |
| Las pruebas del implementador y del verificador comparten la base de desarrollo | Datos de prueba con prefijo y limpieza propia; las suites no se corren en paralelo |

### Definición de hecho
- Specs 007 y 008 en `hecha` con `APROBADO`; lint, build y pruebas en verde; commits en `main`.

## 2. Bitácora
| Fecha | Spec / tarea | Resultado | Notas y desvíos |
|---|---|---|---|
| 2026-09-28 | 008 · T1–T5 | Migración 0900, dominio de reparto, `/costos` y tarjetas de costo. E2E 3/3 | Implementado en el worktree mientras se verificaba el Sprint 1 |
| 2026-09-28 | 007 · T1–T5 | Migración 1000, funciones `asignar_a_contrato` y `registrar_visita`, `/al-partir`. E2E 3/3 | — |
| 2026-09-28 | 007 y 008 · correcciones ronda 1 | Reparto histórico de costos desde `movimientos`, editar tenedor, visitas con confirmación y regla R6, migración 1400. Vitest 125/125 | También las mejoras de la 004 r2: caída en 30 días y proyección con el peso estimado de hoy |

## 3. Verificación
| Spec | Ronda | Veredicto | Reporte |
|---|---|---|---|
| 008 | 1 | RECHAZADO (Alto: el gasto directo desaparecía al mover el animal; 2 Medios, 5 Bajos) | [008-2026-09-28](../reports/verificacion/008-2026-09-28.md) |
| 007 | 1 | RECHAZADO (Alto: no se podía editar un tenedor; 6 Medios, 5 Bajos) | [007-2026-09-28](../reports/verificacion/007-2026-09-28.md) |

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
