# Verificación del bug "Simulador inutilizable entre 768 y ~1000 px" (sin spec): APROBADO

Cambio verificado (git diff sin commit en `src/pages/Ventas.jsx`):
- La grilla pasa de `md:` a `xl:` en la línea 332.
- El panel pasa de `md:sticky md:top-6` a `xl:sticky xl:top-6` en la línea 423.
- La fila de botones pasa a `xl:col-start-1` en la línea 427.

Antes del arreglo, este problema quedó reportado como "[Medio, previo]" en
`bug-boton-confirmar-venta-2026-10-06.md`.

- **Fecha:** 2026-10-06.
- **Entorno:** servidor de desarrollo en http://localhost:5173, conectado a la BD de **producción**, que hoy tiene datos de demostración.
- **Solo lectura:** mis scripts tenían un `page.route` que abortaba todo POST, PATCH, PUT o DELETE a `/rest/v1`, `/storage/v1` y `/functions/v1`. El contador final dio **0 escrituras bloqueadas**, porque nunca hubo un intento de escritura.
- **No se guardó ninguna venta:** "Guardar venta" nunca se pulsó. Su clicabilidad se comprobó con `elementFromPoint`.
- **Lo único escrito:** un nombre de comprador de prueba, que vive solo en el estado local del formulario.
- **Sin suite E2E:** no se corrió `npm run test:e2e`.

## Escalera
| Nivel | Resultado | Evidencia |
|---|---|---|
| 1 Estático | OK | `npm run lint` sale con 0. Solo quedan los 4 avisos de siempre (main.jsx, AuthContext y un e2e); ninguno es de Ventas.jsx. `npm run build`: `✓ built in 548ms`. No hay `service_role` en `dist/` |
| 2 Unitarias | OK | `npm test`: 17 archivos y 199/199 pruebas. El cambio es solo de CSS |
| 3 E2E | NO APLICA (a propósito) | La suite está bloqueada contra producción y el encargo la prohíbe. En su lugar usé los scripts de solo lectura de quien hizo el arreglo y dos scripts míos en el scratchpad, con la sesión de demostración inyectada. Proyecto Playwright del repo: `Desktop Chrome`, 1280x720. Ahí sigue habiendo dos columnas, así que las pruebas E2E existentes no ven ningún cambio de maquetado |
| 4 Revisión crítica | OK, con un hallazgo Medio | Ver abajo |
| 5 Consola y red | OK | 0 errores de consola, 0 `pageerror` y 0 respuestas HTTP ≥ 400 en los 13 viewports |

## Evidencia de quien lo arregló: confirmada
`medir-columnas.mjs` da la columna de lotes en px. En todos los anchos, la casilla de lote y el botón quedaron en `ok`, y no hubo scroll horizontal:

| 768 | 860 | 1000 | 1024 | 1180 | 1279 | 1280 | 1366 | 1440 | 1920 |
|---|---|---|---|---|---|---|---|---|---|
| 426 | 518 | 658 | 682 | 838 | 937 | 520 | 606 | 680 | 806 |

`revisar-boton.mjs` dio `clicable:true` en 1280x720 (y=612), 1366x768 (y=660), 1440x810 (y=702), 1920x1080 y 390x844.

## Mi recorrido completo (paso 1, luego 2, luego 3 y Atrás), con clics reales salvo en Guardar
| Viewport | Cols / panel | Columna de lotes | Casilla "Levante" | Confirmar (paso 1) | Atrás / Siguiente (paso 2) | Guardar (paso 3, habilitado) | scrollX |
|---|---|---|---|---|---|---|---|
| 375x812 táctil | 1 / static | 339 | ok | barra fija ok | ok / ok | ok, true | 0 |
| 390x844 táctil | 1 / static | 354 | ok | barra fija ok | ok / ok | ok, true | 0 |
| 767x1024 | 1 / static | 731 | ok | barra fija ok | ok / ok | ok, true | 0 |
| 768x1024 | 1 / static | 426 | ok | ok, sin solapar el panel | ok / ok | ok, true | 0 |
| 820x1180 | 1 / static | 478 | ok | ok | ok / ok | ok, true | 0 |
| 1000x800 | 1 / static | 658 | ok | ok | ok / ok | ok, true | 0 |
| 1024x768 | 1 / static | 682 | ok | ok | ok / ok | ok, true | 0 |
| 1180x820 | 1 / static | 838 | ok | ok | ok / ok | ok, true | 0 |
| 1279x720 | 1 / static | 937 | ok | ok | ok / ok | ok, true | 0 |
| 1280x720 | 2 / sticky | 520 | ok | ok | ok / ok | ok, true | 0 |
| 1366x768 | 2 / sticky | 606 | ok | ok | ok / ok | ok, true | 0 |
| 1440x810 | 2 / sticky | 680 | ok | ok | ok / ok | ok, true | 0 |
| 1920x1080 | 2 / sticky | 806 | ok | ok | ok / ok | ok, true | 0 |

Detalles del recorrido:
- **"Atrás" en el paso 3:** devuelve al paso 2 en todos los anchos.
- **Celular:** el botón de la barra fija lleva al paso 2 (`max-md`/`md:hidden`, sin cambios). Cuando la barra fija pasa por encima del panel durante el scroll en el celular, es lo esperado y no hay regresión.
- **Desde 1280 px:** el panel queda a la derecha (x≈934 a 1366) y los botones en la columna izquierda. Es el arreglo anterior y sigue intacto.
- **Capturas de 768 y 1024 (pasos 1, 2 y 3):** el orden es tarjetas, luego panel, luego Cancelar/Atrás a la izquierda y la acción principal a la derecha. El panel ocupa todo el ancho sin descuadrarse ("Comisiones y transporte" baja a su propia línea a 768) y no hay solapamientos.

## Hallazgos (de mayor a menor severidad)

### [Medio] Entre 768 y 1279 px no se ve el beneficio neto mientras se marcan lotes
- **Dónde:** `src/pages/Ventas.jsx:423` (el panel ya no es sticky por debajo de xl) y `:454` (la barra fija con "Beneficio neto" es `md:hidden`).
- **Reproducir:** abrir `#/ventas/nueva`, marcar "Levante" y medir el `top` del rótulo "BENEFICIO NETO" con `scrollY=0`:

  | Viewport | Al cargar | Con un lote abierto ("Elegir animales") |
  |---|---|---|
  | 768x1024 | 1309 | 1454 |
  | 1024x768 | 1169 | 1314 |
  | 1180x820 | 1169 | 1314 |
  | 1279x720 | 1169 | 1314 |

  En todos los casos queda por debajo del borde inferior de la pantalla. Esto pasa con solo 2 lotes de demostración; con más lotes baja todavía más.
- **Esperado vs. obtenido:** R2 de la spec 025 pide el resultado a la derecha en escritorio o "pegado al fondo de la pantalla" en el celular. En la franja 768–1279 no pasa ninguna de las dos cosas: hay que bajar para ver cuánto queda limpio después de cada casilla.
  - En 768–1000 esto es mucho mejor que antes, cuando la columna medía de 8 a 264 px y no se podía hacer clic.
  - En **1000–1279** sí es un retroceso: antes había dos columnas (unos 322 px de columna a 1024 y unos 466 px a 1180) con el panel sticky a la vista. Ahora el panel queda abajo y no hay barra fija.
- **Por qué importa:** en una tableta horizontal (1024 o 1180) o en una ventana partida, Miguel marca lotes sin ver el resultado y tiene que bajar y subir para comparar.
  - No bloquea, porque el flujo funciona completo y sin errores.
  - Ningún portátil común queda en esta franja: 1280, 1366, 1440 y 1536 tienen dos columnas.
  - Arreglo posible (que no me toca a mí): mostrar la barra fija también en esta franja (`xl:hidden` en lugar de `md:hidden`, con su `pb-24`) y ajustar el `max-md:hidden` del botón del formulario para no duplicar "Confirmar venta".

## Sospechas no confirmadas
- **Beneficio neto también fuera de pantalla a 1280x720 al cargar** (top=821 sobre 720): el panel mide unos 620 px. El sticky lo sube al desplazarse, pero el recorrido sticky está limitado a la altura de la fila de tarjetas. Es previo a este cambio, porque la línea 423 solo cambió `md` por `xl`. No lo medí en detalle.

## Lo que no se verificó y por qué
- **No se guardó ni se confirmó ninguna venta**, porque la base es producción. No se corrió la suite E2E.
- **Solo se probó en Chrome** (Playwright `channel: 'chrome'`, con emulación táctil en 375 y 390). No se probó en Safari iOS ni Firefox. El cambio es CSS Grid estándar con breakpoints de Tailwind, así que el riesgo es bajo.
- **No probé con muchos lotes** (la demostración tiene 2). El hallazgo Medio empeora con más lotes, pero la clicabilidad no depende de eso.
- **Scripts y capturas:** quedaron en el scratchpad de la sesión (`verif2.mjs`, `verif3.mjs`, `v2-*.png`), no en el repo.

## Veredicto
**APROBADO.**
- Resuelve el bug: la columna de lotes mide ≥ 426 px y la casilla y los botones son clicables entre 768 y 1279.
- Mantiene el arreglo anterior a 1280x720, 1366x768 y 1440x810.
- No cambia el celular (barra fija en 375 y 390).
- Los pasos 2 y 3 funcionan en una columna en los anchos intermedios, sin scroll horizontal ni errores de consola o red.
- Queda un hallazgo Medio: no se ve el beneficio neto en 768–1279 y hay un retroceso de comodidad en 1000–1279. Conviene anotarlo como deuda.
