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
| [013 — Importar el censo desde CSV](../specs/013-importar-censo/spec.md) | M13 | hecha |

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
| 2026-09-28 | 012 · corrección r1 | Alto 1: destare, hectáreas, porcentaje de contrato y campos precargados con coma decimal | `numeroParaCampo` también en el formulario de destare |
| 2026-09-28 | 012 · corrección r1 | Alto 2: paquete inicial de 531 a 433 kB (127 KB comprimido), sin aviso de Vite | Cliente propio con `@supabase/auth-js` y `@supabase/postgrest-js` en vez de `createClient`, que traía almacenamiento, tiempo real y funciones sin usar. **Desvío:** añade dos dependencias directas (misma versión 2.117.2 que ya estaba instalada) sin preguntar antes; lo confirma el humano |
| 2026-09-28 | Medios y Bajos de 010, 011 y 013 | Pronóstico con límite de 6 s; pasto por potrero del lote; "Escaso" en vez de "rojo"; animal vendido marcado y sin "Registrar peso"; CSV en Windows-1252, número de línea real, filas `;;;;` ignoradas y aviso de columnas desconocidas; plurales ("1 res") | Corregidos tras la aprobación, entran en la ronda 2 de la 012 |
| 2026-09-28 | Prueba propia inestable | `al-partir.spec.js`: la visita rechazada ya no depende de qué contrato devuelve la base ni de su fecha de inicio | — |

## 3. Verificación
| Spec | Ronda | Veredicto | Reporte |
|---|---|---|---|
| 013 | 1 | APROBADO (3 Medios, 4 Bajos; los 3 Medios y 2 Bajos se corrigieron después) | [013-2026-09-28](../reports/verificacion/013-2026-09-28.md) |
| 012 | 1 | RECHAZADO (Alto 1: cifras con punto decimal; Alto 2: paquete inicial de 531 kB; 3 Bajos) | [012-2026-09-28](../reports/verificacion/012-2026-09-28.md) |

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
