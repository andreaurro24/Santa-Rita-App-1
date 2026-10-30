# Orquestación del arnés (versión Claude Code)

Cinco pasos. Los pasos de IA y los pasos fijos están separados: **quien extrae no se califica a
sí mismo** y **nada llega a la app sin una persona**.

| # | Paso | Tipo | Quién lo hace | Puede escribir |
|---|---|---|---|---|
| 1 | Extractor | IA | subagente `extractor-campo` (`.claude/agents/`, herramientas: solo `Read`) | Nada: devuelve JSON |
| 2 | Validador | Programa | `arnes.mjs validar` (reglas V1 a V10 de `contexto/reglas.md`) | Borradores y bitácora |
| 3 | Revisor | IA, solo si hay dudosos o ilegibles | subagente `revisor-campo` (solo `Read`), distinto del extractor | Nada: devuelve JSON |
| 4 | Confirmación | Humano | `arnes.mjs confirmar` / `rechazar` (usuario de `pueden_confirmar`, distinto de quien envió) | Estado del borrador |
| 5 | Cargador | Programa | `arnes.mjs cargar` (solo borradores confirmados) | `memoria/base-demo.json` (en Telegram: `campo.cargar_borrador` en Supabase) |

## Cómo procesar un reporte

1. **Extraer.** En Claude Code: *"Usa el subagente extractor-campo con el reporte
   `casos/caso-3/planilla.jpg`, fecha del mensaje 2026-10-28"*. Guarda su JSON en un archivo.
2. **Validar.**
   ```
   node taller-harness/arnes/arnes.mjs validar --extraccion <json> --fecha-mensaje 2026-10-28 --de administrador [--caso caso-3]
   ```
   - Código 2: el formato no sirve. Reintenta el extractor pasándole los errores, con `--intento 2`.
   - Código 4: van 2 reintentos. Pasa a revisión humana; no se reintenta más.
   - Código 3: el remitente no está autorizado. Se ignora y queda en la bitácora.
3. **Revisar** (solo si hay dudosos o ilegibles). *"Usa el subagente revisor-campo con el borrador
   `memoria/borradores/<id>.json` y la imagen original"*. Guarda su JSON y:
   ```
   node taller-harness/arnes/arnes.mjs revision --id <id> --archivo <json>
   ```
4. **Confirmar.** Lo hace una persona, después de leer las preguntas del revisor:
   ```
   node taller-harness/arnes/arnes.mjs confirmar --id <id> --por miguel [--corregir 0303=215] [--descartar 0209] --motivo "<de dónde salió el dato>"
   node taller-harness/arnes/arnes.mjs rechazar --id <id> --por miguel --motivo "<por qué>"
   ```
5. **Cargar.**
   ```
   node taller-harness/arnes/arnes.mjs cargar --id <id>
   ```

**Para retomar en otra sesión:** `node taller-harness/arnes/arnes.mjs estado` y
`memoria/bitacora_jornadas.jsonl`. No hace falta explicar nada más.

## Nota sobre los subagentes

Claude Code registra los agentes de `.claude/agents/` al abrir la sesión. En la sesión en que se
crearon, el extractor y el revisor corrieron como subagentes generales que leían esa definición y
tenían la orden de usar solo `Read`. En una sesión nueva quedan registrados con `tools: Read` y el
límite lo aplica Claude Code, ya no depende de la instrucción.
