# Verificación ronda 2 del bug "Simulador inutilizable entre 768 y ~1000 px" (sin spec): APROBADO

Esta ronda revisa el arreglo del hallazgo Medio de la ronda 1 (`bug-simulador-tableta-2026-10-06.md`): entre 768 y 1279 px no se veía el beneficio neto mientras se marcan lotes.

Cambio verificado (`git diff` sin commit en `src/pages/Ventas.jsx`):
- **Contenedor:** pasa a `pb-24 xl:pb-0` (línea 311).
- **"Confirmar venta" del formulario:** se oculta con `max-xl:hidden` cuando hay animales marcados (línea 440).
- **Barra fija:** pasa a `md:bottom-0 md:left-60 xl:hidden` (línea 455).
- **Ronda 1, sin cambios:** se mantienen la grilla `xl:`, el panel `xl:sticky` y la fila de botones `xl:col-start-1`.

## Entorno y condiciones
- **Fecha:** 2026-10-06.
- **Servidor:** desarrollo en http://localhost:5173, contra la BD de **producción**, que hoy tiene datos de demostración.
- **Solo lectura:** mi script abortaba todo POST, PATCH, PUT o DELETE a `/rest/v1`, `/storage/v1` y `/functions/v1`. Resultado: **ESCRITURAS BLOQUEADAS: 0**, porque nunca hubo un intento.
- **No se guardó ninguna venta:** nunca se pulsó "Guardar venta". Su clicabilidad se midió con `elementFromPoint`.
- **Lo único escrito:** el nombre "Comprador de prueba", que vive solo en el estado local del formulario.
- **Sin E2E:** no se corrió la suite.

## Escalera
| Nivel | Resultado | Evidencia |
|---|---|---|
| 1 Estático | OK | `npm run lint`: sale con 0 y solo muestra los 4 avisos de siempre (e2e pasto, AuthContext x2, main.jsx); ninguno es de Ventas.jsx. `npm run build`: `✓ built in 635ms`. `grep service_role dist/`: nada |
| 2 Unitarias | OK | `npm test`: 17 archivos y 199/199 pruebas. El cambio es solo de CSS |
| 3 E2E | NO APLICA (por encargo) | Producción, sin suite. En su lugar corrí `medir-beneficio.mjs` (de quien arregló) y mi script `r2.mjs` (en el scratchpad) en 12 viewports |
| 4 Revisión crítica | OK | Ver la tabla y las notas de abajo |
| 5 Consola y red | OK | 0 errores de consola, 0 `pageerror` y 0 respuestas HTTP ≥ 400 en los 12 viewports |

## Evidencia de quien lo arregló: confirmada
`medir-beneficio.mjs` probó 390x844, 768x1024, 1024x768, 1180x820, 1279x720, 1280x720, 1366x768 y 1920x1080. En todos dio:
- `beneficioArriba:true`
- `confirmarRenderizados:1`
- `scrollX:false`
- `clic ok`

## Mi recorrido
Pasos del recorrido:
1. Marcar "Levante" y abrir "Elegir animales".
2. Medir arriba y al fondo de la página.
3. Pulsar "Confirmar venta" para ir al paso 2.
4. Llenar el comprador y pulsar "Siguiente" para ir al paso 3.
5. Medir "Guardar venta" sin pulsarlo.
6. Pulsar "Atrás".

| Viewport | Barra (izq–der, arriba–abajo) | Menú inferior / lateral | Confirmar visibles | Holgura bajo "Cancelar" al fondo | Barra en pasos 2 y 3 | Guardar (habilitado, clicable) | Atrás | scrollX |
|---|---|---|---|---|---|---|---|---|
| 375x812 táctil | 0–375, 663–740 | menú inferior arriba en 739 | 1, clicable | 131 px | no / no | sí, sí | paso 2 | no |
| 390x844 táctil | 0–390, 695–772 | menú inferior arriba en 771 | 1, clicable | 131 px | no / no | sí, sí | paso 2 | no |
| 767x1024 | 0–767, 875–952 | menú inferior arriba en 951 | 1, clicable | 131 px | no / no | sí, sí | paso 2 | no |
| 768x1024 | 270–768, 951–1024 | menú lateral hasta 270 | 1, clicable | 93 px | no / no | sí, sí | paso 2 | no |
| 820x1180 | 270–820, 1107–1180 | menú lateral hasta 270 | 1, clicable | 93 px | no / no | sí, sí | paso 2 | no |
| 1024x768 | 270–1024, 695–768 | menú lateral hasta 270 | 1, clicable | 94 px | no / no | sí, sí | paso 2 | no |
| 1180x820 | 270–1180, 747–820 | menú lateral hasta 270 | 1, clicable | 94 px | no / no | sí, sí | paso 2 | no |
| 1279x720 | 270–1279, 647–720 | menú lateral hasta 270 | 1, clicable | 94 px | no / no | sí, sí | paso 2 | no |
| 1280x720 | sin barra | menú lateral hasta 270 | 1 (formulario) | 58 px | no / no | sí, sí | paso 2 | no |
| 1366x768 | sin barra | menú lateral hasta 270 | 1 (formulario) | 58 px | no / no | sí, sí | paso 2 | no |
| 1440x810 | sin barra | menú lateral hasta 270 | 1 (formulario) | 58 px | no / no | sí, sí | paso 2 | no |
| 1920x1080 | sin barra | menú lateral hasta 270 | 1 (formulario) | 58 px | no / no | sí, sí | paso 2 | no |

Cómo leer la tabla y qué confirma:
- **Por qué 270 px y no 240:** la raíz de la app está a 18 px, así que `w-60` y `left-60` miden 270 px las dos. La barra empieza justo donde termina el menú lateral, sin solaparlo ni dejar hueco.
- **Celular:** la barra sigue encima del menú inferior. Su borde inferior (740) coincide con el borde superior del menú (739); el píxel de diferencia es el `border-t` del menú.
- **No tapa la fila de botones ni el contenido final:**
  - Al fondo de la página, entre "Cancelar" y el borde superior de la barra quedan 93–94 px en tableta y 131 px en celular.
  - "Cancelar" responde al clic (`elementFromPoint`) en todos los anchos.
  - El panel termina antes que la fila de botones.
  - Esto se midió con el lote abierto, que es el caso con la página más larga.
- **Sin nada marcado:** no hay barra y el único "Confirmar venta" es el del formulario. Con lotes marcados, por debajo de xl sale solo el de la barra y, desde xl, solo el del formulario. Nunca hay dos.
- **Pasos 2 y 3:** no hay barra en ningún ancho.
- **Arreglos anteriores, intactos:** en 1280, 1366 y 1440 "Confirmar venta" del formulario recibe el clic y lleva al paso 2. En 768–1279 la columna de lotes sigue a ancho completo.
- **Capturas** (`r2-375x812-fondo.png`, `r2-768x1024-fondo.png`, `r2-1024x768-fondo.png`, `r2-1024x768-paso3.png` en el scratchpad):
  - Barra al fondo junto al menú lateral, con "Beneficio neto $1.156.250" y el mismo valor que el panel.
  - "Cancelar" queda visible encima de la barra.
  - En el paso 3 no hay barra y "Atrás" y "Guardar venta" están en su fila.

## Hallazgos
Ninguno Crítico, Alto ni Medio.

### [Bajo] Espacio en blanco de 96 px al final en los pasos 2 y 3 por debajo de xl
- **Dónde:** `src/pages/Ventas.jsx:311`. El `pb-24` se aplica siempre, aunque la barra solo existe en el paso 1 con lotes marcados.
- **Efecto:** en tableta (768–1279), en los pasos 2 y 3 y en el paso 1 sin nada marcado, queda un margen vacío de 96 px debajo de los botones. Es puramente estético y no tapa nada. En el celular pasaba igual antes de este cambio.
- **Posible ajuste (no me toca):** condicionar el `pb-24` a que se muestre la barra.

## Sospechas no confirmadas
- **Zona segura del iPad:** con `md:bottom-0` la barra no suma `env(safe-area-inset-bottom)`. Hoy no afecta, porque `index.html:6` no declara `viewport-fit=cover` y ese valor es 0. Si algún día se añade `viewport-fit=cover`, el botón podría quedar bajo el indicador de inicio del iPad.

## Lo que no se verificó y por qué
- **Ninguna venta guardada ni E2E:** la base es producción.
- **Solo Chrome** (Playwright `channel: 'chrome'`, con emulación táctil en 375 y 390). Sin Safari iOS/iPadOS ni Firefox.
- **Solo 2 lotes de demostración:** como la barra es `fixed`, su visibilidad no depende de cuántos lotes haya.

## Veredicto
**APROBADO.**
- El hallazgo Medio de la ronda 1 queda resuelto: entre 768 y 1279 px el beneficio neto y un único "Confirmar venta" clicable quedan siempre a la vista, al fondo y a la derecha del menú lateral.
- La barra no tapa la fila de botones ni el contenido final.
- En el celular sigue encima del menú inferior.
- Los pasos 2 y 3 no muestran la barra.
- Los arreglos anteriores siguen bien desde 1280 px.
- Lint, build y las 199 pruebas pasan.
- No hubo errores de consola ni de red, y no se intentó ninguna escritura.
