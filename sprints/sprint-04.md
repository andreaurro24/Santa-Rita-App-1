# Sprint 04 — Reportes y piloto

- Estado: en-verificacion
- Inicio: 2026-09-28 · Cierre: —
- Aprobación del plan: [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs y los planes antes de que se escribieran. Hay que confirmarlo al revisar.

## 1. Plan

### Objetivo
Dejar la app lista para el piloto con Miguel: el censo real cargado en minutos, cifras
legibles, carga rápida en el celular y los indicadores del proyecto medidos con datos reales.

### Alcance
| Spec | Módulos | Estado |
|---|---|---|
| [012 — Indicadores, formato de cifras y rendimiento](../specs/012-kpis-reportes/spec.md) | M12 + DT-00-2, DT-00-5 | en-verificacion |
| [013 — Importar el censo desde CSV](../specs/013-importar-censo/spec.md) | M13 | en-verificacion |

### Fuera de alcance
- El piloto con datos reales depende de las acciones del usuario (DT-00-1, DT-00-3 y DT-00-4).

### Deuda que se arrastra
- DT-00-2 (separador decimal) y DT-00-5 (tamaño del paquete) se resuelven en la 012.
- Las demás deudas siguen abiertas; ver los cierres de los sprints 00 a 02.

### Orden de ejecución
1. 013 (dominio puro, sin dependencias).
2. 012: indicadores, carga por rutas y ficha imprimible. El formato es-CO va al final, porque
   toca todas las pantallas y las pruebas.

### Riesgos
| Riesgo | Mitigación |
|---|---|
| El formato es-CO rompe las pruebas que buscan "355.5 kg" | Actualizar las pruebas del implementador; el verificador adapta las suyas |
| Un CSV real de Excel trae formatos inesperados | Lectura tolerante (BOM, `;` o `,`, comillas, dd/mm/aaaa, puntos de miles) y vista previa con errores por fila |

### Definición de hecho
- Specs 012 y 013 en `hecha` con `APROBADO`; lint, build y pruebas en verde; commits en `main`.

## 2. Bitácora
| Fecha | Spec / tarea | Resultado | Notas y desvíos |
|---|---|---|---|
| 2026-09-28 | 013 · T1–T3 | `censo.js` con 9 pruebas; `/animales/importar` con vista previa, importación fila por fila y plantilla | Ruta `/animales/importar` en vez de `/hato/importar`, por consistencia con `/animales/:id` |
| 2026-09-28 | 012 · T2–T4 | Carga por rutas (paquete inicial de 940 a 530 kB, 154 KB comprimido), `/indicadores` y ficha imprimible | R3 queda 30 kB por encima de la meta sin comprimir: se propone medirla comprimida (lo decide el humano) |
| 2026-09-28 | 012 · T1 | Formato es-CO (`formatKg`, `formatPct`, `formatNumero`) en 43 lugares | — |

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
