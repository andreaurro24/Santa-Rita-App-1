# Verificación bug "Confirmar venta tapado por el panel" (sin spec) — APROBADO

Cambio verificado (git diff sin commit): `src/pages/Ventas.jsx:423-425`. La fila de botones del
formulario del simulador pasó de `md:col-span-2` a `md:col-start-1`.
Fecha: 2026-10-06. Entorno: servidor de desarrollo en http://localhost:5173 contra la BD de
**producción**, que hoy tiene datos ficticios de demostración. Solo lectura: en todas mis pruebas
corrió un `page.route` que **abortaba cualquier POST/PATCH/PUT/DELETE** a `/rest/v1` y `/storage/v1`.
No se bloqueó ninguna petición porque no hubo ningún intento de escritura. Nunca se pulsó "Guardar venta".
Lo único que se llenó fue el campo Comprador, que vive en el estado local del formulario.

## Escalera
| Nivel | Resultado | Evidencia |
|---|---|---|
| 1 Estático | OK | `npm run lint`: código de salida 0, solo 4 avisos previos (AuthContext, main.jsx y una variable sin usar en un e2e), ninguno en Ventas.jsx. `npm run build`: `✓ built in 772ms` |
| 2 Unitarias | OK | `npm test`: 17 archivos, 199/199 pruebas. El cambio es de CSS, así que no hay lógica que probar con unitarias |
| 3 E2E | NO APLICA (a propósito) | La suite E2E está bloqueada contra producción y el encargo prohíbe correrla. En su lugar usé scripts Playwright de solo lectura en el scratchpad, con un usuario temporal de demostración y la sesión inyectada (los mismos de `revisar-boton.mjs`) |
| 4 Revisión crítica | OK | Ver abajo |
| 5 Consola y red | OK | 0 errores de consola, 0 `pageerror`, 0 respuestas HTTP ≥ 400 en todas las corridas |

## Comprobación del bug y del arreglo
1. **Script de quien lo arregló** (`revisar-boton.mjs`), repetido por mí: `clicable:true` en 1280x720,
   1366x768, 1440x810, 1920x1080 y 390x844. Confirmado.
2. **Bug reproducido en el maquetado anterior**: para simular el `col-span-2` anterior inyecté
   `style.gridColumn = '1 / -1'` en la fila de botones, sin tocar `src/`. Luego barrí todo el scroll
   en pasos de 25 px y conté en cuántas posiciones el centro del botón quedaba bajo `form > aside`:

   | Viewport | Antes (1 animal / todos) | Después |
   |---|---|---|
   | 1280x720 | tapado 5/5 y 5/5 (vacío: 3/4) | 0 |
   | 1366x768 | 4/5 y 4/5 | 0 |
   | 1440x810 | 2/4 y 2/4 | 0 |
   | 1024x768 | 4/5 y 4/5 | 0 |
   | 1920x1080 | 0 | 0 |

   El arreglo también corrige 1024x768, un tamaño que no estaba en el reporte original.
3. **Pasos 2 y 3 en escritorio** (1280, 1366, 1440, 1920 y 1024): "Atrás" y "Siguiente" o "Guardar venta"
   quedan clicables, no se solapan con el panel (`solapaAside:false`) y no hay desbordamiento horizontal
   (`scrollWidth - innerWidth = 0`). "Atrás" queda a la izquierda y la acción principal al borde derecho
   de la columna izquierda (captura de 1366, paso 3: "Guardar venta" en x=734–911 y el panel desde
   x≈934). "Guardar venta" se habilita a los 800 ms, como antes.
4. **Celular (390x844 y 375x812, con `isMobile`/táctil)**: la fila tiene `grid-column: auto`, así que la
   clase `md:` no aplica y el celular no cambia. Con animales marcados, el "Confirmar venta" del
   formulario está oculto (`max-md:hidden`) y el de la barra fija inferior es clicable en el 100 % de las
   posiciones del barrido (56–60 de 56–60). Al final de la página, Cancelar, Atrás, Siguiente y
   Guardar venta son clicables. Al tocar el botón de la barra se avanza al paso 2.
   Las ocultaciones parciales que da el barrido en el celular (3–6 posiciones) vienen de la barra o el
   menú inferior fijos mientras se desplaza la página, nunca del panel (`porAside: 0`). Es el
   comportamiento esperado de una barra fija.

## Hallazgos (de mayor a menor severidad)

### [Medio, previo, fuera del alcance] Simulador inutilizable entre 768 y ~1000 px (tableta o ventana estrecha)
- Dónde: `src/pages/Ventas.jsx:332`. La grilla `md:grid-cols-[minmax(0,1fr)_22rem]` se activa a
  768 px, cuando ya hay menú lateral de 240 px (`Layout.jsx:41`).
- Reproducir: viewport 768x1024 en `#/ventas/nueva`. La columna izquierda mide **8 px** a 768, 40 px a
  800, 100 px a 860, 140 px a 900 y 240 px a 1000. Las tarjetas de lote y el formulario "Datos de la
  venta" quedan comprimidos y el panel los tapa: con Playwright, un `check()` sobre "Vender el lote
  Levante" falló porque `<aside class="md:sticky md:top-6"> … intercepts pointer events`.
- Esperado vs. obtenido: el contenido debería ser legible y operable. Hoy no se puede elegir lotes con
  el ratón a 768 px.
- Relación con este arreglo: **no lo causa**. La fila 1 no cambió y el mismo problema existe con el
  maquetado anterior. Lo que sí cambia es que, en esa franja, la fila de botones hereda el ancho
  diminuto de la columna 1: los botones se apilan alineados a la izquierda (Atrás encima de
  Siguiente) y desbordan su fila. Aun así, siguen clicables en todas las posiciones del barrido (0
  tapados en 768, 800, 860, 900, 960, 1000 y 1024). Con el `col-span-2` anterior, el botón quedaba
  entero bajo el panel en el eje horizontal. Así que, para los botones, no es una regresión.
- Por qué importa: si Miguel abre la app en una tableta vertical o en una ventana partida, no puede
  simular la venta. Conviene una spec o bug aparte (por ejemplo, activar las dos columnas desde `lg:`).

### [Bajo] Cambio visual en 1024 px
- En 1024x768, Cancelar y Confirmar venta ahora se apilan a la izquierda, porque la columna 1 mide unos
  322 px. Antes iban a lados opuestos, pero Confirmar quedaba tapado. Es solo estético y es preferible
  a lo anterior.

## Sospechas no confirmadas
- Ninguna sobre el arreglo.

## Lo que no se verificó y por qué
- No se confirmó ni se guardó ninguna venta: es producción y está prohibido. Que "Guardar venta" reciba
  el clic se comprobó con `elementFromPoint` y no pulsándolo.
- No se corrió la suite E2E (`npm run test:e2e`) porque está bloqueada contra producción a propósito.
- Solo se probó en Chrome (Playwright `channel: 'chrome'`), no en Safari iOS ni Firefox. El cambio es
  CSS Grid estándar, así que el riesgo es bajo.
- Las capturas y scripts de esta verificación quedaron en el scratchpad de la sesión, no en el repo.

## Veredicto
**APROBADO** para este arreglo. Resuelve el bug en 1280x720, 1366x768 y 1440x810 (y también en
1024x768), no cambia el celular, los pasos 2 y 3 siguen bien ubicados y no hay errores de consola ni de
red. El problema de la franja 768–1000 px es previo y queda como deuda para tratarlo aparte.
