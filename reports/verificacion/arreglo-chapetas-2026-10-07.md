# Verificación del arreglo visual de chapetas, pesos y pies de diálogo (sin spec), ronda 2: APROBADO

Ronda 2 sobre el mismo diff sin commit (base `5c4fb29`). Lo único que cambió frente a la ronda 1 es `src/pages/Lotes.jsx:143-153`:
- La grilla de animales pasa a `grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]`.
- La finca va debajo de la chapeta y sin `truncate`.
- El peso queda a la derecha con `whitespace-nowrap`.

**Veredicto:** M1 quedó resuelto. Se ve "Finca Santa Rita" completo, en una línea, en los 4 animales a 375, 390, 1280 y 1440 px. Ninguna chapeta ni ningún peso se parte y no hay desborde. El barrido de regresión da las mismas mediciones que en la ronda 1. Queda un hallazgo nuevo de severidad Media, M2: la grilla de 16rem se desborda en pantallas de 320 px. No bloquea porque está fuera de los anchos pedidos, pero conviene corregirlo antes de publicar.

**Condición del APROBADO:** `npm run test:e2e` sigue sin correr. La suite escribe en la base, la única disponible es la de producción y la regla de esta verificación es solo lectura (DT-05-1). El nivel 3 se cubrió con el recorrido Playwright de solo lectura. Para un cambio que solo toca clases CSS, lo considero suficiente; si el humano no lo acepta, el veredicto pasa a BLOQUEADO solo por E2E, como en los informes del sprint 06.

**Datos:** no se escribió nada. Las escrituras a `/rest/v1` y `/storage/v1` estaban abortadas en el navegador de prueba y el contador de bloqueadas dio 0. Solo se abrieron diálogos, que se cerraron con Cancelar o con "Seguir pesando".

## Escalera (ronda 2)
| Nivel | Resultado | Evidencia |
|---|---|---|
| 1 Estático | OK | `npm run lint`: exit 0, 0 errores y los mismos 4 avisos. `npm run build`: ✓ built in 578 ms |
| 2 Unitarias | OK | `npm test`: 17 archivos, 199 pruebas pasan |
| 3 E2E | OK solo lectura / la suite no se corrió | `verificar.mjs`: 68 mediciones (17 pantallas y diálogos × 375, 390, 1280 y 1440) más 8 de la jornada abierta simulada. `lote-r2.mjs`: lista del lote a 320, 360, 375, 390, 768, 1024, 1280 y 1440. `npm run test:e2e` no se corrió (ver la condición de arriba) |
| 4 Revisión crítica | 1 Medio nuevo (M2) | Ver abajo |
| 5 Consola y red | OK | 0 errores de consola y 0 respuestas HTTP ≥ 400 en todas las corridas |

## Detalle del lote (`#/lotes/9b03a289-5fbc-561d-98a0-f58dc3364cb1`)
| Ancho | Columnas | Ancho de fila | Finca | Chapeta / peso partidos | Desborde |
|---|---|---|---|---|---|
| 375 | 1 | 301 px | Completa, 1 línea, 4/4 | 0 / 0 | No (`scrollWidth` 375) |
| 390 | 1 | 316 px | Completa, 1 línea, 4/4 | 0 / 0 | No (390) |
| 1280 | 3 | 291 px | Completa, 1 línea, 4/4 | 0 / 0 | No (1280) |
| 1440 | 3 | 344 px | Completa, 1 línea, 4/4 | 0 / 0 | No (1440) |
| 768 / 1024 (extra) | 1 / 2 | 379 / 313 px | Completa 4/4 | 0 / 0 | No |
| 360 (extra) | 1 | 288 px en una lista de 286 | Completa 4/4 | 0 / 0 | La fila sobresale 2 px de la lista, dentro del relleno de la tarjeta. La página no se desplaza de lado |
| **320 (extra)** | 1 | **288 px en una lista de 246** | Completa 4/4 | 0 / 0 | **Sí**: `scrollWidth` 325, ver M2 |

Además: el peso nunca se monta sobre la chapeta ni sobre la finca, y los diálogos Editar lote y Mover seleccionados conservan el pie bien (dos botones en una línea, pie visible).

Capturas: `r2-375-lote.png`, `r2-390-lote.png`, `r2-1280-lote.png`, `r2-1440-lote.png`, `r2-lista-lote-{320,375,390,1280,1440}.png` y `r2-lote-320-viewport.png`.

## Regresión del resto
Las pantallas Inicio, Animales, ficha, Pesaje, jornada cerrada, jornada abierta simulada, contrato de Al partir, Ventas, detalle de venta, Simular venta y Gastos, y los diálogos Registrar peso, Editar lote, Mover, Asignar, Registrar visita, Anotar gasto y Cerrar jornada (simulado), dan **exactamente** las mismas mediciones que en la ronda 1. En los 4 anchos no hay chapetas ni pesos partidos, el pie se ve entero y sus botones ocupan una línea. Tampoco hay desborde horizontal. Las únicas marcas que salen son las mismas de la línea base de Vercel: B1, B2 y las tarjetas de varias líneas, que son así a propósito.

## Hallazgos de la ronda 2

### [Medio] M2: la lista del lote se desborda en celulares de 320 px (regresión de la ronda 2)
- **Dónde:** `src/pages/Lotes.jsx:143`, `minmax(16rem,1fr)`. La raíz de la app usa `font-size: 18px`, así que 16rem son **288 px**, no 256.
- **Reproducir:** viewport de 320×640 en el detalle del lote, `node arreglo-chapetas-capturas/lote-r2.mjs`.
- **Esperado:** que la fila se encoja al ancho de la tarjeta. **Obtenido:**
  - La pista mide 288 px y la lista 246 px. La fila termina en x = 325, cuando la tarjeta termina en 302 y la ventana en 320.
  - El borde derecho de las filas queda cortado y la página se desplaza 5 px de lado (`r2-lote-320-viewport.png`).
  - A 360 px la fila sobresale 2 px de la lista, sin que se note.
  - En la ronda 1 (`grid-cols-1`) eso no pasaba.
- **Por qué importa:** 375 px es el ancho de diseño y ahí está bien. Pero un celular pequeño o con letra grande vería la lista cortada y la pantalla corriéndose de lado al pasar el dedo. Las otras grillas del arreglo (12rem = 216 px y 11rem = 198 px) caben a 320 px. Pista, sin corregirlo yo: un mínimo que no supere el ancho disponible, p. ej. `minmax(min(16rem,100%),1fr)`.

## Deuda anotada (fuera de este arreglo, ya pasaba antes y no está en el diff)
- **B1 (Bajo):** en `#/animales`, a 375 y 390 px, "Paloma-007" se ve como "Palo…" (61/118 px a 375).
- **B2 (Bajo):** el botón "Editar lotes" se parte en dos líneas en `#/animales` a 375 px.
- **B3 (Bajo):** en el diálogo Asignar animales (`AlPartir.jsx:480`) la lista va a una columna en celular y se ven unas 4 chapetas y media en vez de 8.
- **Sospecha:** "Buscar por nombre" en Asignar usa `inputMode="numeric"` (`AlPartir.jsx:478`).

Hay que registrarlos en la deuda del sprint (skill `sprint`). Esa decisión es del coordinador; el verificador no edita `sprints/`.

## Lo que no se verificó (ronda 2)
- `npm run test:e2e`: falta un proyecto de Supabase de pruebas (DT-05-1).
- Un celular físico: todo se midió en Chrome con viewport emulado.
- "Guardar igual" y la jornada abierta real, porque los dos escriben en la base. La jornada abierta se simuló reescribiendo la respuesta solo en el navegador de prueba.

---

# Ronda 1 (historial): RECHAZADO

Diff verificado: el que está sin commit sobre `5c4fb29` en `Chapeta.jsx`, `Modal.jsx`, `Pesaje.jsx`, `Lotes.jsx`, `AlPartir.jsx`, `Dashboard.jsx` y `Ventas.jsx` (29 líneas añadidas y 19 quitadas). La app local (`http://localhost:5173`) se comparó con la desplegada en Vercel, que sirve de línea base porque todavía no tiene el arreglo. Las dos apuntan a la misma base de datos.

**Motivo del rechazo:** cuatro de los cinco problemas quedaron resueltos y no hay regresiones. El quinto, la finca recortada en el detalle del lote, solo mejoró: el nombre sigue saliendo cortado con "…" a 375 px (2 de 4 animales), a 390 px (1 de 4) y a 1280 px (los 4). Lo demás está bien. Con ese ajuste, una ronda 2 debería salir APROBADA.

**Datos:** no se escribió nada. El navegador de prueba **abortaba** cualquier POST, PATCH, PUT o DELETE a `/rest/v1` y `/storage/v1`, salvo `object/sign`, que solo firma la URL de lectura de una foto. Contador de peticiones bloqueadas: 0, o sea que la app no intentó escribir. Los diálogos se cerraron con Cancelar o con "Seguir pesando". No se imprimieron credenciales: la sesión se inyectó con `sesion()` de `toma.mjs`.

## Escalera
| Nivel | Resultado | Evidencia |
|---|---|---|
| 1 Estático | OK | `npm run lint`: exit 0, 0 errores y los mismos 4 avisos de siempre. `npm run build`: ✓ built in 727 ms |
| 2 Unitarias | OK | `npm test`: 17 archivos y 199 pruebas pasan. El cambio es solo de clases CSS, sin lógica que probar |
| 3 E2E | OK solo lectura / suite BLOQUEADA | La suite (`npm run test:e2e`) **no se corrió**: crea y borra datos, y la única base disponible es la de producción, con los datos del video. La guarda de `playwright.config.js:9` y la falta de un proyecto de pruebas (DT-05-1) siguen igual. En su lugar corrí un recorrido Playwright de solo lectura (`arreglo-chapetas-capturas/verificar.mjs`): 17 pantallas y diálogos × 4 anchos (375×812, 390×844, 1280×800, 1440×900), 68 mediciones, más 8 de la jornada abierta simulada y 51 de la línea base |
| 4 Revisión crítica | 1 hallazgo Medio, 3 Bajos que ya existían | Ver abajo |
| 5 Consola y red | OK | 0 errores de consola y 0 respuestas HTTP ≥ 400 en los 4 anchos |

Qué mide el recorrido en cada pantalla: si el texto de cada chapeta (`span.bg-chapeta`), de cada peso "N kg" y de cada botón ocupa más de una línea; si la chapeta se sale de su fila; si `scrollWidth` supera el ancho de la ventana; qué elementos se salen a la derecha sin estar en un contenedor con scroll; qué textos tienen `text-overflow: ellipsis` y están recortados; y, en los diálogos, la posición, el tamaño y el número de líneas de cada botón del pie, y si el pie se ve entero.

## Problemas que dice corregir
| # | Problema | Estado | Evidencia (antes = Vercel, después = local) |
|---|---|---|---|
| P1 | La chapeta se parte en dos líneas en la jornada, el lote, Al partir y la venta | CUMPLE | Antes, partidas a 375, 390 y 1280: lote 4/4, jornada 4/4, contrato 3/3, venta 1/1, Asignar 10/11 y la chapeta grande "Relámpago-003" de la ficha. Después: **0 partidas** en los 4 anchos, también en la jornada abierta (5 chapetas) y en el diálogo Cerrar jornada (7). Ninguna se sale de su fila. Capturas `antes-375-*.png` / `despues-375-*.png` |
| P2 | El peso se parte ("380" / "kg") | CUMPLE | Antes, partidos a 375, 390 y 1280: lote, jornada, contrato, venta, Asignar y Registrar visita. Después: **0** en los 4 anchos |
| P3 | "Guardar peso" se parte | CUMPLE (jornada simulada) | No hay jornadas abiertas y abrir una escribe en la base. Por eso reescribí, **solo en el navegador de prueba**, la respuesta GET de la jornada `c4df9f2b` a `estado: abierta` con 2 pesados. Resultado: "Guardar peso" ocupa todo el ancho en una línea a 375 y 390, sin botones partidos. `despues-375-jornada-abierta-SIMULADA.png` |
| P4 | El pie del diálogo se parte ("Seguir" / "pesando") | CUMPLE | Cerrar jornada (simulado): a 375 los dos botones se apilan a todo el ancho (330 px cada uno, y: 674 / 741, 1 línea). A 1280 y 1440 van lado a lado con su ancho natural (161 y 152 px). Los otros 8 diálogos (Registrar peso, Editar lote, Mover, Asignar, Registrar visita, Anotar gasto…) van a 375 y 390 en una fila con los dos botones estirados (≈164 + 157 px), y en escritorio quedan igual que en la línea base (112 + 106 px). El pie se ve entero en todos. Revisé los 22 `pie=`: todos son `<>` con `<Button>` directos, así que `[&>button]` aplica en todos |
| P5 | La finca sale como "Fi…" en el detalle del lote | **NO CUMPLE (parcial)** | Ver M1 |

Sin regresiones: Inicio, Animales, Pesaje (lista), Ventas, Ventas/nueva y Gastos dan exactamente las mismas mediciones antes y después. No hay desborde horizontal en ningún ancho (`scrollWidth` = ancho de la ventana en las 68 mediciones). En el tablero, la chapeta queda encima de la alerta y "En 6 días" sigue alineado a la derecha, en celular y en escritorio (`despues-375-inicio.png`).

## Hallazgos (de mayor a menor severidad)

### [Medio] M1: la finca sigue recortada en el detalle del lote, también en escritorio
- **Dónde:** `src/pages/Lotes.jsx:149-151` (`max-w-full truncate` sobre la finca), dentro de la grilla `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` de `Lotes.jsx:143`. Esa grilla no pasó a `auto-fill minmax(12rem)` como las otras.
- **Reproducir:** abrir `#/lotes/9b03a289-5fbc-561d-98a0-f58dc3364cb1` y medir `scrollWidth > clientWidth` en el texto de la finca.
- **Esperado:** "Finca Santa Rita" entero. **Obtenido** (ancho visible / ancho del texto):
  - 375 px: Relámpago-003 82/102 ("Finca Sant…") y Tornado-001 100/102 ("Finca Santa Ri…").
  - 390 px: Relámpago-003 94/102.
  - 1280 px: **los 4** (94, 74, 92 y 99 de 102 px). Antes daba 67 a 79 px.
  - 1440 px: bien.
  - Capturas: `despues-375-lote.png`, `despues-390-lote.png`, `despues-1280-lote.png` y, para comparar, `antes-375-lote.png`.
- **Por qué importa:** es uno de los cinco problemas que el arreglo dice resolver, sale en la pantalla que se va a grabar y no hay `title` ni otra forma de leer el nombre completo. Hoy hay una sola finca y se adivina. Con dos fincas que empiecen igual ("Finca Santa …"), Miguel no sabría dónde está cada animal antes de moverlo.

### [Bajo] B1: en Animales, el nombre de un animal sale recortado a 375 y 390 px (ya pasaba en la línea base)
- **Dónde:** `#/animales`, lista del hato. No es parte del diff: `Animals.jsx` no cambió.
- **Obtenido:** "Paloma-007" se ve como "Palo…" (61/118 px a 375 y 76/118 a 390). "Barcino-011" llega a 105/112 a 375. Pasa porque el nombre comparte la fila con dos insignias ("Pierde peso", "Al partir"), y así el peso inicial también baja a tres líneas. Las mediciones son idénticas en Vercel. `despues-375-animales.png`.
- **Por qué importa:** el número interno es lo que identifica al animal en la lista principal. No es una regresión, pero sale en el video y es del mismo tipo de defecto que este arreglo ataca.

### [Bajo] B2: el botón "Editar lotes" se parte en dos líneas en Animales a 375 px (ya pasaba en la línea base)
- **Dónde:** cabecera de `#/animales`, a la izquierda de "Crear lote". Mismo resultado en Vercel. A 390 px ya no se parte.

### [Bajo] B3: en el diálogo Asignar animales, la lista pasa a una columna en celular
- **Dónde:** `AlPartir.jsx:480` (`minmax(11rem,1fr)`). A 375 px el área de `max-h-64` muestra unas 4 chapetas y media en vez de 8. Está bien que no se partan, pero hay que desplazarse más para encontrar un animal. `despues-375-dlg-asignar-animales.png`. Es una observación, no un error.

## Sospechas no confirmadas
- El campo "Buscar por nombre" del diálogo Asignar usa `inputMode="numeric"` (`AlPartir.jsx:478`, no viene de este diff). En un celular real eso abre el teclado numérico para buscar nombres como "Paloma". No lo probé en un dispositivo.
- La chapeta grande (`lg`) no tiene `whitespace-nowrap`. Con los nombres actuales cabe en una línea a 375 px ("Relámpago-003", 0 partidas). Un número interno más largo podría volver a partirla.

## Lo que no se verificó y por qué
- `npm run test:e2e`: la suite crea y borra datos, y la única base es la de producción, con los datos del video. Falta el proyecto de pruebas (DT-05-1), que debe proveer el equipo (Andrés).
- La jornada abierta real y el diálogo "Guardar igual" (peso sospechoso): abrir una jornada o enviar un peso escribe en la base. La jornada se verificó con la respuesta simulada en el navegador. El pie de "Guardar igual" usa el mismo `Modal` que los otros 9 diálogos medidos.
- Un celular físico: todo se midió en Chrome con viewport emulado y `deviceScaleFactor` 1.
- Tabletas (640 a 1023 px): no se pidieron. Ahí `sm:[&>button]:flex-none` devuelve a los botones del pie su ancho natural.

Evidencia: `reports/verificacion/arreglo-chapetas-capturas/`, con 13 capturas `despues-*`, 4 `antes-*` (Vercel) y el script `verificar.mjs`.
