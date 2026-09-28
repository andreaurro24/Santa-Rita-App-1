# Verificación D8 acumulado por contrato (commit 10667a9, DT-04-9) — RECHAZADO

Alcance: la parte del tenedor "Al partir" sobre la ganancia neta **acumulada** del contrato, menos lo ya
pagado, con "Saldo a favor de Santa Rita" (`estadoContratos()` y `partesTenedores()` en
`src/domain/decision.js`), usada en `src/data/analisis.js` (recomendación y reporte) y en
`src/pages/Ventas.jsx` (asistente, lista y detalle). Specs: 011 R5, 010 R2; `docs/plan.md` D8. No hay
cambios de base de datos ni de RLS.

En el orden normal, el cálculo es correcto en todas las pantallas. Se rechaza por un caso: una venta
registrada con una fecha anterior a otra que ya estaba registrada reescribe la liquidación de la
venta posterior. Así, el pago de más al tenedor desaparece sin dejar rastro (hallazgo 1).

## Escalera
| Nivel | Resultado | Evidencia |
|---|---|---|
| 1 Estático | OK | `npm run lint` sale con código 0: sin errores y con 6 advertencias que ya existían (entre ellas `pesoActual` sin usar en `decision.js:4`). `npm run build` OK: `index` pesa 433,05 kB. `grep -rlE "service_role\|sb_secret" dist/` no encuentra nada. |
| 2 Unitarias | OK | `npx vitest run`: 142 de 142 pasan. Faltan casos (hallazgo 5). |
| 3 E2E | OK en el código de la app; 1 prueba nueva falla a propósito | `npx playwright test --workers=1`: 130 pasan y 6 fallan en 19,6 min. Las 6 fallas vienen de una caída de Supabase: `registrar_venta` respondió una página HTML de Cloudflare "520: Web server is returning an unknown error" en `verificador-ventas.spec.js:277`. Después, el `afterAll` se agotó y las pruebas siguientes no pudieron iniciar sesión. Corridos otra vez, `verificador-ventas.spec.js` y `verificador.spec.js` pasan 30 de 30 (3,2 min). En la corrida completa pasaron `verificador-recomendacion-r2.spec.js` (`textoLote`) y `verificador-d11-contrato.spec.js`. Ninguna prueba anterior falló por el cambio de premisa, así que no hubo que adaptar ninguna. Prueba nueva `verificador-d8-acumulado.spec.js`, corrida sola: 6 de 7 pasan y la que falla documenta el hallazgo 1. |
| 4 Revisión crítica | Con hallazgos | Ver abajo. |
| 5 Consola y red | OK | Las pruebas nuevas no registran errores de consola ni respuestas ≥ 400, fuera del 500 que se simula a propósito en la prueba de carga. |

## Cálculo a mano y lo que muestra la app
Todos los animales pesan 300 kg a $8.000/kg, con destare 0 %. Uno que "gana" costó 600.000 y gana 1.800.000. Uno que "pierde" costó 3.000.000 y pierde 600.000. Todos los contratos son del 50 %, salvo Z, que es del 0 %.

| Caso | Esperado | Asistente | Detalle / lista | `/recomendacion` = `/reporte` |
|---|---|---|---|---|
| G en 3 lotes. Venta P1 (gana, hace 10 días) | Paga 900.000 | 900.000 | Pagar $900.000 | Antes de las ventas, P3: 900.000 |
| G. Venta P2 (pierde, hace 5 días) | Acumulado 1.200.000; le tocan 600.000; ya se le pagaron 900.000 → paga 0, saldo 300.000 | 0 | "Acumulada del contrato $1.200.000; ya se le pagaron $900.000. Saldo a favor de Santa Rita: $300.000". Igual en otra sesión y en 375 px, sin desborde | — |
| G. Recomendación de P3 (gana) | 50 % × 3.000.000 − 900.000 = 600.000; margen 1.200.000 | — | — | 600.000 / 1.200.000 en las dos pantallas |
| G. Venta P3 | Paga 600.000. Total pagado 1.500.000, igual que si se vendieran juntos | 600.000 | Pagar $600.000. Margen esperado = real = 1.200.000 | — |
| H, venta parcial del lote R: primero pierde, luego gana | 0 y luego 600.000, igual que juntos | 0 / 600.000 | Coincide | Con H2 solo: 600.000 (no 900.000) |
| S, dos ventas el mismo día: primero pierde, luego gana | 0 y 600.000 | 600.000 | Coincide, en el orden de registro | — |
| Z al 0 % en dos ventas | $0, sin saldo ni NaN | 0 | "Pagar $0" en las dos ventas | — |

Los estados de carga y de error funcionan. Con la consulta de `ventas` lenta, `/recomendacion`, `/reporte` y `/ventas/nueva` muestran "Cargando datos…". Con esa consulta respondiendo 500, muestran "No se pudieron cargar los datos… Reintentar", y al reintentar se recuperan.

## Requisitos
| ID | Estado | Evidencia |
|---|---|---|
| 011 R5 (liquidación acumulada, saldo a favor) | CUMPLE en el orden normal; **NO CUMPLE** con una venta de fecha pasada | Pruebas 1 a 4 de `verificador-d8-acumulado.spec.js`. Con fecha pasada, ver el hallazgo 1 (prueba 7). |
| 010 R2 (recomendación descuenta lo ya pagado) | CUMPLE | P3: 600.000 y R: 600.000 en `/recomendacion` y `/reporte`. El código está en `analisis.js:59`. |
| D8 en `docs/plan.md` | Igual que 011 R5 | — |
| Carga y error con la consulta extra | CUMPLE | Prueba 5. |
| Celular 375 px | CUMPLE | Prueba 6: `scrollWidth` 375, sin recortes. |

## Hallazgos (de mayor a menor severidad)

### [Alto] Una venta con fecha pasada reescribe la liquidación de una venta ya registrada y el pago de más desaparece
- Dónde: `src/domain/decision.js:60` (`ordenVentas`, por fecha) y `:64-73`, llamado en `src/pages/Ventas.jsx:64` y `:302` con `antesDe`, y en `:152` con `hasta: form.fecha`. La liquidación no se guarda: se recalcula cada vez.
- Cómo reproducirlo: prueba `tests/e2e/verificador-d8-acumulado.spec.js:381`. Con la función pura:
  1. Contrato J al 50 %. Se registra hoy la venta T1 (J1, que gana). El detalle dice "Pagar $900.000".
  2. Se registra T2 (J2, que pierde) con fecha de hace 5 días. El asistente muestra $0 a los tenedores y no advierte nada.
  3. Se vuelve al detalle de T1: ahora dice "Acumulada del contrato $1.200.000; ya se le pagaron $0. **Pagar $600.000**". En la lista, "A los tenedores" de T1 pasa a $600.000. El detalle de T2 dice "Pagar $0" y no muestra ningún saldo a favor.
  4. El "Margen esperado" de T1 sigue en $900.000 y el "Margen real" sube a $1.200.000, con una "Diferencia" de +$300.000 que no corresponde a nada.
- Esperado vs. obtenido: T1 ya se liquidó por $900.000, que es lo que la app mandó pagar. Con la pérdida, al contrato le tocan $600.000, así que deberían aparecer **$300.000 a favor de Santa Rita**, que es la regla D8 ("lo pagado de más queda como saldo a favor"). La app, en cambio, cambia el "Pagar" de una venta que ya se pagó y no muestra el saldo en ninguna parte.
- Por qué importa: registrar una venta días después es normal en la finca, y el orden de registro no tiene por qué coincidir con el de las fechas. Es justo el pago de más que DT-04-9 quería evitar, y además no deja rastro. **Lo tiene que decidir el humano.** Hay tres opciones:
  - liquidar en el orden de registro (`created_at`) y no por fecha;
  - congelar lo liquidado de cada venta al guardarla;
  - al menos, advertir en el asistente y calcular el saldo contra lo que ya se mostró.
  
  El texto de 011 R5 ("en orden de fecha y hora de registro") provoca este caso y habría que ajustarlo según lo que se decida.

### [Medio] El saldo a favor solo se ve en el detalle de una venta; no aparece en el contrato
- Dónde: `src/pages/Ventas.jsx:361-363`. El texto promete "se cobra al cerrarlo", pero `src/pages/AlPartir.jsx:149` ("Condiciones y estado") no muestra ni liquidaciones ni saldo, y el contrato se puede marcar "Terminado" sin ver nada. En la lista `/ventas`, esa venta solo dice "A los tenedores $0".
- Cómo reproducirlo: en la prueba 1, después de vender P2, se abre el contrato G en `/al-partir`: no hay ningún rastro de los $300.000.
- Por qué importa: si el contrato no tiene más ventas, Miguel tiene que acordarse de buscar esa venta para cobrar el saldo.

### [Bajo] Con una fecha pasada, el asistente y la copia de la recomendación usan historias distintas
- Dónde: `src/pages/Ventas.jsx:152` usa `hasta: form.fecha` y `src/data/analisis.js:59` usa todas las ventas. Esa copia es la que se guarda como "margen esperado" en `Ventas.jsx:170-180`.
- Cómo reproducirlo (con la función pura): el contrato ya vendió hoy un animal que pierde, y se registra otro que gana con una fecha anterior. El asistente muestra 900.000 a los tenedores y un margen de 900.000; la copia de la recomendación guarda 600.000 y 1.200.000. La "Diferencia" que después se ve en el detalle no viene de la venta.

### [Bajo] El asistente y la recomendación no explican el descuento
- Dónde: `Ventas.jsx:264` y `AnalisisVenta.jsx:47`. Solo muestran el total "A los tenedores" o "Parte de los tenedores".
- Cómo se ve: antes de guardar, Miguel ve $0 o $600.000 sin saber que se descontó una pérdida o un saldo de ventas anteriores. La explicación solo aparece en el detalle, después de guardar.

### [Bajo] Faltan pruebas unitarias y las que hay no citan los requisitos
- En `src/domain/decision.test.js:230-269` falta probar:
  - `estadoContratos(..., { hasta })`;
  - una venta con fecha pasada después de otra ya registrada;
  - un saldo a favor que la venta siguiente absorbe solo en parte;
  - un porcentaje que cambia entre ventas: da 240.000, y lo verifiqué a mano con la función pura;
  - un contrato al 0 % acumulado.
- Las pruebas y el comentario de `decision.js:21-29` citan "D8, DT-04-9", pero no "011 R5" ni "010 R2", como pide `CLAUDE.md`. Esto ya se había reportado para D11.

## Sospechas no confirmadas
- **Ventas históricas recalculadas.** Toda venta ya registrada de un contrato con varias ventas cambia su "Pagar" con la regla nueva. Si ya se pagó con la regla anterior, el historial no lo refleja. Producción comparte la base de datos con desarrollo (DT-04-10). No revisé si hay ventas reales.
- **Residuos de punto flotante en `saldoAFavor`** (`decision.js:47`). Podrían mostrar "Saldo a favor: $0". No lo reproduje en 7.000 casos aleatorios con porcentajes del 17 al 50 %, destare y pesos con decimales.
- **La caída de Supabase (520) de esta corrida no es de la app.** Aun así, cuando falla una recarga de `ventas`, `ConDatos` reemplaza toda la pantalla de `/recomendacion` por el error, porque ahora esa consulta también está en la lista.

## Lo que no se verificó y por qué
- La prueba nueva se corrió sola, después de la suite completa, y no dentro de ella, para no correr dos suites a la vez.
- No hizo falta `npm run db:seed`. Después de la corrida quedan en la base 0 lotes, animales, ventas y tenedores con prefijo `VRF-`, y el destare quedó en 0, que es el valor por defecto.

## Archivos del verificador
- Nuevo: `tests/e2e/verificador-d8-acumulado.spec.js` (7 pruebas; la 7 falla mientras el hallazgo 1 siga abierto).
- Reporte: `reports/verificacion/d8-acumulado-2026-09-28.md`.
