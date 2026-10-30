# Bitácora de pruebas: arnés "reportes de campo → registros"

Finca Santa Rita · Taller Harness Engineering · corridas del 2026-10-30.
Todo con datos ficticios del censo de demostración (24 novillos en 3 lotes), nunca con datos de
Miguel Ángel. Modelo en todas las corridas: Claude Opus 5.5.

## 1. Los casos

Seis casos base (los del plan; el 5 del plan se separó en el 5 y el 6 porque mezclaba dos
pruebas), uno extra y dos exploratorios agregados después para buscar errores reales. Las fotos
de las planillas se generaron con `scripts/generar-planillas.py`. Las respuestas correctas están
en `casos/casos.json`.

| # | Caso | Entrada | Respuesta correcta |
|---|---|---|---|
| 1 | Planilla nítida, 10 pesos | Foto, LOTE-2025-B, 27/10 | 10 válidos, fecha 27/10 (no la del mensaje) |
| 2 | Número que no está en el censo | Foto con la "209" | 7 válidos; la 0209 dudosa por V1 |
| 3 | Salto de más del 15 % | Foto: 0303 pasa de 187 a 232 kg (+24 %) | 5 válidos; la 0303 dudosa por V5 (RN-01) |
| 4 | Fila borrosa | Foto con una fila manchada | 7 válidos, 1 ilegible; prohibido inventar la 0106 |
| 5 | Vacuna de todo un lote | "Ayer vacunamos todo el lote 2026-B contra aftosa" (29/10) | 6 eventos de vacuna el 28/10 |
| 6 | Animal repetido | Foto con la 0302 dos veces | 5 válidos; las dos filas de la 0302 dudosas por V6 |
| 7 | Extra: fecha futura | Foto fechada 27/11 enviada el 28/10 | 0 válidos; todo dudoso por V3 (RN-14) |
| 8 | Exploratorio: mensaje mixto | "El lunes purgamos a los de El Mango, y a la 204 le pusimos oxitetraciclina" | 9 eventos el 26/10: 8 purgas del LOTE-2026-A y 1 tratamiento de la 0204 |
| 9 | Exploratorio: planilla por chapeta | Foto con la columna "Chapeta" en vez de número | 5 válidos (0101 a 0105), encontrados por chapeta |

## 2. Cómo se corrió cada etapa

- **Sin arnés:** un subagente nuevo por caso, sin instrucciones, censo, glosario ni skills. Solo
  la imagen o el texto y el pedido "pásame esto a registros para cargar en la app". Detalle en
  `corridas/linea-base/resultados.md`.
- **Con arnés (v1):** un subagente nuevo por caso con el rol `extractor-campo`, su salida al
  validador (`arnes.mjs validar`) y el revisor en los casos con dudas. Salidas en
  `corridas/con-arnes/`.
- **Con arnés mejorado:** lo mismo, otra vez en sesiones nuevas, después de los dos ciclos.
  Salidas en `corridas/mejorado/`.

La calificación la hace `arnes/calificar.mjs` contra `casos.json`. Así nadie opina sobre si un
caso quedó bien.

## 3. Comparación

| Mide | Sin arnés | Con arnés (v1) | Con arnés mejorado |
|---|---|---|---|
| Casos base correctos (de 6) | **3** | **6** | **6** |
| Todos los casos correctos | 4 de 7 (no corrió el 8 ni el 9) | 7 de 9 | **9 de 9** |
| Correcciones que tuvo que hacer una persona | 3 (dejar fuera la 0209, frenar la 0303, darle la lista del lote 2026-B) | 2 (descartar un evento correcto en el caso 8; digitar a mano el caso 9) | 0 |
| Errores graves (peso inventado o en la res equivocada) | 0 | 0 | 0 |
| ¿Se puede retomar en otra sesión sin explicar nada? | No: no queda rastro | Sí: bitácora y borradores con estado | Sí. La prueba con un agente nuevo reconstruyó los 9 reportes con 6 suposiciones; se cerraron 2 |
| Reintentos del extractor | n/a | 2 (caso 9, y terminó en revisión humana) | 0 |

Las correcciones de la tabla son las que **no deberían hacer falta**. Responder la pregunta de un
dudoso bien detectado (por ejemplo "¿la 0303 sí pesó 232?") es el trabajo previsto de la persona,
no una corrección.

**Lectura honesta:**
- **Lo que no cambió:** la IA sola no inventó pesos en ningún caso. Fue prudente con la fila
  borrosa y con el animal repetido.
- **Lo que mejoró el arnés:** lo que la IA sola no puede saber. Si un animal existe (censo), cuánto
  pesó el mes pasado (último peso), qué animales tiene un lote, y qué pasó con cada reporte
  (memoria).
- **Lo que garantiza el arnés:** que aunque el modelo se equivoque, nada llega a la app sin una
  persona.

## 4. Dos ciclos de mejora

### Ciclo 1: un tratamiento tomado por duplicado

| | |
|---|---|
| **Observa** | En el caso 8, el validador marcó la 0204 como "repetida" porque tenía dos eventos el mismo día (la purga del lote y su tratamiento). Para confirmar había que descartar un registro correcto. |
| **Diagnostica** | Faltó un **sensor bien calibrado** (capítulo 6, Verificación). La regla V6 se escribió pensando en pesajes ("un animal, una vez por jornada") y se aplicó igual a sanidad. El extractor leyó bien: no faltaba guía. |
| **Blinda** | V6 cambió en `arnes/validador.mjs`. En sanidad, un duplicado es el mismo animal con el mismo tipo y la misma descripción. Prueba nueva "Ciclo 1" en `validador.test.mjs`, que también comprueba que el mismo evento repetido sigue marcado. `contexto/reglas.md` actualizado. |
| **Comprueba** | En una sesión nueva, el extractor procesó otra vez el caso 8: 9 eventos válidos, 0 dudosos, caso correcto. La suite pasa (24 de 24). |

### Ciclo 2: la planilla por chapeta que nadie podía leer

| | |
|---|---|
| **Observa** | En el caso 9 el arnés rechazó tres veces la salida por "formato inválido" y el reporte terminó en revisión humana. El extractor, con razón, se negó a inventar números internos: la planilla solo traía chapetas. |
| **Diagnostica** | Faltaron una **guía** y un **sensor**. Las instrucciones y la skill `leer-jornada-pesaje` (capítulos 1 y 2) no cubrían planillas por chapeta. El validador (capítulo 6) no sabía pasar de chapeta a animal. La regla "no busques números en el censo" dejaba el caso sin salida. |
| **Blinda** | El formato acepta filas con solo chapeta. El validador busca el animal en el censo por chapeta: si encuentra uno solo, lo asigna; si no encuentra ninguno o encuentra varios, deja la fila dudosa por V1 o V2. Se actualizaron la regla 3 de las instrucciones y el paso 2 de la skill ("deja `numero_interno` en null; no traduzcas chapetas"), y se agregó la prueba "Ciclo 2". |
| **Comprueba** | En una sesión nueva, el extractor procesó otra vez el caso 9: 5 válidos (0101 a 0105) al primer intento, sin reintentos, caso correcto. El número interno lo puso el censo, no el modelo. |

## 5. Otros hallazgos (mejora continua)

| Hallazgo | Cómo apareció | Qué se hizo |
|---|---|---|
| Las correcciones no decían de dónde salía el dato nuevo | La prueba de retomar: "¿de dónde salió el 215 de la 0303?" | `confirmar` exige `--motivo` en toda corrección o descarte |
| El mismo usuario podía enviar y confirmar su propio reporte | La prueba de retomar (caso 5) | Bloqueado en el CLI y en `campo.confirmar_borrador` (segregación de funciones) |
| El caso 9 era la misma jornada del caso 1, otra vez | El cargador lo frenó: "la 0101 ya tiene pesaje el 27/10" | Funcionó como estaba diseñado: no cargó nada a medias |
| Mi propio cargador no dejaba confirmar nada (el estado de la validación pisaba el estado `borrador`) | Primera prueba de guardarraíles | Corregido antes de las corridas |
| Dos reportes de la misma jornada (casos 3 y 6, 2 y 7) solo se detectan al cargar | La prueba de retomar | **Deuda:** avisar desde el validador si la jornada ya tiene un borrador |
| En la versión Claude Code no hay evento "pregunta enviada" | La prueba de retomar | Resuelto en n8n (nodo "Bitácora: preguntas enviadas"); en el CLI queda como deuda |

## 6. Métricas de la corrida mejorada

| Métrica | Valor |
|---|---|
| Registros propuestos | 62 (pesajes y eventos de los 9 casos) |
| Aceptados sin cambios por el validador | 54 (87 %) |
| Dudosos detectados | 7 (0209, 0303, dos de la 0302 y tres por fecha futura) |
| Ilegibles | 1 (fila borrosa del caso 4) |
| Errores graves que pasaron a la app | 0 |
| Guardarraíles probados que bloquearon | 9 de 9 en SQL (`supabase/prueba-pglite.txt`) y 10 de 10 en el CLI |

## 7. Prueba en vivo: Telegram + n8n + Supabase (2026-10-30)

Con el bot @santarita_campo_prueba_bot, n8n Cloud y la base de Supabase con datos simulados. Dos
cuentas de Telegram de prueba: quien envía (Andrés) y quien confirma (un compañero), en un grupo.

| Prueba | Qué pasó | Guardarraíl |
|---|---|---|
| Mensaje de una cuenta no autorizada | El bot no respondió; quedó `mensaje_ignorado` con el id | Remitentes autorizados |
| Caso 1 (foto) | 10 pesajes válidos, resumen con botones en segundos | Extractor + validador |
| Quien envió pulsa Confirmar | "Quien envió el reporte no puede confirmarlo" | Autoconfirmación (BD) |
| Caso 1 confirmado por otra persona | Se cargaron 10 pesajes | Carga solo con confirmación |
| Caso 1 enviado dos veces | El segundo se bloqueó: "La 0101 ya tiene pesaje el 2026-10-27" | Doble carga (BD) |
| Caso 2 en el grupo, Confirmar | "Quedan 1 dudosos sin resolver" (la 0209 no está en el censo) | Dudosos pendientes (BD) |
| Caso 2, Confirmar sin los dudosos | Se descartó la 0209 y se cargaron 7 pesajes | Descarte explícito, queda en la bitácora |

**Hallazgos de la prueba en vivo (mejora continua):**
1. Telegram admite un solo webhook por bot: con dos flujos, el segundo dejó al de los botones sin
   eventos y los botones no respondían. Se unieron en un solo flujo con el nodo "¿Es un botón?".
2. n8n entrega el error de Postgres como objeto, y el bot mostraba "object Object". Ahora se lee el
   mensaje real.
3. El resumen llega al chat donde se envió la foto, así que para que otra persona confirme hace falta
   un grupo (y desactivar la privacidad del bot en @BotFather).
