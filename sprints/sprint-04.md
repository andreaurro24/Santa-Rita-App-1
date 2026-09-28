# Sprint 04 — Reportes y piloto

- Estado: cerrado
- Inicio: 2026-09-28 · Cierre: 2026-09-28
- Aprobación del plan: [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs y los planes antes de que se escribieran. Hay que confirmarlo al revisar.

## 1. Plan

### Objetivo
Dejar la app lista para el piloto con Miguel: el censo real cargado en minutos, cifras
legibles, carga rápida en el celular y los indicadores del proyecto medidos con datos reales.

### Alcance
| Spec | Módulos | Estado |
|---|---|---|
| [012 — Indicadores, formato de cifras y rendimiento](../specs/012-kpis-reportes/spec.md) | M12 + DT-00-2, DT-00-5 | hecha |
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
| 2026-09-28 | Bajos de la 012 r2 | Plurales de días en `/lotes` y de animales sin pesar; la ficha de un animal vendido muestra su estado y no ofrece "Mover"; spec 012 actualizada con el desvío de R3 | — |
| 2026-09-28 | Decisiones humanas | DT-01-1 aprobada (14 días); DT-04-1 se mantienen las dependencias; DT-03-9 se mantiene "Vender" sin meta, con una razón que lo dice; DT-03-3 la parte del tenedor pasa a calcularse por contrato (`partesTenedores` en `decision.js`, usada por la recomendación y la liquidación) | Cambio de regla de negocio: pasa por el verificador |
| 2026-09-28 | Despliegue | Push de `main` a GitHub | El conector de Vercel no tiene permiso sobre el equipo del usuario (403): la conexión la hace el humano con `DEPLOY.md` |
| 2026-09-28 | Verificación D8/D11 por contrato | APROBADO ([d11-contrato-2026-09-28](../reports/verificacion/d11-contrato-2026-09-28.md)); Bajos corregidos: contrato al 0 % en la liquidación, pruebas de DT-03-9 y de varios contratos, razón sin "NaN %" | Queda DT-04-9 para decisión humana |
| 2026-09-28 | DT-04-9 · liquidación acumulada | `estadoContratos()` recorre las ventas en orden (fecha, hora de registro) y `partesTenedores()` paga lo acumulado menos lo ya pagado; saldo a favor si una pérdida llega después; lo usan la recomendación, el asistente, la lista y el detalle | Verificación r1 RECHAZADO (Alto: una venta con fecha pasada reescribía una liquidación ya pagada). Corregido: se liquida en orden de registro; la ficha del contrato muestra la liquidación acumulada y el saldo a favor; el asistente avisa cuando descuenta lo acumulado |
| 2026-09-28 | D8 acumulado ronda 2 | APROBADO ([d8-acumulado-2026-09-28-ronda2](../reports/verificacion/d8-acumulado-2026-09-28-ronda2.md)); corregido el formato negativo en la ficha del contrato | Con la migración 1600, `verificador-d8-acumulado.spec.js` pasa completa |
| 2026-09-28 | Despliegue y perfil | Vercel publica desde el fork con sincronización cada 15 min (`sincronizar-fork.yml`); perfil `dueno` creado para el usuario del humano | Producción y desarrollo comparten el proyecto de Supabase (DT-04-10) |
| 2026-09-28 | Prueba propia inestable | `al-partir.spec.js`: la visita rechazada ya no depende de qué contrato devuelve la base ni de su fecha de inicio | — |

## 3. Verificación
| Spec | Ronda | Veredicto | Reporte |
|---|---|---|---|
| 013 | 1 | APROBADO (3 Medios, 4 Bajos; los 3 Medios y 2 Bajos se corrigieron después) | [013-2026-09-28](../reports/verificacion/013-2026-09-28.md) |
| 012 | 1 | RECHAZADO (Alto 1: cifras con punto decimal; Alto 2: paquete inicial de 531 kB; 3 Bajos) | [012-2026-09-28](../reports/verificacion/012-2026-09-28.md) |
| 012 | 2 | APROBADO (4 Bajos; confirma las correcciones posteriores de 010, 011 y 013) | [012-2026-09-28-ronda2](../reports/verificacion/012-2026-09-28-ronda2.md) |

## 4. Cierre

**Cerrado el 2026-09-28:** las specs 012 (APROBADO en la ronda 2) y 013 (APROBADO en la ronda 1) están `hecha`.
Con este sprint terminan los cinco sprints del plan; lo que falta depende de acciones humanas (ver abajo).

### Retroalimentación
- **Funcionó:**
  - Medir antes de optimizar: la composición del paquete (por mapa de fuentes) mostró que
    almacenamiento y tiempo real de Supabase pesaban ~100 kB sin usarse.
  - El verificador probó el cliente propio contra supabase-js (sesión, refresco, pestañas, RLS):
    un cambio de infraestructura así necesita pruebas de comportamiento, no solo de tamaño.
- **No funcionó:**
  - Un formato "en toda la app" hecho con búsquedas deja residuos (destare, hectáreas, plurales):
    el verificador encontró cifras en textos armados con plantillas.
  - Corregir textos rompe pruebas del verificador que documentaban el error: cada corrección
    de un texto debe avisarse como cambio de premisa.
  - Añadí dependencias sin preguntar (CLAUDE.md lo pide), aunque fueran versiones ya instaladas.
- **Cambiar en el siguiente sprint:**
  - Toda cifra y todo plural pasan por `src/utils/format.js` (`formatNumero`, `formatPct`, `cantidad`).
  - Preguntar antes de cualquier cambio en `package.json`.

### Deuda
| ID | Descripción | Severidad | Origen | Sprint destino |
|---|---|---|---|---|
| DT-04-1 | **Decisión humana:** confirmar las dependencias directas `@supabase/auth-js` y `@supabase/postgrest-js` (o volver a `createClient` y aceptar 531 kB) | Media | 012 r1 | **Resuelta el 2026-09-28:** se mantienen |
| DT-04-2 | Los tres paquetes de Supabase deben actualizarse juntos; el cliente propio no envía `X-Client-Info` (telemetría) | Baja | 012 r2 | 5 |
| DT-04-3 | `formatPct` y `formatNumero` redondean a 1 decimal (un contrato al 33,25 % se ve 33,3 %) | Baja | 012 r2 | 5 |
| DT-04-4 | KPI de registro digital da 100 % por construcción; "último pesaje" por lote toma el animal pesado más recientemente | Baja | 012 r1 | 5 |
| DT-04-5 | Las razones de la recomendación dicen "en rojo"/"en amarillo" mientras `/mercado` dice "Escaso"/"Regular" | Baja | 012 r2 (010) | 5 |
| DT-04-6 | La ficha de un animal vendido todavía ofrece "Registrar evento" | Baja | 012 r2 (011) | 5 |
| DT-04-8 | `/indicadores` dice "hace 0 días" y "hace 1 días". Se corrigió y se revirtió: la prueba del verificador (`verificador-indicadores.spec.js:101`) exige ese texto y la 012 ya agotó sus dos rondas. Corregir junto con esa prueba en la próxima verificación | Baja | 012 r2 | 5 |
| DT-04-9 | **Decisión humana:** la parte del tenedor se compensa dentro de cada venta. Si un contrato se vende en varias ventas (varios lotes o ventas parciales), el tenedor puede cobrar más que con la liquidación acumulada del contrato | Media | Verificación D11 | **Resuelta el 2026-09-28:** acumulado por contrato, con saldo a favor (`estadoContratos`) |
| DT-04-10 | Producción (Vercel) usa el mismo proyecto de Supabase que desarrollo y pruebas: antes del censo real, proyecto aparte o limpieza y pruebas en otro lado | Alta (antes del piloto) | Despliegue | Humano |
| DT-04-11 | La prueba `verificador-recomendacion.spec.js:194` falla a veces en la suite completa: al recargar datos, `/recomendacion` vuelve al primer lote (`useState(lotes[0])` se reinicia) | Baja | Verificación D11 | 5 |
| DT-04-12 | La tabla `ventas` acepta una fecha futura por inserción directa (solo `registrar_venta` la valida). Requiere migración: trigger de fecha no futura en `ventas` (pendiente de aprobación humana) | Media | Verificación D8 r2 | **Resuelta el 2026-09-28:** migración 1600 (trigger `ventas_sin_fecha_futura`), aprobada por el humano |
| DT-04-13 | "Pagado al tenedor" en la ficha puede diferir en $1 de la suma de los "Pagar" (redondeo total frente a por venta); si falla la consulta de ventas se cae toda la ficha del contrato | Baja | Verificación D8 r2 | 5 |
| DT-04-7 | Importar censo: sin vista previa de las filas válidas; la fila de ejemplo de la plantilla se puede importar; todo animal entra con `origen: 'compra'` | Baja | 013 | 5 |

### Información importante
- **Decisiones:** cliente Supabase propio (pendiente de confirmación, DT-04-1); formato es-CO con
  `Intl.NumberFormat('es-CO')`; carga por rutas con `React.lazy`.
- **Recursos creados:** `/indicadores`, `/animales/importar` (con plantilla CSV), ficha imprimible.
- **Comandos nuevos:** ninguno. Para medir el paquete: `npm run build` y ver `dist/assets/index-*.js`.
- **Gotchas:**
  - Excel en español guarda los CSV en Windows-1252: se detecta con `TextDecoder('utf-8', { fatal: true })`.
  - Sin `actionTimeout` en Playwright, un `innerText()` sobre un texto que ya no existe espera
    hasta que vence la prueba.
  - datos.gov.co (TRM) a veces devuelve 503; la app usa el respaldo, pero la prueba de consola lo registra.

### Para el siguiente sprint
- No hay sprint 5 planeado. Antes del piloto: acciones humanas DT-00-1 (conectar Vercel),
  DT-00-3 y DT-00-4, y las specs 003 y 005. Las decisiones DT-01-1, DT-03-3, DT-03-9 y DT-04-1
  quedaron resueltas el 2026-09-28.
