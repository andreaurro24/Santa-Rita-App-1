# Verificación desborde de `#/animales` en tabletas (arreglo sin spec, toca 022 · R3) — RECHAZADO

Cambio verificado: `git diff src/pages/Animals.jsx`, sin commit sobre `29c3f48`. Todo se hizo en
modo solo lectura contra la base de PRODUCCIÓN (datos de demostración): cada contexto de
Playwright abortaba cualquier método que no fuera GET/HEAD/OPTIONS (salvo el POST de
`/storage/v1/object/sign`). **Peticiones bloqueadas: 0** en las cuatro sondas. No hice clic en
nada que escriba. Errores de consola: 0. Respuestas HTTP ≥ 400: 0.

"Antes" se midió con una copia de `HEAD` (`git archive`) servida en :5181 y "después" con la
copia de trabajo en :5173, con las mismas sondas.

**Los criterios medibles que se pidieron se cumplen todos.** Se rechaza por un efecto que no estaba
en esos criterios: entre 768 y 1279 px la lista ya no deja ordenar y ya no muestra la chapeta, el
precio por kg ni el dueño. Eso va en contra de 022 · R3 y de su corrección r1 (hallazgo Alto). Es
una decisión de diseño que el humano puede aceptar si cambia la spec. Ver las opciones al final del
hallazgo.

## Escalera
| Nivel | Resultado | Evidencia |
|---|---|---|
| 1 Estático | OK | `npm run lint`: salida 0, solo advertencias que ya existían (ninguna en `Animals.jsx`). `npm run build`: `✓ built`. Ningún `service_role` en `dist/`. |
| 2 Unitarias | OK | `npm test`: 17 archivos, 199 pruebas pasan. El cambio es solo de CSS y marcado, así que ninguna prueba unitaria lo cubre. |
| 3 Extremo a extremo | PARCIAL (sondas solo lectura; la suite no se corrió) | La suite no se corrió: escribe datos y `exigirProyectoDePruebas` impide apuntarla a producción. Hice una revisión estática de las pruebas que dependen de la tabla (abajo). Corrí 4 sondas de Playwright de solo lectura: `reports/verificacion/desborde-animales-tableta-capturas/verif-*.mjs`. |
| 4 Revisión crítica | FALLA | Hallazgo Alto sobre 022 · R3 entre 768 y 1279 px. |
| 5 Consola y red | OK | 0 errores de consola, 0 respuestas ≥ 400, 0 escrituras bloqueadas. |

## Criterios de aceptación del encargo
| Criterio | Estado | Evidencia |
|---|---|---|
| `scrollWidth === clientWidth` de la página en ganado, `?estado=todos` y `?ver=caballos` a 768, 800, 900, 1000, 1023, 1024, 1100, 1200, 1279, 1280, 1300, 1366, 1440, 1536 y 1920 | CUMPLE | `verif-ancho.mjs`: las 51 combinaciones dan "OK despues". El bug se reproduce en "antes": `768 pag=858/768`, `800 pag=858/800`, y el que desborda es `div.grid grid-cols-2 gap-3 md:flex` → `label.md:w-56`. |
| Tabla visible sin desplazamiento interno | CUMPLE con los datos demo | Después: 1280 `936/936`, 1366 `1022/1022`, 1440 `1096/1096`, 1536 `1192/1192`, 1920 `1222/1222`. Antes: 1280 `941/936`, y de 768 a 1200 `889/424…856`. Por debajo de 1280 ya no hay tabla, se ven 11 o 12 tarjetas. El margen es pequeño: ver el hallazgo Medio 2. |
| Celular (375 y 390) sin cambios | CUMPLE | Mis capturas antes/después son idénticas byte a byte (md5) en las 6 combinaciones, incluida `?ver=caballos`. Las capturas del scratchpad también lo son en 375 y 390. Ojo: las de "caballos" no mostraban caballos (Bajo 4). |
| lint, build, test | CUMPLE | Nivel 1 y 2. |
| No romper e2e que dependan de la tabla | NO CUMPLE (1 prueba) | Ver Medio 1. |

## Requisitos (spec 022, solo los que toca el diff)
| ID | Estado | Evidencia |
|---|---|---|
| R3 (tabla en escritorio, ordenar, corrección r1) | NO CUMPLE entre 768 y 1279 px; CUMPLE desde 1280 | `verif-1100.mjs`: a 768, 1024, 1093, 1100 y 1279 px, después: `botonesOrdenar:0, chapetaVisible:false, precioKgVisible:false`. Antes: `4, true, true`. Desde 1280 vuelve a `4, true, true`. |
| R4 (tarjetas en el celular) | CUMPLE | 375 y 390 sin cambios. |
| R5 (buscador y filtros) | CUMPLE, con un detalle | Fila horizontal desde 1024 y en columna por debajo. A 1024 el buscador mide 176 px y el texto de ayuda se corta ("Buscar por nom"). Ver Bajo 3. |
| R8 (caballos con la misma tabla) | CUMPLE (con datos inyectados) | No hay caballos en la demo. Inyecté 22 caballos en el navegador: la tabla cabe a 1280 (`936/936`), 1366, 1440, 1536 y 1920. Por debajo de 1280 se ven 20 tarjetas y la paginación. |

## Hallazgos (de mayor a menor severidad)

### [Alto] Entre 768 y 1279 px la lista pierde ordenar, chapeta, precio por kg y dueño (022 · R3)
- Dónde: `src/pages/Animals.jsx:333` y `:385` (`hidden … xl:block`), `:419` (`xl:hidden`). En `TarjetasAnimal` (`:416-450`) no hay chapeta, precio por kg ni dueño, y ordenar solo existe en los encabezados de la tabla (`Encabezado`, `:295-307`).
- Reproducir: `node reports/verificacion/desborde-animales-tableta-capturas/verif-1100.mjs` (con :5173 y una copia de HEAD en :5181), o abrir `#/animales` con la ventana a 1100 px.
- Esperado: 022 · R3 dice que se puede ordenar por animal, peso actual, peso inicial y precio. Su corrección r1 dice: "la chapeta tiene columna desde 1280 px y la raza y el dueño desde 1536 px; **en pantallas más angostas esos datos se muestran debajo del nombre del animal**".
- Obtenido: de 768 a 1279 px se ven las tarjetas del celular. No hay forma de ordenar, y la chapeta, el precio por kg de compra y el dueño no aparecen en ninguna parte de la lista. Antes del cambio estaban, aunque había que desplazar la tabla. El diff también borra la línea que ponía la chapeta bajo el nombre.
- Por qué importa: muchos portátiles con Windows caen en ese rango. Un 1366×768 al 125 % da unos 1093 px y una tableta en horizontal da 1024 o 1180. En esos equipos Miguel ya no puede ordenar por peso actual para ver los animales listos ni comparar el precio de compra por kg, que son datos para decidir la venta. El arreglo cambia un desplazamiento lateral por funciones que faltan.
- Opciones (las decide el humano, no el verificador): (a) aceptar el diseño y corregir 022 · R3 para decir que bajo 1280 px se usan tarjetas; (b) desde `md`, añadir a las tarjetas la chapeta y el precio por kg y poner un selector de orden encima de la lista.

### [Medio] 1. La prueba e2e `VRF5R B7` va a fallar por diseño
- Dónde: `tests/e2e/verificador-sprint05-r2.spec.js:530-546`.
- La prueba recorre `[1280, 1279, 1440, 1024]` y en cada ancho hace `await expect(page.locator('table')).toBeVisible()`, que es un `expect` duro. Con el cambio, a 1279 y 1024 no hay tabla y la prueba se cae por timeout. No la corrí (no hay proyecto de pruebas); lo deduzco de leer el código.
- Las demás pruebas que usan la tabla corren a 1280 (Desktop Chrome 1280×720 o `setViewportSize(1280, …)`), donde la tabla sigue visible. Revisé `diseno.spec.js:66-73`, `sprint06.spec.js:108-133`, `verificador-diseno.spec.js:337-367`, `verificador-ventas.spec.js:236` y `decision.spec.js:72`. `diseno.spec.js:44` (`table` oculta a 375) sigue bien.
- Qué hacer: alguien del equipo debe actualizar B7 a la decisión que se tome sobre el hallazgo Alto. No se puede saltar ni borrar.

### [Medio] 2. A 1280 px la tabla cabe con muy poco margen: datos normales la hacen desplazarse
- Dónde: `TablaGanado`, `src/pages/Animals.jsx:331-378`. Las columnas Chapeta (`whitespace-nowrap`, `:359`) y Lote (insignia `whitespace-nowrap`, `:362`) no se cortan.
- Reproducir: `verif-margen.mjs`. Inyecta en el navegador (vía `route.fulfill` del GET, sin escribir nada) variantes de un solo campo y mide el ancho mínimo de la tabla frente al disponible.

  | Datos (todos dentro de los `maxLength` del formulario) | 1280 sin barra de desplazamiento | 1280 con barra clásica de Windows |
  |---|---|---|
  | Demo tal cual | cabe, margen 22 px | cabe, margen 7 px |
  | Lote "Lote 2027-A (Ceba)" (el placeholder de `LoteForm`) + "Al partir" | cabe, 10 px | **desplaza 926/921** |
  | Raza "Brahman rojo x Gyr lechero" + dueño de 28 caracteres | **desplaza 953/936** | **desplaza 953/921** |
  | Chapeta de 20 caracteres | **desplaza 980/936** | **desplaza 980/921** |
  | Lote de 30 caracteres | **desplaza 1014/936** | desplaza también a 1366 (1014/1007) y a 1536 (1190/1177) |

- Esperado vs. obtenido: la corrección r1 de R3 pide que la tabla "quepa sin desplazarse". Con los datos demo cabe. Con un dueño o una raza un poco más largos, o con Chrome en Windows (barra de 15 px), a 1280 vuelve a desplazarse por dentro. No es regresión: antes era peor (con los mismos datos "realistas" daba 1254/936 contra 1060/936 ahora). Además el desplazamiento queda dentro de la tabla (`overflow-x-auto`) y no mueve la página.
- Por qué importa: 1920×1080 al 150 % (1280 px de CSS) es una configuración común en portátiles. Cuando Miguel tenga sus propios lotes y dueños, la tabla puede volver a cortar la columna de precio, que es la última.
- Nota: las sondas de Playwright ocultan la barra de desplazamiento (`--hide-scrollbars`). Las cifras "con barra" salen de `BARRAS=1`.

### [Bajo] 3. A 1024–1100 px el buscador queda angosto y su texto de ayuda se corta
- Dónde: `src/pages/Animals.jsx:166` (`lg:flex-row`) con `lg:w-44` y `lg:w-56`.
- Obtenido: el buscador mide 176 px a 1024, 245 a 1093 y 252 a 1100, y el placeholder se ve como "Buscar por nom" (`verif-1100.mjs`, captura `despues-1024-_animales.png`). Funciona, pero no dice que también busca por chapeta, dueño o raza. Antes del cambio pasaba lo mismo en ese rango, y a 768 era peor (61 px).

### [Bajo] 4. La evidencia de "caballos" del implementador no mostraba caballos
- Dónde: `scratchpad/sonda-ancho.mjs`, `rutas = [..., '#/animales?vista=caballos']`. La app lee `ver` (`Animals.jsx:59`), así que esa ruta mostraba el ganado.
- Prueba: `antes-375-_animales.png` y `antes-375-_animales_vista_caballos.png` tienen el mismo md5 (`77608323…`). Lo mismo pasa con las de 1280 y 768 (mismo tamaño en bytes).
- Corregido en esta verificación: medí `?ver=caballos` (pestaña "Caballos" seleccionada) y probé la tabla de caballos con datos inyectados.

### [Bajo] 5. Clases sobrantes
- `Animals.jsx:342` y `:359`: `hidden … xl:table-cell` en la columna Chapeta, dentro de una tabla que ya solo se muestra desde `xl`. No hacen daño, pero confunden. El parámetro `ocultas` sigue teniendo sentido (raza y dueño hasta 2xl).

## Sospechas no confirmadas
- Las pruebas `VRF 002 R4/R10/R6` (`verificador-diseno.spec.js:366`, `scrollInterno` debe ser `false` a 1280) y `B7` a 1280 y 1440 corren contra el proyecto de desarrollo. Si sus datos tienen lotes o chapetas largos (por ejemplo, prefijos `E2E-…`/`VRF…` en el nombre del lote), pueden fallar por el Medio 2. No lo pude comprobar.

## Lo que no se verificó y por qué
- `npm run test:e2e`: escribe datos, y el único Supabase disponible es producción. Falta el proyecto de pruebas (DT-05-1), que debe proveer el equipo (Andrés).
- Tabla de caballos con datos reales: no hay caballos en la demo. Se probó con 22 caballos inyectados solo en el navegador.
- Navegadores reales (Safari en iPad, Chrome en Windows con escalado): todo se midió en Chrome con viewport emulado y `deviceScaleFactor` 1. La barra clásica de Windows se simuló con `BARRAS=1`.
- Efecto en mi entorno: al levantar la copia de HEAD la primera vez, Vite reescribió la caché de dependencias del repo (`node_modules/.vite/deps`, 23:22) a través de un enlace a `node_modules`. Después lo aislé (`cacheDir` propio) y borré el enlace y la copia de `.env.local`. El servidor de :5173 siguió sirviendo sin errores en todas las sondas posteriores. Si el servidor de desarrollo se comporta raro, reiniciarlo con `npm run dev -- --force` regenera la caché. No se tocó `src/`.

Evidencia: `reports/verificacion/desborde-animales-tableta-capturas/` (sondas `verif-ancho.mjs`, `verif-estres.mjs`, `verif-margen.mjs`, `verif-1100.mjs` y capturas antes/después). Las sondas esperan la copia de trabajo en :5173 y una copia de HEAD en :5181.

---

# Ronda 2 (2026-10-08) — RECHAZADO

Cambio verificado: `git diff src/pages/Animals.jsx` (sin commit sobre `29c3f48`, que sigue siendo `HEAD`).
Todo en solo lectura contra PRODUCCIÓN: cada contexto de Playwright abortaba todo método distinto de
GET/HEAD/OPTIONS (salvo el POST de `/storage/v1/object/sign`). **Peticiones bloqueadas: 0** en todas las
sondas. No levanté ninguna copia de la app (solo :5173); el "antes" son mis capturas y mediciones de la
ronda 1. Sondas y capturas: `reports/verificacion/desborde-animales-tableta-capturas/ronda2/`.

**Lo que se pidió se cumple:** la página no se desplaza de lado en ningún ancho, el celular no cambia,
la tabla cabe a 1024, 1279 y 1280 con los datos demo y vuelven el orden por columnas, la chapeta y el
precio por kg entre 768 y 1279 px. **Se rechaza por una regresión que trae el mismo arreglo:** el tope
`max-w-36` corta la línea bajo el nombre en todas las filas entre 768 y 1279 px. La raza y el dueño ya
no se ven en ninguna parte de la lista, y 022 · R3 (corrección r1) dice que se deben ver ahí.

## Escalera
| Nivel | Resultado | Evidencia |
|---|---|---|
| 1 Estático | OK | `npm run lint`: salida 0. Solo advertencias que ya existían y ninguna en `Animals.jsx`. `npm run build`: `✓ built in 540ms`. `grep -rl service_role dist/`: sin resultados. |
| 2 Unitarias | OK | `npm test`: 17 archivos, 199/199. Ninguna prueba cubre el cambio, que es de CSS y marcado. No hay prueba unitaria de ordenar por `precioKg` (ver el Alto preexistente). |
| 3 Extremo a extremo | PARCIAL (sondas solo lectura; la suite no se corrió) | La suite escribe datos y no hay proyecto de pruebas (DT-05-1). Corrí 5 sondas: `r2-ancho.mjs`, `r2-tabla.mjs`, `r2-orden.mjs`, `r2-margen.mjs` y `r2-estres.mjs`. |
| 4 Revisión crítica | FALLA | Alto de regresión en 022 · R3 (raza y dueño). Además, un Alto preexistente fuera del diff. |
| 5 Consola y red | OK | `r2-ancho.mjs`: 0 errores de consola y 0 respuestas ≥ 400 en 54 cargas. Tres corridas se cayeron por la red hacia Supabase (`ETIMEDOUT`, `ECONNRESET`, `waitForLoadState` 30 s). Es la conexión de esta máquina, no la app; las volví a correr. |

## Criterios del encargo
| Criterio | Estado | Evidencia (`r2-ancho.mjs`) |
|---|---|---|
| La página no se desplaza de lado entre 768 y 1440 | CUMPLE | `scrollWidth === clientWidth` en las 54 combinaciones: ganado, `?estado=todos` y `?ver=caballos` a 375, 390, 768, 800, 900, 1000, 1023, 1024, 1100, 1180, 1200, 1279, 1280, 1300, 1366, 1440, 1536 y 1920. No hay elementos fuera de la pantalla. Con datos extremos inyectados (`r2-estres.mjs`, "maximo") la página tampoco se desplaza: solo se desplaza la caja de la tabla. |
| El celular (375 y 390) no cambia | CUMPLE | Mis capturas de la ronda 1 hechas sobre `HEAD` (`scratchpad/verif-shots/antes-*`) y las de ahora (`ronda2/shots/r2-*`) son idénticas por md5 en 6 de 6 casos, incluido `?ver=caballos`. |
| La tabla cabe a 1280, 1024 y 1279 (B7) | CUMPLE con los datos demo | 1024: `680/680` (mínimo 651); 1279: `935/935`; 1280: `936/936` (mínimo 875); 1440: `1096/1096`. Coincide con lo medido por el implementador (651/680 y 875/936). |
| No se pierde funcionalidad de 022 · R3 | **NO CUMPLE** | Hay 4 botones de ordenar y se ven la chapeta y el precio por kg. Pero la raza y el dueño quedan cortados (ver Alto 1). |
| lint, build y test | CUMPLE | Niveles 1 y 2. |

## Estado de los hallazgos de la ronda 1
| Hallazgo r1 | Estado | Evidencia |
|---|---|---|
| Alto: de 768 a 1279 no se puede ordenar y no se ven la chapeta, el precio por kg ni el dueño | RESUELTO EN PARTE | Ordenar funciona a 768, 1024 y 1279 por peso actual y peso inicial (`r2-orden.mjs`, asc y desc correctos). La chapeta se ve bajo el nombre y el precio por kg en su columna. **El dueño (y ahora la raza) siguen sin verse**: Alto 1. |
| Medio 1: B7 fallaría a 1279 y 1024 | RESUELTO (por medición, sin correr B7) | La tabla está visible y cabe a 1024, 1279, 1280 y 1440 con los datos demo. |
| Medio 2: a 1280 la tabla cabe con muy poco margen | MEJORA, SIGUE ABIERTO | Ver Medio 3. |
| Bajo 3: buscador angosto y texto cortado a 1024–1100 | RESUELTO | El buscador mide 397 px a 768, 653 a 1024 y 432 a 1280, y el texto de ayuda ya no se corta desde 768. A 375 y 390 se corta igual que antes; no cambió. |
| Bajo 4: la evidencia de caballos usaba `?vista=` | RESUELTO EN ESTA VERIFICACIÓN | Medí `?ver=caballos` (pestaña "Caballos" activa). |
| Bajo 5: clases sobrantes | RESUELTO | La tabla vuelve a mostrarse desde `md`, así que `hidden xl:table-cell` de la chapeta vuelve a tener sentido. |
| Separador suelto "· Brahman" a ≥1280 | RESUELTO | 0 líneas que empiezan o terminan en "·" en todos los anchos (`r2-ancho.mjs`, `sueltos 0`). A 1280 la línea dice "Brahman". |

## Requisitos (spec 022, solo los que toca el diff)
| ID | Estado | Evidencia |
|---|---|---|
| R3 (tabla, ordenar, corrección r1) | **NO CUMPLE entre 768 y 1279 px** (raza y dueño); CUMPLE desde 1280 | Alto 1. El orden por precio no funciona en ningún ancho, pero ya fallaba antes del diff (Alto 2). |
| R4 (tarjetas en el celular) | CUMPLE | Capturas idénticas a 375 y 390. |
| R5 (buscador y filtros) | CUMPLE | En columna por debajo de 1280 (selectores en dos columnas, 192 px cada uno a 768) y en fila desde 1280. |
| R8 (caballos) | CUMPLE | No hay caballos en la demo: se ve "Todavía no hay caballos" en todos los anchos. Con 22 caballos inyectados la página no se desplaza; la tabla se desplaza por dentro con datos largos por debajo de 1279 (Medio 4). |

## Hallazgos de la ronda 2 (de mayor a menor severidad)

### [Alto] 1. Entre 768 y 1279 px la raza y el dueño no se ven en ninguna fila (regresión de 022 · R3)
- Dónde: `src/pages/Animals.jsx:317` (`<span className="min-w-0 max-w-36 xl:max-w-40">`) junto con `:322` (`block truncate`) en la línea secundaria.
- Reproducir: `node reports/verificacion/desborde-animales-tableta-capturas/ronda2/r2-tabla.mjs` (con :5173), o abrir `#/animales?estado=todos` a 1024 o 1279 px. Capturas: `ronda2/shots/tabla-demo-1024.png` y `tabla-demo-1279.png`.
- Esperado: corrección r1 de 022 · R3: "la raza y el dueño [tienen columna] desde 1536 px; **en pantallas más angostas esos datos se muestran debajo del nombre del animal**". En `HEAD` la línea completa se veía en todas las filas: la sonda de la ronda 1 encontró 0 textos truncados en la tabla.
- Obtenido, con los datos demo: en las 12 de 12 filas, a 768, 1024, 1100 y 1279 px, la línea "COL-CES-990011 · Brahman" se corta en "COL-CES-990011 ·…". Se ve el 75 % del texto; con "Cebú comercial", el 61 %. **La raza no se ve en ninguna fila** y el separador queda colgando con los puntos suspensivos. Si el animal tiene dueño (inyectado: "COL-CES-990011 · Brahman · Socio Pedro Gómez"), se ve el 44 % y el dueño desaparece por completo. A 1280–1535 la línea es "raza · dueño" con tope de 160 px, y "Brahman · Socio Pedro Gómez" se corta al 82 %. No hay `title` ni otra forma de ver el texto completo sin entrar al animal.
- El tope no hace falta en casi todo ese rango: a 1279 la tabla tiene 284 px libres (mínimo 651 en una caja de 935) y aun así corta. Solo a 1024 el margen es justo (29 px).
- Por qué importa: el dueño separa los animales de Miguel de los de un socio o tenedor. En una tableta horizontal o un portátil con zoom, Miguel ya no lo ve en la lista y tiene que abrir animal por animal. Además, la fila se ve rota ("·…"). El arreglo cumple B7, pero quita información que R3 promete.
- Opciones (las decide el humano): (a) dejar que la línea secundaria se parta en dos renglones (`line-clamp-2` o `break-words` en lugar de `truncate`) y mantener el tope de ancho; (b) poner el tope solo en el nombre o subirlo por encima de 1100 px, donde sobra espacio; (c) corregir R3 para aceptar que se corte.

### [Alto, preexistente, fuera del diff] 2. "Precio x kg" no ordena con los datos demo
- Dónde: `src/domain/tabla.js:35` (`precioKg: (a) => a.precioCompraKg`) frente a `src/pages/Animals.jsx:54`. La columna muestra `a.precioCompraKg ?? kiloDesdeTotal(a.costoCompra, a.pesoIngreso)`, pero el orden solo usa `precioCompraKg`.
- Reproducir: `node .../ronda2/r2-orden.mjs`. A 768, 1024 y 1279, dos clics en "Precio x kg" dejan la lista igual: `[9000,8644,6667,8621,8906,8387,7619,9825,8772,8929,9000,9091]` en los dos sentidos. Ordenar por peso actual y por peso inicial funciona.
- Esperado: 022 · R3 dice "se puede ordenar por animal, peso actual, peso inicial y precio". Obtenido: con los animales registrados por precio total (todos los de la demo) no pasa nada, y en una lista mezclada los que se ven con precio calculado quedan "sin valor" al final.
- No lo trae este diff: `tabla.js` no cambia desde `4547711` y `Animals.jsx:54` es igual en `HEAD`. Se reporta aparte para abrirlo como bug; no cuenta para el veredicto de este arreglo. No hay prueba unitaria de ordenar por `precioKg` en `src/domain/tabla.test.js`.
- Por qué importa: comparar el precio de compra por kg es un dato para decidir la venta, y el botón parece funcionar (cambia la flecha) aunque no ordena.

### [Medio] 3. A 1280 la tabla todavía se desplaza por dentro con lotes o chapetas largos (Medio 2 de la ronda 1, mejoró)
- `r2-margen.mjs`, mismos datos inyectados que en la ronda 1 (solo en el navegador):

  | Datos | 1280 r1 | 1280 r2 | 1280 r2 con barra clásica | 1024 r2 con barra |
  |---|---|---|---|---|
  | Demo | margen 22 | margen 61 | margen 46 | margen 14 |
  | Lote "Lote 2027-A (Ceba)" + Al partir | margen 10 | margen 49 | margen 34 | margen 23 |
  | Raza larga + dueño de 28 caracteres | desplaza 953/936 | — (corrida caída por la red) | cabe, margen 7 | cabe |
  | Chapeta de 20 caracteres | desplaza 980/936 | **desplaza 941/936** | desplaza 941/921 | cabe |
  | Lote de 30 caracteres | desplaza 1014/936 | **desplaza 975/936** | desplaza 975/921 | **desplaza 674/665** |
- Escenario "realista" de la ronda 1 a 1280: 1060/936 en r1 y 1022/936 ahora. La página nunca se desplaza. Desde 1280 la insignia del lote vuelve a `whitespace-nowrap`, así que un lote largo ensancha la tabla. En `src/data/seedAnimals.json` hay lotes de 37 caracteres ("Lote 2026-B (Ceba – recién ingresado)"). Si Miguel usa nombres así, a 1280 y 1366 el precio por kg puede quedar fuera de la vista.

### [Medio] 4. Entre 768 y ~1000 px la tabla se desplaza por dentro (deuda, no es motivo de rechazo)
- Pasaba antes y ahora es menos: 768 `651/424` (antes `889/424`), 800 `651/456` y 900 `651/556`. Desde 1000 cabe.
- A 768 se ve "PESO ACTUA" cortado, y el peso inicial y el precio quedan fuera (`ronda2/shots/tabla-demo-768.png`). En tabletas con barras que se superponen (iPad en vertical, 768–834 px) no hay ninguna señal de que se pueda deslizar, salvo el encabezado cortado.
- Valoración: 022 · R3 habla de "escritorio" y 768–1000 px es una tableta en vertical. El encargo exige que no se desplace la **página**, y no se desplaza. Por eso lo dejo como deuda Media y no como rechazo. Para cerrarlo: tarjetas hasta `lg`, o esconder columnas por debajo de `lg`.
- Caballos con datos largos inyectados ("Alazán tostado con medias blancas", dueño de 28 caracteres): la tabla se desplaza por dentro a 768 y 1024 (`751/680`) y cabe desde 1279 (`r2-estres.mjs`).

### [Medio] 5. Los nombres largos se cortan en todos los anchos, sin forma de leerlos
- Mismo tope `max-w-36 xl:max-w-40` (`Animals.jsx:317`). Con un nombre de 27 caracteres (el formulario admite 30), "Novillo Pintado Barcino-011" se ve al 67 % entre 768 y 1279 y al 75 % de 1280 a 1920, aunque a 1536 sobran 140 px. En `HEAD` no se cortaba. No hay `title`.
- Con los nombres de la demo (≤ 13 caracteres) y los de la semilla ("0101") no pasa. Si dos nombres empiezan igual por más de unos 20 caracteres, en la lista no se pueden distinguir.

### [Bajo] 6. La insignia del lote se parte en tres renglones y "Al partir" en dos
- A 768 y 1024, "Novillos / de la / vega" ocupa una píldora `rounded-full` de 72 px de alto, más alta que la fila (`h-16`, 64 px), y "Al / partir" también se parte (`tabla-demo-768.png` y `tabla-demo-1024.png`). Funciona, pero se ve tosco. Para la insignia, `rounded-lg` cuando se parte, o `whitespace-nowrap` solo en "Al partir".

## Sospechas no confirmadas
- B7 y `VRF 002 R4/R10/R6` corren contra el proyecto de desarrollo. Si sus lotes tienen nombres de 30 caracteres o más, por ejemplo con prefijos `E2E-`/`VRF`, a 1280 pueden seguir fallando (Medio 3). A 1024 pasaría lo mismo con la barra clásica, aunque Playwright sin interfaz la oculta. No corrí B7.

## Lo que no se verificó y por qué
- `npm run test:e2e` (B7 incluida): escribe datos y solo está disponible producción. Falta el proyecto de pruebas (DT-05-1); debe proveerlo el equipo (Andrés).
- La variante "peso 1.234,5 kg" y la de raza y dueño largos sin barra a 1280: esa corrida se cayó por la red. Con la barra clásica, que es el caso más exigente, las dos caben.
- Safari en iPad y Chrome en Windows con escalado real: todo se midió con viewport emulado y `deviceScaleFactor` 1.
- Incidente menor de la sesión: una corrida que falló por la red imprimió en la salida de mi terminal el registro de la petición de Playwright, con el token de acceso de la sesión demo (dura 1 h). No quedó en ningún archivo ni en este reporte, y después filtré esa salida. No se imprimieron ni el correo ni la clave.
- Esta es la ronda 2, la última que permite el flujo (CLAUDE.md §2). El humano decide entre corregir el Alto 1 (una línea de CSS en `:317`/`:322`) con una verificación explícita más, o aceptar la regresión cambiando R3.
