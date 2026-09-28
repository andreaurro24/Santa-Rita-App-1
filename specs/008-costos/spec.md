# Spec 008 — Insumos y costos por lote y por animal

- Estado: hecha
- Sprint: 2
- Módulos del plan: M8

## Contexto
El punto de equilibrio actual solo usa el costo de compra, y deja por fuera el suplemento, la
sal mineral, los medicamentos, los jornales, el transporte y el arriendo de pasto. Sin esos
costos, la recomendación de venta sobreestima el margen. Esta spec registra los gastos y
calcula el costo acumulado de cada animal y de cada lote según D9. La recomendación v2
(spec 010) los usará.

## Requisitos (EARS)
- R1 — El sistema deberá registrar un gasto con fecha, lote, categoría (suplemento, sal
  mineral, medicamentos, jornales, transporte, arriendo de pasto, otros), descripción y monto
  en COP. Opcionalmente se asigna a un solo animal.
- R2 — Si el monto es ≤ 0, la fecha es futura o falta el lote, el sistema deberá rechazar el
  gasto, en la interfaz y en la base de datos.
- R3 — El sistema deberá repartir cada gasto de lote por partes iguales entre los animales del
  lote que ya habían ingresado en la fecha del gasto (D9). Un gasto asignado a un animal solo
  le suma a ese animal.
- R4 — El sistema deberá mostrar el costo acumulado de cada animal (compra + gastos directos
  + parte de los gastos del lote) en su ficha, con el desglose por categoría.
- R5 — El sistema deberá mostrar por lote el total gastado, el desglose por categoría y el
  costo acumulado promedio por animal.
- R6 — El sistema deberá permitir corregir o borrar un gasto mal registrado; borrar solo lo
  puede hacer el rol `dueno` y pide confirmación.

## Fuera de alcance
- Inventario de insumos (existencias, bodega).
- Contabilidad general de la finca (fuera del proyecto).

## Diseño
- **Datos:** tabla `costos` (lote_id, animal_id opcional, categoria, descripcion, monto_cop
  > 0, fecha), con RLS, fecha no futura y fecha desde el año 2000. Un gasto asignado a un
  animal exige que el animal pertenezca al lote (trigger).
- **Dominio:** `src/domain/costos.js`, con `costoAcumuladoAnimal`, `resumenCostosLote` y
  `animalesElegibles(fecha)`, todo con pruebas.
- **UI:**
  - Ruta `/costos`: registrar un gasto en hoja inferior y listar por lote con filtros.
  - Tarjeta de costos en la ficha del animal y en el detalle del lote.
- **Simplificación declarada:** "animales del lote en la fecha" = los animales que hoy
  pertenecen al lote y que ingresaron en esa fecha o antes. Todavía no se reconstruye la
  pertenencia histórica desde `movimientos`.

## Correcciones de la verificación ronda 1 (`reports/verificacion/008-2026-09-28.md`)
- **Alto:** el reparto usa la **pertenencia histórica** al lote, reconstruida desde `movimientos`
  (reemplaza la simplificación declarada).
  - Un gasto directo sigue al animal aunque cambie de lote.
  - Un gasto de lote se reparte entre los animales que estaban en ese lote en esa fecha: sin
    repartos hacia atrás, y los vendidos dejan de recibir gastos desde su venta.
  - `repartirCostos` (dominio) y `useRepartoCostos` (datos) son la única fuente para la ficha,
    el lote, `/costos`, la recomendación v2 y la venta.
- **Base de datos (migración 1400):** el trigger valida animal y lote solo al crear o reasignar;
  un gasto de un animal que se movió ya se puede editar.
- **Formulario:**
  - El selector de animal ofrece solo animales activos, más el animal ya asignado.
  - Los montos con decimales se rechazan; un monto por encima de $5.000 millones pide revisar.
  - Los errores de fecha y de número fuera de rango muestran un mensaje en español.
  - Los botones de solo ícono miden 48 px.

## Tareas
- [x] T1 Migración `costos` + RLS + validaciones
- [x] T2 Dominio de reparto y acumulado + pruebas
- [x] T3 Registro, edición y borrado de gastos en `/costos`
- [x] T4 Costos en la ficha y en el detalle del lote
- [x] T5 E2E
- [x] T6 Verificador (ronda 1 RECHAZADO; ronda 2 APROBADO)

## Criterios de aceptación para el verificador
- Un gasto de $1.000.000 en el lote 2026-B (30 animales, todos ingresados antes) suma
  $33.333 al costo acumulado de cada uno de sus animales.
- Un gasto directo a un animal solo cambia el acumulado de ese animal.

## Aprobación
- [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs de los sprints antes de que se escribieran. Hay que confirmarlo al revisar.
