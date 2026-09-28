# Sprint 02 — Terceros y costos

- Estado: cerrado
- Inicio: 2026-09-28 · Cierre: 2026-09-28
- Aprobación del plan: [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs y los planes antes de que se escribieran. Hay que confirmarlo al revisar.

## 1. Plan

### Objetivo
Saber cuánto cuesta de verdad cada animal y cada lote, y tener bajo control los animales que
están en fincas de tenedores "Al partir".

### Alcance
| Spec | Módulos | Estado |
|---|---|---|
| [008 — Insumos y costos](../specs/008-costos/spec.md) | M8 | hecha |
| [007 — "Al partir": tenedores, contratos y visitas](../specs/007-al-partir/spec.md) | M7 | hecha |

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
| 008 | 2 | APROBADO (3 Medios, 1 Bajo) | [008-2026-09-28-ronda2](../reports/verificacion/008-2026-09-28-ronda2.md) |
| 007 | 2 | APROBADO (2 Medios, 4 Bajos) | [007-2026-09-28-ronda2](../reports/verificacion/007-2026-09-28-ronda2.md) |
| 007 | 1 | RECHAZADO (Alto: no se podía editar un tenedor; 6 Medios, 5 Bajos) | [007-2026-09-28](../reports/verificacion/007-2026-09-28.md) |

## 4. Cierre

**Cerrado el 2026-09-28:** las specs 007 y 008 están `hecha` (APROBADO en la ronda 2).

### Retroalimentación
- **Funcionó:**
  - La simplificación declarada del reparto de costos se vio insuficiente en cuanto hubo
    movimientos. El verificador lo demostró con casos concretos, y la solución (pertenencia
    histórica desde `movimientos`) quedó mejor fundamentada.
  - Declarar las simplificaciones en la spec permitió juzgarlas.
- **No funcionó:**
  - Las reglas que solo vivían dentro de las funciones SQL se podían saltar con escrituras
    directas; hubo que repetirlas en triggers.
  - Olvidé el caso de editar datos existentes (tenedor): una spec que dice "crear y editar"
    necesita pruebas de las dos cosas.
- **Cambiar en el siguiente sprint:**
  - Cada regla de negocio va en un trigger o restricción de la tabla, no solo en la función.
  - Toda spec con "editar" lleva su E2E de edición.

### Deuda
| ID | Descripción | Severidad | Origen | Sprint destino |
|---|---|---|---|---|
| DT-02-1 | Un animal muerto sigue recibiendo gastos del lote (no hay fecha de baja; depende de la spec 003) | Media | Verificación 008 r2 | Spec 003 |
| DT-02-2 | Al cambiar la finca de un tenedor, sus animales se quedan en la finca vieja | Media | Verificación 007 r2 | 4 |
| DT-02-3 | Un UPDATE directo de `contrato_id` sin cambiar la finca se acepta | Baja | Verificación 007 r2 | 4 |
| DT-02-4 | Las lecturas de costos y movimientos no paginan: con más de 1.000 filas el reparto quedaría incompleto (sospecha) | Media | Verificación 008 r2 | 4 |
| DT-02-5 | Dos visitas del mismo día en la ficha generan una advertencia de llaves repetidas en React | Baja | Verificación 007 r2 | 4 |

Corregidos después de aprobar, con la migración 1500:
- Movimientos anteriores al último del animal.
- Asignaciones y visitas anteriores al inicio del contrato.
- Fechas de inicio futuras.
- Aviso de gastos sin animales para repartir.
- Monto "1e6".

### Información importante
- **Decisiones:**
  - Reparto histórico de costos (D9 con `movimientos` y fecha de venta).
  - Un animal que sale de la finca de su tenedor deja de estar "Al partir".
- **Recursos creados:** migraciones 0900 (costos), 1000 ("Al partir"), 1400 y 1500 (correcciones).
- **Gotchas:** un trigger que valida una relación (animal–lote) en cada UPDATE impide corregir
  datos históricos; hay que validarla solo al crear o reasignar.

### Para el siguiente sprint
- La recomendación v2 y la venta deben usar `useRepartoCostos` (una sola fuente de costos).
