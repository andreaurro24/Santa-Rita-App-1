# Spec 009 — Estado del pasto y parámetros de venta

- Estado: aprobada
- Sprint: 3
- Módulos del plan: M9

## Contexto
Una de las dos razones reales para vender antes de la meta es la escasez de pasto (D4). Hoy
solo se infiere del pronóstico de lluvia. Miguel ve el pasto con sus propios ojos en cada
visita y puede marcarlo con un semáforo. Además, el destare (D5) cambia el peso que se paga y
debe ser un parámetro de la finca, no un número escrito en el código.

## Requisitos (EARS)
- R1 — El sistema deberá registrar el estado del pasto de una finca (y opcionalmente de un
  potrero) con fecha, nivel (`verde`, `amarillo`, `rojo`) y notas.
- R2 — El sistema deberá mostrar el último estado del pasto de cada finca en Mercado y clima,
  con su fecha, y marcarlo como "desactualizado" si tiene más de 30 días.
- R3 — El sistema deberá guardar el porcentaje de destare de la finca (0–15 %, por defecto 0)
  y permitir cambiarlo.
- R4 — Si la fecha del estado del pasto es futura o el nivel no es válido, el sistema deberá
  rechazarlo, en la interfaz y en la base de datos.

## Fuera de alcance
- Mediciones de biomasa o sensores.

## Diseño
- **Datos:**
  - Tabla `condicion_pasto` (finca_id, potrero_id, fecha, nivel, notas).
  - Tabla `parametros` de una sola fila (`destare_pct`), con RLS.
- **UI:** tarjeta "Estado del pasto" y tarjeta "Parámetros de venta" en `/mercado`.
- **Dominio:** `pastoMasCritico(estados, hoy)`, que usa solo los estados de ≤ 30 días, con
  pruebas.

## Tareas
- [ ] T1 Migración y RLS
- [ ] T2 Registro y visualización del pasto
- [ ] T3 Parámetro de destare
- [ ] T4 E2E
- [ ] T5 Verificador

## Aprobación
- [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs de los sprints antes de que se escribieran. Hay que confirmarlo al revisar.
