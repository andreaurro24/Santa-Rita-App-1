# Taller Harness Engineering: reportes de campo → registros

Arnés de un agente que convierte la foto de la planilla de la báscula o un mensaje de campo en
registros de pesaje y sanidad para la app de Finca Santa Rita. Ningún dato llega a la app sin que
una persona lo confirme. Todo usa datos ficticios: nunca datos de Miguel Ángel.

## Entregables (`entrega/`)
| Entregable | Archivo |
|---|---|
| Canvas del arnés con la justificación de cada decisión | [entrega/canvas.md](entrega/canvas.md) |
| Bitácora de pruebas: casos, comparación y dos ciclos | [entrega/bitacora-pruebas.md](entrega/bitacora-pruebas.md) |
| Reflexión (tres preguntas) | [entrega/reflexion.md](entrega/reflexion.md) |
| Presentación de 5 minutos (con notas del orador) | [entrega/presentacion.pptx](entrega/presentacion.pptx) |
| Versión funcional: textos de instrucciones, skills y validador | `contexto/`, `skills/`, `arnes/` |
| Plan por sprints | [SPRINTS.md](SPRINTS.md) |

## Mapa
| Carpeta | Qué hay | Capítulo |
|---|---|---|
| `contexto/` | Instrucciones (una página), glosario, reglas V1 a V10, censo de demostración, formato JSON y ejemplos | 1. Contexto |
| `skills/` | `leer-jornada-pesaje`, `leer-evento-sanidad` y `explicar-dudoso` | 2. Herramientas y skills |
| `memoria/` | Borradores con estado, bitácora y base de demostración | 3. Memoria |
| `arnes/` | Orquestación, validador, calificador, CLI y pruebas | 4, 5 y 6 |
| `../.claude/agents/` | Subagentes `extractor-campo` y `revisor-campo` (solo lectura) | 4. Orquestación |
| `supabase/` | SQL con rol sin escritura, RLS y funciones de confirmación y carga, más su prueba | 5. Guardarraíles |
| `casos/` | 9 casos con la respuesta correcta (las fotos se generan con un script) | 6. Verificación |
| `corridas/` | Salidas reales de las tres etapas: sin arnés, con arnés y mejorado | 7. Mejora continua |
| `n8n/` | Flujos de Telegram listos para importar y guía de conexión | Plataforma |
| `scripts/` | Generadores del censo, las planillas, los flujos de n8n y la presentación | |

## Comandos (desde la raíz del repo)
```
node --test "taller-harness/arnes/*.test.mjs"        # 24 pruebas del validador
node taller-harness/arnes/arnes.mjs estado            # retomar: estado de cada reporte
node taller-harness/scripts/generar-n8n.mjs           # regenerar los flujos tras cambiar guías o reglas
python -I taller-harness/scripts/generar-planillas.py # regenerar las fotos de los casos
```
El paso a paso de un reporte está en [arnes/ORQUESTACION.md](arnes/ORQUESTACION.md). La conexión
con Telegram está en [n8n/README.md](n8n/README.md).

## Lo que falta y solo puede hacer el equipo
1. Crear el bot en @BotFather y la cuenta de n8n, y pegar el token y la llave de Claude en las
   credenciales de n8n.
2. El SQL ya está aplicado (2026-10-30) en el proyecto `fixnszbgrsglwftqjkky`. Falta ponerle clave
   al rol `arnes_campo` y registrar los ids de Telegram (pasos 1.2 y 1.3 de `n8n/README.md`).
3. Probar los casos por Telegram y tomar las capturas para la entrega.
