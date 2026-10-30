# Línea base: la misma IA sin arnés

**Cómo se corrió (2026-10-30):** un subagente nuevo de Claude Code por caso (Claude Opus 5.5),
sin instrucciones del proyecto, sin censo, sin glosario y sin skills. Solo podía leer la imagen
del caso (o el texto del mensaje). Pedido, igual para todos: *"Me lo mandó el administrador por
Telegram el <fecha>. Pásame esto a registros de pesaje para cargarlos en la app. Dame una tabla
con número del animal, fecha y peso, lista para cargar."* (en el caso 5, registros de sanidad).

**Cómo se calificó:** con los criterios de "terminado" del canvas. Lo que el modelo puso en la
tabla "lista para cargar" cuenta como cargado, porque sin arnés no hay validador ni
confirmación que lo frene.

| Caso | Lo que hizo | ¿Correcto? | Correcciones | Errores graves |
|---|---|---|---|---|
| 1. Planilla nítida | 10 filas bien, fecha de la planilla (27/10) y no la del mensaje | Sí | 0 | 0 |
| 2. Número fuera del censo | Dejó la 0209 "lista para cargar". Notó que faltaba la 208, pero no pudo saber que la 209 no existe | No | 1 | 0 |
| 3. Salto de más del 15 % | Dejó la 0303 con 232 kg (+24 %) como lista, sin ninguna alerta. No conoce el peso anterior | No | 1 | 0 |
| 4. Fila borrosa | No inventó la fila: la dejó por fuera y pidió el dato. Supuso que era la 106, pero no le puso peso | Sí | 0 | 0 |
| 5. Vacuna de todo un lote | No pudo armar los 6 registros: no sabe qué animales tiene el lote 2026-B. No inventó números | No | 1 (hubo que darle la lista) | 0 |
| 6. Animal repetido | Retuvo la 0302 (218 y 221) y cargó los otros 5 | Sí | 0 | 0 |
| 7. Extra: fecha futura | Detectó el 27/11 y no cargó. Sugirió que era 27/10 sin corregirlo | Sí | 0 | 0 |

**Resumen:** 3 de 6 casos base correctos (4 de 7 con el extra), 3 correcciones, 0 errores graves.
¿Se puede retomar en otra sesión sin explicar nada? **No**: no queda registro de qué se mandó,
qué se cargó ni qué quedó pendiente.

**Lo que enseña la línea base:** el modelo lee muy bien y es prudente con lo ilegible. Lo que
le falla no es la lectura sino el **contexto** (no conoce el censo ni el último peso) y la
**memoria** (no deja rastro). Por eso el arnés invierte en contexto, verificación con el censo
y bitácora, no en "mejores prompts".
