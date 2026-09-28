# Sprint 03 — Decisión de venta

- Estado: cerrado
- Inicio: 2026-09-28 · Cierre: 2026-09-28
- Aprobación del plan: [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs y los planes antes de que se escribieran. Hay que confirmarlo al revisar.

## 1. Plan

### Objetivo
Que Miguel pueda decidir "¿vendo hoy o espero?" con el costo real del lote, la parte de los
tenedores, el pasto y el clima; que registre la venta real y vea si siguió la recomendación.

### Alcance
| Spec | Módulos | Estado |
|---|---|---|
| [009 — Estado del pasto y destare](../specs/009-pasto-parametros/spec.md) | M9 | hecha |
| [010 — Recomendación de venta v2](../specs/010-recomendacion-v2/spec.md) | M10 | hecha |
| [011 — Venta real y cierre del ciclo](../specs/011-ventas/spec.md) | M11 | hecha |

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
| 009 | 1 | APROBADO (2 Medios corregidos después, 1 Bajo) | [009-2026-09-28](../reports/verificacion/009-2026-09-28.md) |
| 010 | 1 | RECHAZADO (Alto: el último pesaje se tomaba como el peso de hoy; 3 Medios, 4 Bajos) | [010-2026-09-28](../reports/verificacion/010-2026-09-28.md) |
| 010 | 2 | APROBADO (5 Medios, 2 Bajos) | [010-2026-09-28-ronda2](../reports/verificacion/010-2026-09-28-ronda2.md) |
| 011 | 1 | APROBADO (6 Medios, 3 Bajos) | [011-2026-09-28](../reports/verificacion/011-2026-09-28.md) |

## 4. Cierre

**Cerrado el 2026-09-28:** las specs 009, 010 y 011 están `hecha`. La 010 se aprobó en la ronda 2; la 009 y la 011, en la ronda 1.

### Retroalimentación
- **Funcionó:**
  - Pruebas del motor con números redondos calculables a mano: el verificador pudo cuadrar a
    mano las tres pantallas (`/lotes`, `/recomendacion`, `/reporte`) y la liquidación de una venta.
  - La función atómica `registrar_venta`: 11 intentos inválidos no dejaron nada a medias.
- **No funcionó:**
  - Usé el último pesaje como "peso de hoy" (Alto de la 010 r1). Toda cifra que se proyecta a hoy
    debe partir del peso estimado de hoy, y cada pantalla debe usar la misma función.
  - Hay reglas que siguen solo en la interfaz o en la función, no en la tabla (venta_animales
    acepta escrituras directas).
- **Cambiar en el siguiente sprint:**
  - Una sola función de dominio por cifra que se muestre en más de una pantalla (peso promedio,
    avance, fecha de meta).
  - Toda tabla nueva con reglas lleva trigger desde el principio.

### Deuda
| ID | Descripción | Severidad | Origen | Sprint destino |
|---|---|---|---|---|
| DT-03-1 | Con un vientre en el lote, `/lotes` y `/recomendacion` dan fecha de meta distinta; "peso promedio" y "avance" no coinciden entre pantallas (`lotes.js` frente a `decision.js`) | Media | Verificación 010 r2 | 5 |
| DT-03-2 | Una GDP medida en un solo día (250 → 256 kg) dispara el peso estimado de hoy | Media | Verificación 010 r2 | 5 |
| DT-03-3 | **Decisión humana:** liquidación del tenedor por animal (regla D11 de la 010) o sobre la ganancia neta del contrato (D8) | Media | Verificación 011 | **Resuelta el 2026-09-28:** por contrato (ver bitácora del Sprint 04) |
| DT-03-4 | Gastos del día de la venta o posteriores a una venta con fecha pasada se pierden o se cuentan dos veces | Media | Verificación 011 | 5 |
| DT-03-5 | Margen esperado y real con bases distintas (último pesaje frente a peso estimado) | Media | Verificación 011 | 5 |
| DT-03-6 | `venta_animales` y `ventas` aceptan escrituras directas (vientre vendido, peso editado, venta borrada) | Media | Verificación 011 | 5 |
| DT-03-7 | La casilla para incluir un animal en la venta mide 20×20 px en el celular | Media | Verificación 011 | 5 |
| DT-03-8 | `SIN_DATOS` cuenta como "No siguió la recomendación"; la ternera recibe aviso pero no confirmación | Baja | Verificación 011 | 5 |
| DT-03-9 | **Decisión humana:** "Vender" cuando esperar ya no paga aunque no se llegó a la meta. El verificador propone una etiqueta propia ("no llegó a la meta pactada") escrita en R5 | Media | Verificación 010 | **Resuelta el 2026-09-28:** se mantiene la regla; la razón dice que no se llegó a la meta |
| DT-03-10 | Código muerto: `decision.js:4`, parámetro `compacto` en `AnalisisVenta.jsx` | Baja | Verificación 010 r2 | 5 |

Corregidos después de aprobar (ver la bitácora del Sprint 04):
- Pronóstico que no responde: la recomendación ya no espera 20 s.
- El rojo de un potrero ajeno al lote ya no anticipa la venta.
- Animal vendido distinguible en `/animales` y sin "Registrar peso" en su ficha.
- "Pasto: rojo" unificado con "Escaso".
- Plurales ("1 vientres").

### Información importante
- **Decisiones:**
  - D10: el equilibrio incluye la compra, los gastos repartidos y el destare.
  - D11: los tenedores cobran por animal, solo sobre la ganancia positiva (pendiente de confirmar, DT-03-3).
  - La venta guarda una copia de la recomendación del momento, para medir si se siguió.
- **Recursos creados:** migraciones 1200 (pasto y parámetros) y 1300 (ventas y `registrar_venta`).
- **Gotchas:** el pronóstico entra en la carga de la recomendación; si no tiene límite de tiempo,
  una API lenta bloquea la pantalla.

### Para el siguiente sprint
- Resolver DT-03-3 y DT-03-9 con el humano antes del piloto con ventas reales.
