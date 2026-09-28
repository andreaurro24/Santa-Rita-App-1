# Spec 011 — Venta real y cierre del ciclo

- Estado: hecha
- Sprint: 3
- Módulos del plan: M11

## Contexto
El KPI del proyecto es que el reporte del sistema se use en una venta real. Para medirlo hay
que registrar la venta tal como ocurrió (comprador, pesos, precio, destare) y compararla con lo
que recomendó el sistema ese día. La venta también cierra el ciclo del lote y define cuánto le
toca a cada tenedor "Al partir".

## Requisitos (EARS)
- R1 — El sistema deberá registrar la venta de un lote: fecha, comprador, precio por kilo,
  destare y el peso de cada animal vendido. Por defecto propone el peso actual, que se puede
  corregir.
- R2 — Si se intenta vender un animal de categoría `vientre`, el sistema deberá rechazarlo
  (D2), en la interfaz y en la base de datos.
- R3 — Cuando se guarde la venta, el sistema deberá marcar los animales como `vendido` y el
  lote como `vendido` si no le quedan animales activos. Todo en una sola transacción.
- R4 — El sistema deberá guardar una copia de la recomendación del sistema al momento de la
  venta (recomendación, equilibrio y margen) y mostrarla junto al resultado real.
- R5 — El sistema deberá calcular la liquidación de cada contrato "Al partir" en la venta:
  porcentaje × ganancia neta **acumulada** del contrato (suma de las ganancias de todos sus animales
  vendidos hasta esa venta, en orden de fecha y hora de registro), menos lo ya pagado en ventas
  anteriores, nunca menos de $0. Si una pérdida posterior deja al tenedor con más de lo que le toca,
  la liquidación muestra el **saldo a favor de Santa Rita**. *(Cambiado el 2026-09-28 por decisión
  humana: DT-03-3 por contrato y DT-04-9 acumulado entre ventas.)*
- R6 — El sistema deberá listar las ventas con su ingreso, su margen real y si se siguió la
  recomendación.

## Fuera de alcance
- Facturación y pagos.

## Diseño
- **Datos:**
  - Tablas `ventas` y `venta_animales`.
  - Función `registrar_venta(...)`, atómica: valida D2, inserta la venta y marca los estados.
  - La recomendación se guarda como `jsonb`.
- **UI:** `/ventas` (lista), `/ventas/nueva?lote=` (asistente) y `/ventas/:id` (detalle con la
  comparación y la liquidación).
- **Dominio:** `liquidacionTenedores` y `resultadoVenta` en `src/domain/decision.js`, con
  pruebas.

## Tareas
- [x] T1 Migración, función y RLS
- [x] T2 Asistente de venta
- [x] T3 Detalle, comparación y liquidación
- [x] T4 E2E
- [ ] T5 Verificador

## Aprobación
- [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs de los sprints antes de que se escribieran. Hay que confirmarlo al revisar.
