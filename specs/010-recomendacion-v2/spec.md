# Spec 010 — Recomendación de venta v2: costo real, participación del tenedor y escenarios

- Estado: hecha
- Sprint: 3
- Módulos del plan: M10

## Contexto
El motor v1 compara el precio de mercado contra el costo de compra dividido por el peso
actual. Eso ignora los gastos (spec 008), el destare (D5) y la parte del tenedor (D11), y no
dice qué pasa si se espera unas semanas. La decisión real de Miguel es "vender hoy o esperar",
con el riesgo del pasto y del clima encima. Esta spec reemplaza el motor por uno que responde
esa pregunta con números explicables.

## Requisitos (EARS)
- R1 — El sistema deberá calcular por lote el punto de equilibrio real (D10): costo acumulado
  total de los animales activos / peso vendible total, con peso vendible = peso actual × (1 −
  destare).
- R2 — El sistema deberá calcular el margen neto para Santa Rita (D11): ingreso − costo
  acumulado − participación de los tenedores. La participación de cada contrato "Al partir" es
  su porcentaje sobre la ganancia neta del contrato (la suma de las ganancias de sus animales,
  donde la pérdida de uno descuenta de los demás), acumulada con las ventas anteriores del mismo
  contrato y descontando lo ya pagado (ver 011 R5). *(Cambiado el 2026-09-28 por decisión
  humana, DT-03-3 y DT-04-9: antes se calculaba animal por animal.)*
- R3 — El sistema deberá mostrar escenarios de vender hoy, en 2, en 4 y en 8 semanas. Cada uno
  usa el peso proyectado con la GDP de cada animal y le suma el gasto diario promedio del lote
  en los últimos 90 días por los días de espera.
- R4 — El sistema deberá mostrar la sensibilidad del margen de hoy a un precio −10 %, −5 %,
  +5 % y +10 %.
- R5 — El sistema deberá recomendar una de estas opciones, con las razones escritas:
  - `VENDER`: meta alcanzada y margen positivo.
  - `VENDER_ANTICIPADO`: margen positivo y riesgo de pasto, es decir, pasto en rojo o menos
    de 2 mm de lluvia pronosticados en 7 días.
  - `ESPERAR`: el margen crece en los escenarios siguientes y no hay riesgo.
  - `VENDER` (sin meta): margen positivo, sin riesgo, y esperar ya no sube el margen, aunque el
    lote no haya llegado a la meta pactada. La razón dice que la meta no se alcanzó y pide
    confirmar el peso con el comprador. *(Confirmado el 2026-09-28 por decisión humana, DT-03-9.)*
  - `NO_VENDER`: margen negativo hoy.
  - `SIN_DATOS`: falta el precio de mercado o el peso.
- R6 — Mientras el clima esté con datos de respaldo (sin conexión), el sistema no deberá usar
  la lluvia para recomendar, y deberá decirlo.
- R7 — El sistema deberá excluir del cálculo de venta los animales de categoría `vientre` (D2)
  y decir cuántos se excluyeron.
- R8 — El reporte imprimible deberá usar el motor v2, con los escenarios y las razones.

## Fuera de alcance
- Modelos predictivos del precio (fuera del MVP).

## Diseño
- **Dominio:** `src/domain/decision.js` (funciones puras) con `analizarLoteV2(entrada)`, que
  recibe animales, costos, precio, destare, clima y pasto. Tiene pruebas de cada regla y de
  cada caso borde. `breakeven.js` queda solo con `pesoActual` y el formato.
- **UI:** Recomendación y Reporte muestran el semáforo, el equilibrio real, el margen neto, la
  tabla de escenarios y la de sensibilidad, y las razones.

## Correcciones de la verificación ronda 1 (`reports/verificacion/010-2026-09-28.md`)
- **Alto (R3):** los escenarios y el chequeo de la meta parten del **peso estimado de hoy** de
  cada animal (último pesaje + su GDP × días desde entonces, `pesoEstimadoHoy` en `gdp.js`). Es
  el mismo cálculo de la proyección del lote (spec 006), así que Lotes y Recomendación ya no se
  contradicen.
- **Medios:**
  - Con riesgo de pasto, "No vender todavía" ya no invita a esperar a que el lote siga ganando peso.
  - La recomendación espera el pronóstico antes de mostrarse (ya no cambia de "Esperar" a
    "Vender antes").
  - "Vender antes de la meta" dice cuánto margen se deja de ganar (D4).
- **Bajos:**
  - Con margen cero ya no dice "pérdida de $-0".
  - "1 vientre excluido" en singular.
  - "Vender antes de la meta" pasa a verde, porque es una recomendación de vender; "No vender
    todavía" sigue en rojo.
  - En el celular, la tabla del reporte oculta columnas y la impresión las muestra todas.
- **Pendiente de decisión humana:** además de las cinco recomendaciones de R5, el motor
  recomienda `VENDER` cuando esperar ya no paga (el costo diario supera la ganancia de peso),
  aunque el lote no haya llegado a la meta.

## Tareas
- [x] T1 Dominio v2 + pruebas
- [x] T2 Pantalla de recomendación v2
- [x] T3 Reporte v2
- [x] T4 E2E
- [ ] T5 Verificador

## Criterios de aceptación para el verificador
- Con un lote de prueba de números redondos, cada cifra (equilibrio, margen, participación,
  escenarios) coincide con el cálculo a mano.
- Pasto en rojo con margen positivo recomienda `VENDER_ANTICIPADO`.

## Aprobación
- [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs de los sprints antes de que se escribieran. Hay que confirmarlo al revisar.
