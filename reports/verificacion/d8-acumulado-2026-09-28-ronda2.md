# Verificación D8 acumulado por contrato, ronda 2 (commit e549801) — APROBADO

Alcance: la corrección de la ronda 1 ([d8-acumulado-2026-09-28](d8-acumulado-2026-09-28.md)).
- `estadoContratos()` liquida en orden de registro (`created_at`) y ya no recibe `hasta` (`src/domain/decision.js:63-76`).
- La ficha del contrato tiene la tarjeta "Liquidación acumulada" (`src/pages/AlPartir.jsx:110-127`, `:181-182`).
- El asistente avisa cuando descuenta lo acumulado (`src/pages/Ventas.jsx:264-268`).
- Hay pruebas unitarias nuevas y la spec 011 R5 se reescribió.

No hay cambios de base de datos ni de RLS.

Los 5 hallazgos de la ronda 1 quedan cerrados. Una venta con fecha pasada registrada después ya no cambia la liquidación ya hecha y deja el saldo a favor. Quedan un Medio anterior a este cambio y tres Bajos.

## Escalera
| Nivel | Resultado | Evidencia |
|---|---|---|
| 1 Estático | OK | `npm run lint` sale con código 0: sin errores y con las 6 advertencias que ya había. `npm run build` OK. `grep -rlE "service_role\|sb_secret" dist/` no encuentra nada. |
| 2 Unitarias | OK | `npx vitest run`: 146 de 146 pasan (antes 142). Las 4 nuevas, en `decision.test.js:257-284`, prueban valores reales: saldo de 300.000 con fecha pasada, saldo absorbido en parte (100.000) y del todo, porcentaje del 40 % al 50 % (900.000) y contrato al 0 % acumulado. Ya citan 011 R5 y 010 R2. |
| 3 E2E | OK (1 prueba del verificador falla a propósito) | `npx playwright test --workers=1`: 146 pasan y 1 falla, en 19,0 min, sin caídas de Supabase. La que falla es `verificador-d8-acumulado.spec.js:521`, que documenta el Medio 1 y el Bajo 1. Después, el archivo nuevo se corrió solo: 10 pasan y 1 falla (la misma). Al terminar no quedan en la base lotes, animales, ventas ni tenedores `VRF-`, y el destare está en 0. No hizo falta `db:seed`. |
| 4 Revisión crítica | Con hallazgos menores | Ver abajo. |
| 5 Consola y red | OK | Las pruebas D8A no registran errores de consola ni respuestas ≥ 400, fuera del 500 simulado a propósito. El aviso de React "two children with the same key" viene de `verificador-al-partir-r2.spec.js` (visitas), ya aparecía en corridas anteriores y no tiene que ver con este cambio. |

## Lo que muestra la app (todos los contratos al 50 %, salvo Z al 0 %; $8.000/kg; destare 0 %)
| Caso | Esperado | Obtenido |
|---|---|---|
| J: T1 (gana) registrada hoy; después T2 (pierde) con fecha de hace 5 días | T1 sigue en "Pagar $900.000". T2 paga $0 con un saldo a favor de $300.000 | Tal cual. El detalle de T1 no cambia después de T2. El asistente de T2 mostró 0 / −600.000 con el aviso. El margen esperado de T2 es −600.000, igual al real, así que el Bajo 3 de la ronda 1 queda cerrado. Igual en la lista y al recargar. |
| Ficha G / H / J / S / Z | 3,0 M · 1,5 M · 0 / 1,2 M · 600 k · 0 / 1,2 M · 900 k · **300 k en rojo** / 1,2 M · 600 k · 0 / 1,2 M · 0 · 0 | Tal cual. "Pagado al tenedor" es igual a la suma de "A los tenedores" de sus ventas en `/ventas`. Otra sesión ve lo mismo. |
| Ficha K (sin ventas) | Sin tarjeta | Sin tarjeta |
| Ficha J en 375×812 | Sin desborde | `scrollWidth` 375, sin elementos fuera ni texto recortado |
| Ficha con `ventas` lenta o en 500 | Carga, error y reintento | "Cargando datos…", luego "No se pudieron cargar los datos… Reintentar", y al reintentar se recupera |
| Aviso en el asistente | No en P1; sí en P2, P3 y T2 | Tal cual |
| Dos ventas el mismo día (S) | Orden de registro: 0 y luego 600.000 | Tal cual (prueba 3) |
| Venta con fecha de mañana | Se rechaza | La UI dice "La fecha de la venta no puede ser futura." y no guarda. `registrar_venta` responde `fecha_futura`. **La inserción directa en `ventas` sí se acepta** (Medio 1). |
| Regresiones en `/recomendacion`, `/reporte`, `/ventas`, `/ventas/nueva` y el detalle | Sin cambios | Las pruebas 1, 2 y 5 de D8A y todas las de `verificador-ventas`, `verificador-recomendacion-r2`, `verificador-d11-contrato`, `decision` y `ventas` pasan |

## Requisitos
| ID | Estado | Evidencia |
|---|---|---|
| 011 R5 (acumulado en orden de registro, saldo a favor) | CUMPLE | Pruebas D8A 1 a 4 y 7 (`verificador-d8-acumulado.spec.js:393`). Unitaria en `decision.test.js:257`. Código en `decision.js:63`. |
| 010 R2 (la recomendación descuenta lo pagado) | CUMPLE | P3 y R dan 600.000 en `/recomendacion` y `/reporte` (pruebas 1 y 2). |
| D8 en `docs/plan.md` (saldo a favor visible) | CUMPLE | La ficha del contrato muestra el saldo (prueba 8, `:441`) y también en 375 px (`:502`). |
| Carga y error en la ficha, que ahora consulta `ventas` | CUMPLE | Prueba `:473`. |

## Hallazgos (de mayor a menor severidad)

### [Medio] La tabla `ventas` acepta una fecha futura si no se usa `registrar_venta` (ya existía antes de este cambio)
- Dónde: `supabase/migrations/20260928001300_ventas.sql:6`. El único límite en la tabla es `fecha >= 2000-01-01`. La regla de fecha futura solo está en la función (`:76`), y la política "miembros crean" (`:43`) deja insertar directo por la API.
- Cómo reproducirlo: prueba `verificador-d8-acumulado.spec.js:521`. Hace `supabase.from('ventas').insert({ fecha: <mañana>, ... })` con el usuario de prueba. Resultado: `directaCreada: 1`, sin error. La prueba borra la fila enseguida.
- Esperado: la base de datos rechaza la fila, como ya pasa con pesajes, sanidad y precios. Obtenido: la acepta.
- Por qué importa: `CLAUDE.md` pide validar en el cliente y en la base de datos. Con la regla nueva, la fecha ya no cambia el orden de liquidación, así que esto no afecta a D8. Aun así, una venta futura, o una venta sin animales hecha por fuera de la función, aparecería en la lista y en los reportes. No bloquea esta verificación, porque viene de la spec 011.

### [Bajo] La ficha del contrato escribe una ganancia negativa como "$-600.000"
- Dónde: `src/pages/AlPartir.jsx:112`, `pesos = (n) => \`$${formatCOP(Math.round(n))}\``. En cambio, `Ventas.jsx:22` y `AnalisisVenta.jsx:7` escriben "−$600.000", y el valor tampoco sale en rojo.
- Cómo reproducirlo: en la prueba 2, después de vender solo H1, que pierde, la tarjeta de H dice "Ganancia neta vendida $-600.000". El control está en `:521`, con `expect.soft(...).toContain('−$600.000')`.
- Por qué importa: el mismo dato se ve distinto en el detalle de la venta y en la ficha del contrato, y la pérdida no se destaca.

### [Bajo] "Pagado al tenedor" puede diferir en $1 de la suma de los "Pagar" de cada venta
- Dónde: `AlPartir.jsx:117` redondea la suma, mientras que cada detalle (`Ventas.jsx:369`) redondea cada venta por separado.
- Cómo reproducirlo, con la función pura: 5.000 contratos aleatorios de 2 a 5 ventas, con porcentajes de 33,33, 17,5 o 45,67 %, destare de 0, 3 o 4,5 % y pesos con decimales. En 1.190 casos la tarjeta difiere en $1 de la suma de los "Pagar". Ejemplo: los "Pagar" suman 1.614.669 y la tarjeta dice 1.614.668. El saldo a favor siempre coincide. En las pruebas E2E, con valores redondos, cuadra exacto.
- Por qué importa: si Miguel suma a mano los recibos contra la ficha, puede ver una diferencia de $1.

### [Bajo] Si falla la consulta de ventas, se cae toda la ficha del contrato
- Dónde: `AlPartir.jsx:97`, `ConDatos queries={[contratos, hato, ventas]}`.
- Cómo se ve: en la prueba `:473`, con `ventas` en 500, toda la ficha se reemplaza por el error. No se pueden registrar visitas ni editar el contrato, aunque la tarjeta es lo único que necesita las ventas.
- Por qué importa: una caída parcial bloquea tareas de campo que no dependen de las ventas.

## Sospechas no confirmadas
- **"Una liquidación ya pagada nunca cambia" solo se cumple desde la UI.** La política "miembros editan" (`20260928001300_ventas.sql:44`) deja cambiar `created_at`, `fecha` y las copias de `venta_animales` por la API, y el dueño puede borrar una venta. Cualquiera de esas acciones recalcula las liquidaciones siguientes, porque no se guardan. Hoy la app no ofrece editar ni borrar ventas.
- **Las ventas históricas se reordenan.** Producción comparte la base de datos con desarrollo (DT-04-10). Si hay ventas reales registradas fuera del orden de sus fechas, su "Pagar" cambia con la regla nueva. No revisé los datos reales.
- **Dos sesiones registrando a la vez en el mismo contrato.** El asistente de la segunda muestra una cifra calculada sin la otra venta, y la guardada puede ser distinta. Es poco probable, porque solo Miguel usa la app.

## Lo que no se verificó y por qué
- No revisé los datos reales de producción, por la regla de no usar datos de Miguel.
- No probé editar o borrar ventas por la API, más allá de la inserción directa, porque se sale del alcance y la UI no lo ofrece.

## Archivos del verificador
- Modificado: `tests/e2e/verificador-d8-acumulado.spec.js`.
  - La prueba 7 se adaptó a la regla por orden de registro: T1 no cambia, T2 deja el saldo y la copia de la recomendación coincide.
  - Revisa el aviso del asistente.
  - Añade 4 pruebas: la ficha cuadra con las ventas (con otra sesión y un contrato sin ventas), la carga y el error de la ficha, la ficha en 375 px, y la fecha futura con el formato negativo. Esta última falla mientras sigan abiertos el Medio 1 y el Bajo 1.
  - Añade el contrato K y el lote W.
- Reporte: `reports/verificacion/d8-acumulado-2026-09-28-ronda2.md`.
