# Spec 025 — Simulador de venta por lotes y venta de varios lotes

- Estado: en-verificacion
- Sprint: 6
- Módulos del plan: M10, M11

## Contexto
El proyecto de referencia tiene un "Simulador de venta por grupos": se marcan los lotes y al lado se
ven:
- el peso total;
- el precio por kilo;
- el valor bruto;
- los costos reales;
- las comisiones y el transporte;
- el beneficio neto con su margen.

Desde ahí se confirma la venta. El equipo quiere lo mismo, y que una venta pueda llevar animales de
varios lotes (decisión del usuario del 2026-10-05).

## Requisitos (EARS)
- R1 — "Registrar venta" deberá abrir el **simulador**. A la izquierda va la lista de lotes con
  animales vendibles, cada uno con una casilla, "Seleccionar todos" y, por lote:
  - cabezas vendibles;
  - peso promedio;
  - ganancia de peso promedio desde el ingreso;
  - valor al precio actual.

  Se puede abrir un lote para quitar o poner animales sueltos.
- R2 — A la derecha (abajo en el celular, con el resultado pegado al fondo de la pantalla) deberá
  verse el panel:
  - lotes y cabezas elegidos;
  - **peso total estimado**;
  - **precio de venta por kilo**, editable con `CampoPesos`;
  - **valor bruto**;
  - **costos operativos reales** (acumulados de esos animales);
  - **comisiones y transporte** (editable, en pesos);
  - **a los tenedores** (si hay animales "Al partir");
  - **beneficio neto para Santa Rita** con su **% de margen sobre el valor bruto**.

  Todo se recalcula al instante.
- R3 — El precio por kilo deberá venir lleno con el precio de la zona de cada animal, ponderado
  por su peso (spec 021), con la nota "Precio de la zona: $X/kg (promedio de los animales)". Miguel
  puede cambiarlo.
- R4 — Los vientres y los animales que no están activos no deberán aparecer como vendibles. Si un
  lote tiene vientres, la tarjeta deberá decir "N vientres no se venden".
- R5 — "Confirmar venta" deberá pedir en un paso final:
  - la fecha (no futura);
  - el comprador;
  - el destare (%);
  - opcionalmente, el peso real de báscula de cada animal;
  - notas.

  Después muestra el resumen y guarda **una sola venta** con todos los animales elegidos, aunque
  sean de varios lotes. Sigue protegida contra el doble toque (spec 019).
- R6 — La base de datos deberá aceptar ventas de varios lotes:
  - cada animal vendido guarda el lote en que estaba;
  - la venta guarda las comisiones y el transporte;
  - cada lote que quede sin animales activos pasa a "vendido".

  Se mantienen las reglas actuales (nada de vientres, caballos, animales inactivos, fechas futuras
  o anteriores al ingreso, ni lotes cerrados).
- R7 — Las comisiones y el transporte deberán restarse **antes** de calcular la parte de los
  tenedores. La parte se calcula sobre la ganancia neta del contrato, de forma acumulada (D8): la
  comisión de cada animal es proporcional a su valor bruto.
- R8 — La lista de ventas, el detalle, "Al partir" y el reporte deberán mostrar los lotes de cada
  venta ("Lote A y Lote B") y las comisiones. El "Margen esperado vs. real" de la spec 011 sigue
  funcionando.
- R9 — "Vender este animal" desde la ficha deberá abrir el simulador con solo ese animal elegido.

## Fuera de alcance
- Un precio por kilo distinto para cada lote dentro de una misma venta: hay uno solo, como en la
  referencia.
- La venta de caballos sigue aparte (DT-05-5).
- Facturas o documentos de venta.

## Diseño
- Datos (migración 1900, parte B). Producción tiene 0 ventas: no hay datos que migrar.
  - `ventas.lote_id` pasa a ser opcional y se deja de usar; se borra en el Sprint 7, cuando nada lo
    lea.
  - `ventas.gastos_venta_cop bigint not null default 0 check (>= 0)`.
  - `venta_animales.lote_id uuid not null references lotes` y un índice.
  - Nueva `registrar_venta(fecha, comprador, precio_kg, destare, gastos_venta, recomendacion, notas,
    animales)`, `security invoker`, que deduce los lotes de los animales.
  - La versión vieja, con `lote`, se elimina.
- Dominio: `src/domain/decision.js`.
  - `resultadoVenta` recibe `gastosVenta` y los reparte por valor bruto antes de la parte de los
    tenedores.
  - `simularVenta({ animales, precioKg, gastosVenta, previo })` devuelve el panel de R2.
  - Pruebas: un lote, dos lotes, Al partir con comisión y margen negativo.
- Datos en el cliente:
  - `src/data/ventas.js` lee `lotes` desde `venta_animales`.
  - `useRegistrarVenta` llama a la RPC nueva.
  - `useAnalisisLote` sirve para varios lotes, o se crea `useAnalisisVenta(animalIds)`.
- UI: `src/pages/Ventas.jsx`.
  - `NuevaVenta` = `Simulador`, con dos columnas en escritorio y apilado en el celular.
  - El panel de resultado es fijo abajo en el celular y muestra "Beneficio neto" y "Confirmar
    venta".
  - "Confirmar venta" pasa a `DatosVenta` y luego a `Resumen`.
  - `?animal=` y `?lote=` preseleccionan.
- Decisión clave: una venta con varios lotes (elegido por el usuario el 2026-10-05). Se descartó
  "una venta por lote" porque, en la finca, un camión con un comprador es una venta.

## Tareas
- [x] T1 Dominio `simularVenta` y `resultadoVenta` con gastos de venta, con pruebas — verifica: `npm test`
- [x] T2 Migración 1900 parte B y RPC nueva — verifica: aplicada; SQL de prueba que vende 2 lotes y deja cada uno en "vendido" solo si quedó vacío; rechaza vientre y caballo
- [x] T3 Simulador (lista de lotes, panel y selección de animales sueltos) — verifica: E2E en 375 y 1280 px
- [x] T4 Paso de datos, resumen y guardado; ficha → simulador con un animal — verifica: E2E (vender 2 lotes con $300.000 de transporte; el margen guardado es igual al simulado)
- [x] T5 Lista, detalle, Al partir y reporte con varios lotes y comisiones — verifica: E2E y `npm test`

## Criterios de aceptación para el verificador
- Con 2 lotes (3 y 2 animales; uno "Al partir" al 50 %), precio $8.000/kg y $300.000 de
  transporte:
  - el panel da el beneficio neto y el margen que da a mano `simularVenta`;
  - la venta guardada muestra los mismos números en su detalle;
  - en "Al partir" la parte del tenedor descuenta su proporción del transporte.
- Un lote con 2 vientres y 3 novillos ofrece solo 3 vendibles y dice "2 vientres no se venden".
- El doble toque en "Guardar venta" guarda una sola venta.

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-10-05 ("Aprobo. Construye todo de una.")
