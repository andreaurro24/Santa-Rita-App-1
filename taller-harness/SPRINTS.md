# Taller Harness Engineering: plan por sprints

Base: `Plan-Taller-Harness-Santa-Rita.md` (el plan del equipo) y el enunciado del taller.
Los sprints van ordenados por dependencia y por esfuerzo. La talla es relativa:
**S** = unas horas, **M** = medio día, **L** = un día o más, o depende de terceros.

| Sprint | Objetivo | Talla | Depende de | Quién |
|---|---|---|---|---|
| T1 | Contexto y skills (las guías) | S | nada | Claude |
| T2 | Casos de prueba y validador (los sensores fijos) | M | T1 | Claude |
| T3 | Arnés ejecutable en Claude Code (extractor, validador, revisor, memoria, confirmación, carga) | M | T1, T2 | Claude |
| T4 | Ciclo de dirección: línea base, con arnés, dos ciclos de mejora | M | T3 | Claude |
| T5 | Canal Telegram + n8n + Supabase | L | T3 | Claude prepara, el equipo conecta credenciales |
| T6 | Entregables: canvas final, bitácora, reflexión y presentación | S | T4 | Claude, revisión del equipo |

## Por qué este orden

- **T1 y T2 primero:** son la base del arnés y no necesitan cuentas ni credenciales.
- **T3 antes que T5:** el enunciado acepta Claude Code como plataforma ("agentes de
  programación"). Así la versión funcional y las pruebas no dependen de que el bot de
  Telegram esté listo. T5 lleva el mismo arnés al canal que usaría la finca de verdad.
- **T5 es la talla L** porque depende de tres pasos que solo puede hacer una persona del
  equipo: crear el bot en @BotFather, crear la cuenta de n8n y pegar las llaves (el token
  del bot y la llave del modelo) en las credenciales de n8n. Claude no escribe llaves ni
  crea cuentas.

## T1: Contexto y skills (S)
- [x] Censo de demostración (24 animales ficticios, 3 lotes) → `contexto/censo-demo.json`
- [x] Glosario de la finca → `contexto/glosario.md`
- [x] Reglas que aplica el agente → `contexto/reglas.md`
- [x] Instrucciones principales (máximo una página) → `contexto/instrucciones.md`
- [x] Formato de salida fijo → `contexto/borrador.schema.json`
- [x] Tres ejemplos resueltos → `contexto/ejemplos/`
- [x] Skills `leer-jornada-pesaje`, `leer-evento-sanidad` y `explicar-dudoso` → `skills/`

## T2: Casos de prueba y validador (M)
- [x] Nueve casos con la respuesta correcta conocida: 6 base, 1 extra y 2 exploratorios (planillas generadas como imagen) → `casos/`
- [x] Validador con reglas fijas → `arnes/validador.mjs`
- [x] Pruebas del validador → `arnes/validador.test.mjs` (`node --test "taller-harness/arnes/*.test.mjs"`, 24 pruebas)

## T3: Arnés ejecutable en Claude Code (M)
- [x] Extractor (subagente solo lectura) y revisor (subagente distinto) → `.claude/agents/extractor-campo.md` y `revisor-campo.md`
- [x] Orquestador: extraer → validar → revisar → borrador → confirmar → cargar → `arnes/arnes.mjs` y `arnes/ORQUESTACION.md`
- [x] Memoria: `memoria/bitacora_jornadas.jsonl` y `memoria/borradores/`
- [x] Guardarraíl: el cargador se niega sin confirmación humana de un usuario autorizado

## T4: Ciclo de dirección (M)
- [x] Línea base sin arnés sobre los casos 1 a 7 → `corridas/linea-base/`
- [x] Con arnés sobre los 9 casos → `corridas/con-arnes/`
- [x] Con arnés mejorado sobre los 9 casos, en sesiones nuevas → `corridas/mejorado/`
- [x] Prueba de retomar en una sesión nueva (y dos hallazgos corregidos)
- [x] Dos ciclos Observa → Diagnostica → Blinda → Comprueba, comprobados en sesión nueva
- [x] Tabla de comparación → `entrega/bitacora-pruebas.md`

## T5: Canal Telegram + n8n + Supabase (L)
- [x] SQL de las tablas `borradores_campo` y `bitacora_jornadas`, rol sin escritura y funciones de confirmación y carga → `supabase/` (probado en PGlite: 9 de 9 bloqueos)
- [x] Flujos de n8n importables (`procesar-reporte`, `confirmar-borrador`) y guía de conexión → `n8n/` (sin probar en vivo)
- [x] Bot creado en @BotFather: @santarita_campo_prueba_bot
- [ ] **Equipo:** crear la cuenta de n8n y pegar el token del bot y la llave del modelo en sus credenciales
- [x] SQL aplicado el 2026-10-30 en el proyecto nuevo `fixnszbgrsglwftqjkky` (org Andresitow), junto con las 20 migraciones de la app; la org GuardIA se borró
- [ ] **Equipo:** ponerle clave al rol `arnes_campo` y registrar los ids de Telegram autorizados
- [ ] Probar los casos por Telegram y tomar las capturas

## T6: Entregables (S)
- [x] Canvas final con justificación → `entrega/canvas.md`
- [x] Bitácora de pruebas → `entrega/bitacora-pruebas.md`
- [x] Reflexión → `entrega/reflexion.md`
- [x] Presentación de 5 minutos → `entrega/presentacion.pptx`
