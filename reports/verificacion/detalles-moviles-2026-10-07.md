# Verificación del arreglo de detalles móviles B1, B2, B3 y la búsqueda de Asignar (sin spec): APROBADO

Diff verificado: el que está sin commit sobre `3eaf13e`, en `src/pages/Animals.jsx` (cabecera y `TarjetasAnimal`) y `src/pages/AlPartir.jsx` (`AsignarForm`). La app local (`http://localhost:5173`, con el arreglo) se comparó con la de Vercel (`https://santa-rita-app-1.vercel.app/`, sin el arreglo). Las dos usan la misma base de producción con los datos de demostración.

**Veredicto:** los cuatro puntos quedan resueltos en los anchos de diseño (375 y 390 px) y no hay regresiones en la tabla de escritorio. Quedan un hallazgo Medio y cuatro Bajos, ninguno bloqueante:
- M1: la búsqueda distingue tildes ("relampago" no encuentra a Relámpago-003).
- B1 a B4: un nombre que sigue cortado a 320 px, el campo Motivo que ya no se ve sin desplazarse, un placeholder que da una lista vacía y la grilla de escritorio despareja.

**Condición del APROBADO (igual que en las rondas anteriores):** `npm run test:e2e` no se corrió. La suite escribe en la base, la única disponible es la de producción y esta verificación es solo de lectura (DT-05-1). El nivel 3 se cubrió con un recorrido Playwright de solo lectura. Para un cambio de clases CSS más una línea de filtro, lo considero suficiente. Si el humano no lo acepta, el veredicto pasa a BLOQUEADO solo por E2E.

**Datos:** no se escribió nada.
- El navegador de prueba abortaba **cualquier** POST, PATCH, PUT o DELETE, salvo `storage/v1/object/sign`, que solo firma la URL de lectura de una foto. En el recorrido principal se bloquearon 0 peticiones.
- En la sonda auxiliar a 768 px no exceptué la firma y se bloqueó 1 petición: `POST /storage/v1/object/sign/fotos-animales`, la firma de la foto de Bravo-012, que no es una escritura.
- No se guardó ningún formulario ni se asignó ningún animal. El diálogo se cerró siempre con Cancelar.
- La sesión se inyectó con `sesion()` de `toma.mjs` y no se imprimieron credenciales.

## Escalera
| Nivel | Resultado | Evidencia |
|---|---|---|
| 1 Estático | OK | `npm run lint`: exit 0, 0 errores y los mismos 4 avisos de siempre. `npm run build`: ✓ built in 633 ms |
| 2 Unitarias | OK | `npm test`: 17 archivos, 199 pruebas pasan. El filtro de `AsignarForm` vive dentro del componente y no tiene prueba unitaria; se cubrió en el navegador |
| 3 E2E | OK solo lectura / la suite no se corrió | `detalles-moviles-capturas/verificar-detalles.mjs` a 320×640, 375×812, 390×844, 768×1024 (extra), 1280×800 y 1440×900. Recorre Animales (activos, todos y caballos, todas las páginas) y el diálogo Asignar con 12 búsquedas en cada ancho. Lo mismo contra Vercel como línea base (`antes-*`). `sonda-scroll.mjs`: alcance de Motivo y Fecha a 320×568, 375×667, 375×812 y 390×844, y el origen del desborde a 768 |
| 4 Revisión crítica | 1 Medio y 4 Bajos | Ver abajo |
| 5 Consola y red | OK | 0 errores de consola y 0 respuestas HTTP ≥ 400 en todas las corridas, local y Vercel |

## Lo que el arreglo dice corregir
| # | Estado | Evidencia (antes = Vercel, después = local) |
|---|---|---|
| B1: nombres cortados en Animales | CUMPLE a 375 y 390 (a 320 queda uno, ver B1 abajo) | Ver el detalle debajo de la tabla |
| B2: "Editar lotes" en dos líneas | CUMPLE | Antes: 2 líneas a 320 y 375 px. Después: 1 línea en los 6 anchos. A 375 px "Editar lotes" y "Crear lote" van en una fila (165 + 165 px) y "Añadir animal" debajo, a todo el ancho. A 320 se apilan y cada uno ocupa 1 línea. Nada desborda |
| B3: lista de Asignar con poca altura | CUMPLE | Ver el detalle debajo de la tabla |
| Sospecha: búsqueda de Asignar | CUMPLE | Ver el detalle debajo de la tabla |
| Regresión en la tabla de escritorio | Sin regresión | A 768, 1280 y 1440 px las mediciones son **idénticas** a las de Vercel: filas de 91 px, las mismas columnas visibles (con CHAPETA ICA desde 1280), 0 cifras partidas y el mismo scroll interno de la tabla. La cabecera de escritorio también es idéntica: "Editar lotes" mide 157 px, "Crear lote" 146 px y "Añadir animal" 175 px, todos en 1 línea. El diff no toca `TablaGanado` |

**B1, nombres cortados en Animales:**
- Antes, cortados a 375 px: Paloma-007 (61/118 px), Barcino-011 (105/112) y Canelo-008 (105/115). A 390, Paloma-007 (76/118). A 320 estaban cortados Barcino y Canelo (50/112 y 50/115).
- Después: **0 cortados** a 375 y 390. La columna del nombre pasa de 61 a 105 px a 202 px en todas las tarjetas.
- Insignias: el 100 % de las tarjetas que las tienen las muestran debajo del peso y dentro de la columna del nombre. Son 4 de 11 en activos y 5 de 12 en "todos", con "Pierde peso", "Al partir" y "Vendido". Ninguna se parte ni queda fuera de la columna.
- El peso pasa de 3 líneas a 1 a 375 px. Las tarjetas miden 114 px, o 145 px con insignias; antes medían 168.
- Capturas: `despues-375-animales-todos-p1.png` frente a `antes-375-animales-todos-p1.png`.

**B3, lista de Asignar con poca altura:**

| Ancho | Antes: por fila | Antes: visibles sin desplazar | Después: por fila | Después: visibles sin desplazar | Después: alto de la lista |
|---|---|---|---|---|---|
| 375 | 1 | 4 de 8 | 1 | 5 de 8 | 365 px (`45vh`) |
| 390 | 1 | 4 de 8 | 2, 2, 1, 1, 1, 1 | **8 de 8** | 369 px |
| 1280 | 2 | 8 de 8 | 3, 2, 2, 1 | 8 de 8 | `max-h` 288 px |

En ningún ancho hay chapetas partidas ni elementos fuera de la lista, y la página no se desplaza de lado. El pie se ve entero y sus botones van en 1 línea. Capturas: `despues-{375,390,1280}-dlg-asignar.png`.

**Sospecha, búsqueda de Asignar:**
- El campo ya no tiene `inputmode` (antes `numeric`), es `type=text` y muestra el placeholder "Por ejemplo: moro".
- "paloma", "PALOMA", "PaLoMa" y "  paloma  " devuelven Paloma-007 en los 6 anchos.
- "Relámpago" y "RELÁMPAGO" devuelven Relámpago-003, y "00" devuelve 7.
- En las 72 búsquedas, el resultado es igual a lo esperado sin distinguir mayúsculas.

## Hallazgos (de mayor a menor severidad)

### [Medio] M1: la búsqueda de Asignar distingue tildes, y la de Animales no
- **Dónde:** `src/pages/AlPartir.jsx:437`, que usa solo `toLowerCase()`. La app ya tiene `sinTildes` y `coincide` en `src/domain/tabla.js:22-28`, y con eso funciona el buscador de `#/animales`.
- **Reproducir:** abrir el contrato, tocar "Asignar animales" y escribir `relampago`.
- **Esperado:** Relámpago-003, igual que en el buscador de Animales. **Obtenido:** 0 resultados, sin ningún mensaje: la lista desaparece y el diálogo salta a Motivo y Fecha. Pasa en los 6 anchos. Captura: `despues-375-dlg-asignar-buscar-relampago.png`.
- **Por qué importa:** en el celular casi nadie escribe tildes. Dos de los 8 candidatos de hoy las llevan (Capitán-002 y Relámpago-003). Miguel concluiría que el animal no está disponible para el contrato. No hay pérdida de datos y se puede buscar por número ("003"), por eso es Medio y no Alto. Pista, sin corregirlo yo: reutilizar `sinTildes` de `domain/tabla.js`.

### [Bajo] B1: a 320 px "Relámpago-003" todavía sale como "Relámpago-…"
- **Dónde:** `src/pages/Animals.jsx:432` (`truncate`). A 320 px la columna mide 147 px y el nombre 157.
- **Antes:** a 320 px estaban cortados Barcino-011 y Canelo-008 (50 px visibles). Es una mejora clara y 320 queda por debajo del ancho de diseño, pero B1 no queda resuelto del todo en celulares pequeños. Captura: `despues-320-animales-p1.png`.

### [Bajo] B2: con la lista más alta, "Motivo" ya no se ve sin desplazarse en el celular
- **Dónde:** `src/pages/AlPartir.jsx:480` (`max-h-[45vh]`).
- **Obtenido:**
  - A 375×812 y 390×844, el campo Motivo quedaba visible encima del pie en Vercel y ahora no. Fecha ya estaba oculta antes.
  - En el cuerpo del diálogo hay que desplazarse 189 px (768/579), y dentro va otra zona con su propio desplazamiento, la lista.
  - Tras desplazar el cuerpo, Fecha se alcanza en todos los tamaños medidos, también a 320×568 y 375×667.
- **Por qué importa:** los dos campos traen valores por defecto ("Entrega Al partir" y hoy). Si la entrega fue otro día, es más fácil no darse cuenta de que la fecha quedó en hoy. Es un intercambio aceptable a cambio de ver más chapetas; queda anotado.

### [Bajo] B3: el placeholder "Por ejemplo: moro" da una lista vacía y sin mensaje
- **Dónde:** `src/pages/AlPartir.jsx:478`. Moro-010 ya está "Al partir", así que nunca aparece entre los candidatos.
- **Qué pasa:** al escribir el ejemplo, la lista queda vacía (alto 0) y no hay texto del tipo "Ningún animal disponible con ese nombre". La falta de ese mensaje ya existía; el placeholder la hace más probable, sobre todo en una demostración.

### [Bajo] B4: en escritorio la lista de Asignar quedó despareja
- **Antes:** 2 columnas alineadas de 261 px. **Después:** `flex-wrap` con anchos de 158 a 197 px y filas de 3, 2, 2 y 1.
- Se siguen viendo los 8 y no hay nada roto; es solo estética. Captura: `despues-1280-dlg-asignar.png` frente a `antes-1280-dlg-asignar.png`.

## Deuda que ya existía (fuera del diff, idéntica en Vercel)
- A 768 px, `#/animales` se desplaza 90 px de lado (`scrollWidth` 858/768). La causa es la fila de filtros: `div.grid grid-cols-2 gap-3 md:flex`, con los selectores `md:w-44` y `md:w-56`, más la barra lateral (`Animals.jsx`, alrededor de las líneas 180-200). Afecta a tabletas.
- A 1280 px la tabla tiene 5 px de desplazamiento interno (941/936).

## Sospechas no confirmadas
- El campo de búsqueda toma el foco al abrir el diálogo (se ve el anillo de foco en las capturas). En un celular real eso puede abrir el teclado enseguida y tapar la lista. No lo probé en un dispositivo y no viene de este diff.
- No hay caballos en los datos, así que no vi las tarjetas de caballos (`TarjetasAnimal` con `caballos`) con insignias de estado.

## Lo que no se verificó y por qué
- `npm run test:e2e`: falta el proyecto de Supabase de pruebas (DT-05-1), que debe proveer el equipo (Andrés).
- Un celular físico y el teclado que abre: todo se midió en Chrome con viewport emulado y `deviceScaleFactor` 1. Que ahora salga el teclado de letras se deduce de que el campo ya no tiene `inputmode`.
- La asignación real: escribe en la base.

Evidencia: `reports/verificacion/detalles-moviles-capturas/`, con capturas `despues-*` (local) y `antes-*` (Vercel), `despues-resultados.json`, `antes-resultados.json` y los scripts `verificar-detalles.mjs` y `sonda-scroll.mjs`.
