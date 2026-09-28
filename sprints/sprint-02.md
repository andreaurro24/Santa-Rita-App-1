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
| [008 — Insumos y costos](../specs/008-costos/spec.md) | M8 | en-progreso |
| [007 — "Al partir": tenedores, contratos y visitas](../specs/007-al-partir/spec.md) | M7 | aprobada |

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
