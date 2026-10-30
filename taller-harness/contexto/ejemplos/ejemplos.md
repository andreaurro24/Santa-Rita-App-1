# Tres reportes ya resueltos

Sirven de referencia al extractor. Usan animales del censo de demostración.

## Ejemplo A: planilla de pesaje con una fila borrosa

**Mensaje del 2026-09-29** (foto de planilla). Lo que se ve en la foto:

```
JORNADA DE PESAJE — LOTE-2026-A — Fecha: 28/09/2026
N°     Peso (kg)
201    241
202    239
2?3    27?        ← tachón de lapicero
204    270
```

**Salida correcta:**

```json
{
  "tipo_reporte": "pesaje",
  "fecha_reporte": "2026-09-28",
  "lote": "LOTE-2026-A",
  "registros": [
    { "numero_interno": "0201", "chapeta": null, "alcance_lote": null, "peso_kg": 241, "evento_sanitario": null, "confianza": "alta", "texto_original": "201 241" },
    { "numero_interno": "0202", "chapeta": null, "alcance_lote": null, "peso_kg": 239, "evento_sanitario": null, "confianza": "alta", "texto_original": "202 239" },
    { "numero_interno": "0204", "chapeta": null, "alcance_lote": null, "peso_kg": 270, "evento_sanitario": null, "confianza": "alta", "texto_original": "204 270" }
  ],
  "ilegibles": [
    { "texto_original": "2?3 27?", "motivo": "tachón: no se lee el segundo dígito del número ni el último del peso" }
  ]
}
```

Por qué: la fecha es la de la planilla (28/09), no la del mensaje (29/09). La fila del tachón
no se completa con "0203" aunque sea el único número del censo que encaja.

## Ejemplo B: evento sanitario para todo un lote

**Mensaje del 2026-09-15:** "hoy purgamos con ivermectina a todo el lote 2026-B".

```json
{
  "tipo_reporte": "sanidad",
  "fecha_reporte": "2026-09-15",
  "lote": "LOTE-2026-B",
  "registros": [
    { "numero_interno": null, "chapeta": null, "alcance_lote": "LOTE-2026-B", "peso_kg": null,
      "evento_sanitario": { "tipo": "desparasitacion", "descripcion": "Ivermectina" },
      "confianza": "alta", "texto_original": "hoy purgamos con ivermectina a todo el lote 2026-B" }
  ],
  "ilegibles": []
}
```

Por qué: "purgar" es desparasitación (glosario). Un solo registro con `alcance_lote`; el
validador lo expande a los 6 animales del lote.

## Ejemplo C: mensaje que no es un reporte

**Mensaje del 2026-09-20:** "¿a cómo está el kilo en Valledupar? ¿vendemos el lote B?"

```json
{ "tipo_reporte": "otro", "fecha_reporte": "2026-09-20", "lote": null, "registros": [], "ilegibles": [] }
```

Por qué: precios y ventas están fuera del trabajo del agente. El arnés le responde al
administrador que use la app para eso.
