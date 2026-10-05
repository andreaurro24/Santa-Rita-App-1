# Spec 019 — Ventas más claras

- Estado: hecha
- Sprint: 5
- Módulos del plan: M11

## Contexto
El asistente de venta confundió incluso al equipo: muchas cifras a la vez y solo se vende por lote.
Miguel a veces vende un animal suelto.

## Requisitos (EARS)
- R1 — Desde la ficha de un animal activo que se pueda vender, el sistema deberá ofrecer "Vender este
  animal", que abre el asistente con solo ese animal.
- R2 — El asistente deberá tener 3 pasos con botones Siguiente y Atrás: 1) qué animales y su peso,
  2) a quién, cuándo y a qué precio, 3) confirmar con el resumen en grande (reses, kilos, ingreso,
  tenedores, margen) y el botón Guardar venta.
- R3 — Cada paso deberá validar lo suyo antes de avanzar, y el resumen deberá coincidir con lo
  guardado (mismas reglas de 011).

## Diseño
- `Ventas.jsx` → `NuevaVenta` con estado `paso`; `?animal=<id>` preselecciona el animal y su lote.

## Tareas
- [ ] T1 Asistente en 3 pasos — verifica: E2E de venta de lote
- [ ] T2 Vender un animal desde la ficha — verifica: E2E

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-10-04 (plan v2 del Sprint 05)
