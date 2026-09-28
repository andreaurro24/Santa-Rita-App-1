# Sprint 03 — Decisión de venta

- Estado: en-verificacion
- Inicio: 2026-09-28 · Cierre: —
- Aprobación del plan: [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs y los planes antes de que se escribieran. Hay que confirmarlo al revisar.

## 1. Plan

### Objetivo
Que Miguel pueda decidir "¿vendo hoy o espero?" con el costo real del lote, la parte de los
tenedores, el pasto y el clima; que registre la venta real y vea si siguió la recomendación.

### Alcance
| Spec | Módulos | Estado |
|---|---|---|
| [009 — Estado del pasto y destare](../specs/009-pasto-parametros/spec.md) | M9 | en-verificacion |
| [010 — Recomendación de venta v2](../specs/010-recomendacion-v2/spec.md) | M10 | en-verificacion |
| [011 — Venta real y cierre del ciclo](../specs/011-ventas/spec.md) | M11 | en-verificacion |

### Fuera de alcance
- Predicción del precio; facturación.

### Deuda que se arrastra
- DT-00-1 (despliegue), DT-00-3 y DT-00-4 (acciones del usuario en Supabase), DT-00-7 (specs 003 y 005), DT-01-1 (aprobar el desvío de R5 de la 004).

### Orden de ejecución
1. 009, porque el motor necesita el pasto y el destare.
2. 010, porque la venta guarda una copia de la recomendación.
3. 011.

### Riesgos
| Riesgo | Mitigación |
|---|---|
| Un motor de decisión con muchas variables se vuelve una caja negra | Cada recomendación va con razones escritas y con escenarios y sensibilidad visibles; pruebas con números redondos calculables a mano |
| Registrar una venta cambia muchos estados | Función SQL atómica `registrar_venta` |

### Definición de hecho
- Specs 009–011 en `hecha` con `APROBADO`; lint, build y pruebas en verde; commits en `main`.

## 2. Bitácora
| Fecha | Spec / tarea | Resultado | Notas y desvíos |
|---|---|---|---|
| 2026-09-28 | 010 · T1 | `src/domain/decision.js` con 20 pruebas (cifras, reglas, casos borde) | Escrito en el worktree mientras se verificaba el Sprint 1 |
| 2026-09-28 | 009 · T1–T3 | Migración 1200 (pasto y parámetros), dominio `pasto.js`, tarjetas en `/mercado` | La hoja de pasto se abre solo cuando las fincas cargaron (bug propio encontrado en las pruebas) |
| 2026-09-28 | 010 · T2–T3 | Recomendación y reporte con el motor v2; se retiró el motor v1 | Razón adicional cuando la meta se cumplió pero esperar daría más margen (D3) |
| 2026-09-28 | 011 · T1–T3 | Migración 1300 y función `registrar_venta`; asistente, detalle con comparación y liquidación | La base de datos rechaza vender vientres; las terneras piden verificación en la interfaz |

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
