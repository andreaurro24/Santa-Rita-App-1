# Spec 020 — Fincas, lotes y gastos de finca

- Estado: hecha
- Sprint: 5
- Módulos del plan: M5, M6, M7, M8

## Contexto
Miguel registra gastos que no son de un lote (combustible, cercas) y quiere saber a nombre de quién
está cada finca y qué lotes están "Al partir".

## Requisitos (EARS)
- R1 — Al crear o editar una finca, el sistema deberá permitir poner a nombre de quién está. Si es una
  finca de tenedor, deberá permitir elegir un tenedor ya registrado en "Al partir" (y enlazarlo) o
  crearlo en ese momento.
- R2 — Los lotes deberán tener una descripción opcional (hasta 300 caracteres) al crearlos y editarlos.
- R3 — Donde se muestre un lote (Lotes, Gastos) el sistema deberá marcar "Al partir · <tenedor>"
  cuando sus animales activos estén con un tenedor.
- R4 — Un gasto deberá poder ser de la finca entera (sin lote) o de un lote/animal. Los gastos de
  finca se suman aparte y no se reparten entre los animales (D9 sin cambios).

## Diseño
- Migración 1700: `fincas.propietario`, `lotes.descripcion`, `costos.finca_id`, `costos.lote_id`
  opcional, check "lote o finca" y "animal solo con lote".
- `repartirCostos` ignora gastos sin lote; `/costos` agrupa "Gastos de la finca".

## Tareas
- [ ] T1 Finca con propietario y tenedor — verifica: E2E
- [ ] T2 Lote con descripción y marca "Al partir" — verifica: E2E
- [ ] T3 Gastos de finca — verifica: unitaria del reparto + E2E

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-10-04 (plan v2 del Sprint 05)
