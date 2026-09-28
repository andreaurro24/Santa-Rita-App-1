# Spec 006 — Lotes, ciclos de ceba, fincas, potreros y movimientos

- Estado: aprobada
- Sprint: 1
- Módulos del plan: M5, M6

## Contexto
La venta se decide por lote (D3), así que el lote necesita existir como entidad con su meta
de peso, su fecha de inicio y una fecha de venta proyectada. Además el hato está repartido
entre Santa Rita y las fincas de los tenedores (D7), y dentro de Santa Rita en potreros.
Miguel necesita saber dónde está cada animal y desde cuándo.

## Requisitos (EARS)
- R1 — El sistema deberá permitir crear y editar lotes con código, nombre, tipo (`ceba` /
  `cria`), fecha de inicio, peso meta pactado y estado (`activo`, `listo`, `vendido`, `cerrado`).
- R2 — El sistema deberá mostrar por lote: número de animales activos, peso promedio actual,
  avance hacia la meta, GDP promedio (spec 004) y fecha proyectada para llegar a la meta.
- R3 — Mientras la GDP promedio del lote sea ≤ 0 o no haya al menos dos pesajes, el sistema
  deberá mostrar la fecha proyectada como "sin datos suficientes" en vez de una fecha.
- R4 — Cuando el peso promedio del lote alcance la meta, el sistema deberá sugerir cambiar su
  estado a `listo`.
- R5 — El sistema deberá permitir crear potreros dentro de una finca y listar las fincas
  (propia y de tenedores) con su número de animales.
- R6 — El sistema deberá permitir mover uno o varios animales a otra finca, potrero o lote,
  registrando fecha, origen, destino y motivo en `movimientos`.
- R7 — El sistema deberá mostrar en la ficha del animal su ubicación actual y el historial
  de movimientos.
- R8 — Si se intenta pasar a un lote de tipo `ceba` un animal de categoría `vientre`, el
  sistema deberá advertir que los vientres no se venden (D2) y pedir confirmación.

## Fuera de alcance
- Contratos "Al partir" (spec 007): mover a la finca de un tenedor no crea contrato.

## Diseño
- Datos: tabla `movimientos` (animal_id, fecha, desde/hacia finca, potrero y lote, motivo).
  Mover actualiza `animales` e inserta el movimiento en una sola función SQL
  `mover_animales(ids uuid[], …)` con `security invoker`, para que sea atómico.
- Dominio: `src/domain/lotes.js` con `resumenLote(animales, hoy)` y `fechaProyectada`, con tests.
- UI: ruta `/lotes` (lista y detalle) y ruta `/fincas` (fincas y potreros). Acción "Mover" con
  selección múltiple en el hato.
- Archivos: `src/pages/Lotes.jsx`, `src/pages/LoteDetalle.jsx`, `src/pages/Fincas.jsx`,
  `src/data/lotes.js`, `src/data/fincas.js`, `src/domain/lotes.js`, migración.

## Tareas
- [ ] T1 Migración `movimientos` + función `mover_animales`
- [ ] T2 Dominio de resumen de lote y proyección + tests
- [ ] T3 CRUD de lotes y detalle con proyección — verifica: E2E
- [ ] T4 Fincas y potreros — verifica: E2E crear potrero
- [ ] T5 Mover animales (selección múltiple) e historial en la ficha — verifica: E2E
- [ ] T6 Verificador

## Criterios de aceptación para el verificador
- Mover 2 animales a un potrero nuevo crea 2 movimientos y la ficha muestra la nueva ubicación.
- La proyección del lote 2026-A es una fecha futura coherente con su GDP (± 1 día respecto al
  cálculo manual: (meta − promedio) / GDP).

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-09-27 (aprobación anticipada de todas las specs y planes de sprint)
