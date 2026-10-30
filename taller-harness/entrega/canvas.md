# Canvas del arnés: reportes de campo → registros

**Proyecto:** Finca Santa Rita (Badillo, Cesar) · **Equipo:** Andrea Urdaneta, Juan Andrés Lacouture, Andrés Sánchez
**Agente:** convierte la foto de la planilla de la báscula o un mensaje de campo en registros de
pesaje y sanidad, los revisa contra el censo y las reglas de la finca, y los deja como borrador
hasta que una persona los confirma.

> La app de la finca no usa IA: su recomendación de venta funciona con reglas. El agente es una
> pieza nueva que la alimenta con datos de campo, no la reemplaza.

## Tema central

| Pregunta | Respuesta |
|---|---|
| **El trabajo** | Pasar los reportes de campo (fotos de planillas, mensajes) a registros de pesaje y sanidad. Para el administrador, que envía, y para Miguel Ángel, que confirma. En cada jornada de pesaje (mensual, unas 140 reses) y en cada evento de sanidad. |
| **Entradas** | Foto de la planilla o mensaje de texto, la fecha del mensaje y el censo (número interno, chapeta, lote, potrero, ingreso y último peso). |
| **Salida** | Un borrador con tres listas: válidos (listos para cargar), dudosos con su motivo y su pregunta, e ilegibles. |
| **"Terminado" significa** | 1. Cada animal existe en el censo y está activo. 2. Ninguna fecha es futura ni anterior al ingreso del animal (RN-14). 3. Todo peso que cambie más del 15 % frente al último queda dudoso (RN-01). 4. Ningún animal aparece dos veces en la misma jornada (RN-15). 5. Nada inventado: todo valor aparece en el texto leído; lo que no se lee queda como ilegible. |
| **Peor error y su costo** | Asignar un peso a la res equivocada o inventarlo. Daña el historial y la GDP, y por esa vía la recomendación de venta. En la última venta la finca perdió cerca del 10 % del valor (unos $1.200 por kilo). |

## Los siete capítulos

Prioridad según el riesgo: invertimos más en **Guardarraíles, Verificación y Contexto**, porque
el peor error es un dato malo que llega a la app. Invertimos menos en Orquestación, que se
mantuvo simple: un solo extractor, un revisor y pasos fijos.

| Capítulo | Tipo | Nuestro diseño (construido) | Por qué así |
|---|---|---|---|
| **1. Contexto** (más inversión) | Guía | `contexto/instrucciones.md` (una página, 7 reglas de oro), `glosario.md` (chapeta, número interno, lote, potrero, purga…), `censo-demo.json` (24 animales con su último peso), `reglas.md` (V1 a V10) y 3 ejemplos resueltos. | La línea base mostró que la IA sola lee muy bien, pero no sabe si la 0209 existe, cuánto pesó la 0303 el mes pasado ni qué animales tiene el lote 2026-B. Eso lo da el contexto. |
| **2. Herramientas y skills** | Guía | Skills: `leer-jornada-pesaje`, `leer-evento-sanidad` y `explicar-dudoso` (nombre, cuándo se usa, pasos, ejemplo). Herramientas: el extractor solo puede leer, el validador escribe borradores y bitácora, y el cargador es lo único que llega a las tablas de la app. | Las skills convierten el procedimiento de la finca en recetas repetibles. Cada pieza tiene solo la herramienta que necesita. |
| **3. Memoria** | Memoria | Borradores con estado (`borrador → confirmado/rechazado → cargado`), `bitacora_jornadas` con cada evento (mensajes ignorados, reintentos, correcciones con motivo, bloqueos) y el comando `arnes.mjs estado`. En Telegram: tablas `campo.borradores_campo` y `campo.bitacora_jornadas`. | Probado: un agente nuevo, sin explicación, reconstruyó el estado de los 9 reportes y lo que había que preguntar. |
| **4. Orquestación** | Guía | 1) Extractor (IA) → 2) Validador (programa) → 3) Revisor (otra IA, solo si hay dudas) → 4) Persona confirma → 5) Cargador (programa). | Quien extrae no se califica a sí mismo. El revisor solo actúa donde hay riesgo, para no gastar de más. |
| **5. Guardarraíles** (más inversión) | Límite | **Guardias reales, fuera del modelo:** el rol `arnes_campo` de Postgres no tiene permiso sobre `pesajes` ni `eventos_sanitarios`; solo puede crear borradores. La única puerta es `campo.cargar_borrador()`, que exige un borrador confirmado por un usuario de `telegram_autorizados`. Quien envía no se confirma a sí mismo. No se confirma con dudosos pendientes. No se carga dos veces la misma jornada. El bot ignora chats no autorizados. Máximo 2 reintentos y después una persona. **Guías (texto):** no tocar ventas, precios ni "Al partir", y no inventar. | El enunciado lo dice: en un chat, una regla escrita es una guía, no una guardia. Por eso lo grave quedó en permisos y funciones de la base de datos, que el modelo no puede saltarse. Probado: 9 de 9 bloqueos en SQL y 10 de 10 en el CLI. |
| **6. Verificación** (más inversión) | Sensor | **Programa:** `arnes/validador.mjs` con V1 a V10 (censo, chapeta, fechas, 15 %, duplicados, rango, "el valor aparece en el texto leído", tipo sanitario, expansión del lote con el censo) y 24 pruebas automáticas. **Casos:** 9 con la respuesta conocida y `calificar.mjs`. **IA:** el revisor juzga solo lo ambiguo (¿348 o 368?). | Lo verificable con reglas se verifica con reglas, y la IA juzga solo lo que una regla no puede. Meta cumplida: 0 pesos inventados y 100 % de los cargados existen en el censo. |
| **7. Mejora continua** | Sensor | Cada corrección queda con quién la hizo y su motivo. Métricas por corrida (aceptados sin cambios, dudosos, reintentos, errores graves). Ciclo Observa → Diagnostica → Blinda → Comprueba aplicado dos veces, más los hallazgos de la prueba de retomar. | Así se encontró, por ejemplo, que la regla de duplicados no servía para sanidad y que faltaba guardar de dónde salía cada corrección. |

## Dónde participa el humano

| Persona | Qué hace | Por qué |
|---|---|---|
| Administrador | Envía el reporte y responde las preguntas del revisor | Es quien estuvo en la báscula |
| Miguel Ángel (o un confirmador autorizado distinto de quien envió) | Confirma, corrige con motivo o rechaza cada borrador | Es el dueño del dato y de la decisión de venta |
| Equipo | Revisa la bitácora y los errores repetidos, y ajusta reglas, skills o ejemplos | El arnés crece con los errores |

## Plataforma elegida

Dos versiones del mismo arnés, con el mismo validador y las mismas instrucciones:

1. **Claude Code (funcional y probada):** subagentes `extractor-campo` y `revisor-campo` de solo
   lectura, validador y cargador en Node, y memoria en archivos. Con ella se corrieron los 9 casos.
2. **Telegram + n8n + Supabase (lista para conectar):** el canal que usaría la finca. Los flujos
   `n8n/procesar-reporte.json` y `confirmar-borrador.json` se generan desde las mismas piezas, y el
   SQL con roles, RLS y funciones se probó en un Postgres embebido. Falta que el equipo cree el bot,
   la cuenta de n8n y pegue las llaves (ver `n8n/README.md`).

**Por qué así:** el enunciado acepta Claude Code ("agentes de programación"), y nos dejó probar
todo sin depender de cuentas externas. Telegram es lo que el administrador ya usa en la finca.
