# Spec 004 — Jornada de pesaje por lote y ganancia diaria de peso (GDP)

- Estado: hecha
- Sprint: 1
- Módulos del plan: M3

## Contexto
En la visita mensual se pesa el lote completo en el corral. Hoy el resultado queda en fotos
de WhatsApp o en papel. La app debe permitir capturar el peso de 30 a 40 animales seguidos,
desde el celular y sin perder el hilo, y convertir esos datos en la ganancia diaria de peso
(GDP), que es la base para proyectar la fecha de venta (spec 006) y la recomendación (spec 010).

## Requisitos (EARS)
- R1 — El sistema deberá permitir abrir una jornada de pesaje para un lote en una fecha,
  mostrando sus animales activos uno por uno o en lista, con el último peso de referencia.
- R2 — Cuando el usuario escriba un peso y confirme, el sistema deberá guardarlo de
  inmediato y pasar al siguiente animal sin pesar.
- R3 — Si un peso difiere más de un 15 % del último registrado, el sistema deberá pedir
  confirmación antes de guardarlo (posible error de digitación).
- R4 — El sistema deberá mostrar el avance de la jornada (pesados / total) y permitir
  cerrarla con animales sin pesar, dejándolos listados.
- R5 — El sistema deberá calcular la GDP de cada animal (kg/día) entre su primer y su último
  pesaje, y entre los dos últimos pesajes (GDP reciente).
- R6 — El sistema deberá calcular la GDP promedio del lote con sus animales activos.
- R7 — Si la GDP reciente de un animal es negativa, el sistema deberá marcarlo con una
  alerta de pérdida de peso en su ficha, en el hato y en el panel.
- R8 — El sistema deberá mostrar las jornadas anteriores de un lote con fecha, número de
  animales pesados y peso promedio.

## Fuera de alcance
- Integración con básculas (fuera del MVP).
- Proyección de la fecha de venta (spec 006).

## Diseño
- Datos: tabla `jornadas_pesaje` (lote_id, fecha, notas, estado `abierta`/`cerrada`),
  columna `pesajes.jornada_id` (nullable) y RLS igual que las demás tablas.
- Dominio: `src/domain/gdp.js` con `gdpTotal`, `gdpReciente`, `gdpLote` y
  `variacionSospechosa`, cubiertas con tests.
- UI: ruta `/pesaje` (entrada "Pesaje" en la navegación). Se elige el lote y se abre la
  jornada. En celular: un animal por pantalla con la chapeta grande, un campo numérico con
  `inputMode="decimal"` y los botones Guardar / Saltar.
- Archivos: `src/pages/Pesaje.jsx`, `src/data/pesajes.js`, `src/domain/gdp.js`, migración.

## Desvíos durante la implementación (2026-09-28)
- **Aprobado por el humano el 2026-09-28 (DT-01-1):** la GDP del último periodo usa al menos 14 días.
- **R5, GDP reciente (corregido tras la verificación ronda 1):** en vez de comparar "los dos últimos pesajes", el último periodo
  compara el último pesaje contra el más reciente de **al menos 14 días antes**
  (`DIAS_MINIMOS_PERIODO`). La báscula tiene ±3 kg de error, y con la regla literal 54 de las
  140 reses de ejemplo aparecían "perdiendo peso" solo por dos pesajes separados 2 a 9 días.
  Con 14 días quedan 0, que es lo coherente con la semilla. Si no hay un pesaje de 14 días
  antes, la GDP reciente es "—".
  - **Corrección ronda 1 (Alto):** la regla sola escondía pérdidas reales; por ejemplo, −10 kg en
    7 días no daba alerta. Ahora también se alerta si entre los dos últimos pesajes cae más de
    **8 kg** (`UMBRAL_CAIDA_KG`, por encima de la mayor caída por ruido de la semilla, 7,2 kg).
    Así se detectan los tres casos del verificador sin falsas alarmas en la semilla.
- **Otras correcciones de la ronda 1:**
  - "Registrar peso" de la ficha también pide confirmación con una variación > 15 % (R3).
  - La base de datos rechaza pesajes de jornada si la jornada está cerrada, si el animal es de
    otro lote o si la fecha no coincide (migración 1100).
  - La semilla vacía las tablas nuevas.
  - El texto del panel explica la regla completa.
- **Ruta y navegación:** "Pesaje" entra a la barra inferior del celular (Inicio, Hato, Pesaje,
  Venta, Más), porque es la tarea de campo más frecuente.
- **Captura:** el campo de peso es de texto con `inputMode="decimal"` y acepta coma decimal
  ("355,5"), que es lo que escribe un teclado en español; `type="number"` la rechaza en
  algunos navegadores.

## Tareas
- [x] T1 Migración `jornadas_pesaje` + `pesajes.jornada_id` + RLS
- [x] T2 `src/domain/gdp.js` + tests — verifica: `npm test`
- [x] T3 Pantalla de jornada (abrir, capturar, saltar, cerrar) — verifica: E2E de 3 animales
- [x] T4 Confirmación por variación > 15 % — verifica: E2E
- [x] T5 GDP y alerta de pérdida en la ficha, el hato y el panel — verifica: E2E
- [x] T6 Historial de jornadas del lote
- [x] T7 Verificador (ronda 1 RECHAZADO; ronda 2 APROBADO)

## Criterios de aceptación para el verificador
- Abrir una jornada del lote 2026-B, pesar 3 animales (uno con una variación de +30 % que
  pide confirmación), cerrarla y ver la jornada en el historial con 3 pesados.
- Un animal con pesos 300 → 290 muestra alerta de pérdida de peso.

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-09-27 (aprobación anticipada de todas las specs y planes de sprint)
