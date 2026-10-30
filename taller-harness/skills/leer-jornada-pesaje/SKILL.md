---
name: leer-jornada-pesaje
description: Convierte la foto de una planilla de báscula de Finca Santa Rita en registros de pesaje (número interno, peso, fecha). Úsala cuando el reporte sea una imagen o un texto con filas "número – peso".
---

# Leer una jornada de pesaje

## Cuándo se usa
- El administrador manda la foto de una planilla de la báscula o un texto con varias filas
  "número – peso".
- **No** se usa para vacunas ni tratamientos (eso es `leer-evento-sanidad`).

## Pasos
1. **Encabezado.** Busca la fecha escrita en la planilla y el lote. Escribe la fecha en
   formato `AAAA-MM-DD`. Si la planilla no tiene fecha, usa la fecha del mensaje y agrega una
   fila en `ilegibles` con el motivo "la planilla no tiene fecha; se usó la del mensaje".
2. **Fila por fila, de arriba abajo.** Para cada fila:
   - Copia el texto tal cual en `texto_original` (por ejemplo `"107 356"`).
   - Número interno a 4 dígitos (`107` → `"0107"`).
   - Peso en kilos como número. Coma decimal → punto (`372,5` → `372.5`).
   - Si la fila trae chapeta, cópiala en `chapeta`.
   - Si la columna de identificación es la **chapeta** (no el número interno), deja
     `numero_interno: null` y copia la chapeta completa como aparece. El validador encuentra el
     animal en el censo; tú no traduces chapetas a números.
3. **Cada dígito cuenta.** Si un dígito del número o del peso está tachado, borroso o tapado,
   la fila entera va a `ilegibles` con el motivo. No completes el dígito.
4. **Confianza:** `alta` si todo se lee perfecto; `media` si hay un trazo raro pero el valor es
   claro; nunca registres una fila con confianza `baja` (mándala a `ilegibles`).
5. **Filas repetidas:** transcríbelas las dos veces, tal como están. El validador decide.
6. **Cuenta al final:** número de filas de la planilla = registros + ilegibles. Si no
   cuadra, revisa qué fila te saltaste.

## Ejemplo
Ver el ejemplo A en `contexto/ejemplos/ejemplos.md`.
