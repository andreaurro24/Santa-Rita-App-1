# Sprint 06 — Como la referencia: hato en una página, fichas completas y simulador

- Estado: en-verificacion
- Inicio: 2026-10-05 · Cierre: —
- Aprobación del plan: [x] Andrés Sánchez el 2026-10-05 ("Aprobo. Construye todo de una. Doy permisos de todo.")

## 1. Plan

### Objetivo
Miguel ve sus lotes y animales en una sola página. Registra cada animal con nombre y número, raza,
nacimiento, tres pesos, compra explicada y una foto cuadrada tomada con el celular. Simula una venta
de uno o varios lotes, con comisiones, antes de confirmarla.

### Alcance
| Spec | Módulos | Estado |
|---|---|---|
| [023 — Registro del animal: nombre, raza, nacimiento, tres pesos y compra didáctica](../specs/023-ficha-animal-v3/spec.md) | M2 | en-verificacion |
| [024 — Fotos desde el celular, recortadas en cuadrado](../specs/024-fotos-cuadradas/spec.md) | M2 | en-verificacion |
| [022 — Animales y lotes en una sola página](../specs/022-hato-y-lotes/spec.md) | M2, M3 | en-verificacion |
| [025 — Simulador de venta por lotes y venta de varios lotes](../specs/025-simulador-venta/spec.md) | M10, M11 | en-verificacion |

### Fuera de alcance
- Collares y baterías del proyecto de referencia.
- Genealogía y partos.
- Galería de varias fotos.
- Precio distinto por lote dentro de una venta.
- Venta de caballos en la lista de ventas (DT-05-5).

### Deuda que se arrastra
- DT-05-3 (miniaturas pesadas): entra en la spec 024.
- DT-05-1 (proyecto de pruebas): **requisito para verificar**. Ver Riesgos.
- DT-05-5 y DT-05-6 quedan para después.

### Orden de ejecución
1. 023: el formulario y los datos nuevos (raza, nacimiento, pesos) los usan la tabla y el simulador.
2. 024: el campo de foto vive en el mismo formulario.
3. 022: la página nueva muestra las columnas que crean 023 y 024 (raza, miniatura, peso inicial).
4. 025: el simulador usa los pesos y los lotes ya ordenados; es el cambio de base más grande.

Las dos partes de la migración 1900 (A en 023, B en 025) se aplican juntas en un solo archivo antes
de empezar la 023. Producción no tiene animales ni ventas, así que no hay datos que convertir.

### Riesgos
| Riesgo | Mitigación |
|---|---|
| No hay proyecto de pruebas (DT-05-1): las E2E no pueden correr y las guardas impiden usar producción | Crear el proyecto de pruebas antes de verificar. Mientras tanto se implementa con pruebas unitarias y SQL de prueba dentro de transacciones que se deshacen (`begin … rollback`) |
| Pellizcar para hacer zoom se comporta distinto en cada celular | El control deslizante hace lo mismo; probar en Chrome Android emulado y Safari |
| La venta de varios lotes toca Al partir, el reporte y el margen esperado | Pruebas de dominio de los casos de 1 y 2 lotes antes de tocar la UI; la RPC vieja se elimina en la misma migración para que nada la use a medias |
| Miguel ya empezó a cargar animales en producción | La migración solo agrega columnas opcionales y cambia `ventas` (hoy vacía); se revisa el conteo antes de aplicarla |

### Definición de hecho
- Las 4 specs en `hecha` con veredicto `APROBADO` del verificador.
- `npm run lint`, `npm run build`, `npm test` y `npm run test:e2e` pasan (en el proyecto de pruebas).
- Commits en `main` y push a los dos remotos; Vercel en READY.
- `docs/plan.md`, `specs/README.md` y `docs/retroalimentacion.md` actualizados.

## 2. Bitácora
| Fecha | Spec / tarea | Resultado | Notas y desvíos |
|---|---|---|---|
| 2026-10-05 | Migración 1900 (A y B) | Aplicada en producción (0 animales y 0 ventas). SQL de prueba dentro de un bloque que se deshace: dos pesajes con peso actual, rechazo de raza rara, día ≠ 1 y peso actual con ingreso hoy; venta de 2 lotes que cierra solo el que queda vacío | `registrar_venta` vieja eliminada en la misma migración. Advisors: solo el aviso conocido de contraseñas filtradas |
| 2026-10-05 | 023 · T1–T4 | Dominio con pruebas (nombre con número, razas, nacimiento, cuenta de la compra); formulario y ficha; "Número interno" → "Nombre" en la UI, la importación y los mensajes | La columna sigue siendo `numero_interno`. El selector de compra dice "Compré por kilo / por animal" para no chocar con las etiquetas de los precios |
| 2026-10-05 | 024 · T1–T4 | Recortador propio (arrastre, pellizco, rueda, deslizador, girar), foto de 800 px + miniatura de 200 px, limpieza de pares, listas con miniatura (cierra DT-05-3) | `useDialogo` ahora apila diálogos: solo el de arriba responde a Escape y Tab |
| 2026-10-05 | 022 · T1–T4 | Animales y lotes en una página: tarjetas de lote, filtros de estado y lote en la URL, tabla ordenable y paginada, tarjetas en celular, "Crear lote" y "Editar lotes"; `/lotes` redirige; meta del lote = promedio de sus animales | A 1280 px la chapeta se ve desde `xl` y raza y dueño desde `2xl` para que la tabla quepa |
| 2026-10-05 | 025 · T1–T5 | Simulador con lotes, animales sueltos, panel con valor bruto, costos, comisiones, tenedores, beneficio y margen; datos y confirmación; venta de varios lotes; lista y detalle por lotes | La recomendación guardada en una venta de varios lotes es la más repetida entre sus lotes y el margen esperado es la suma |
| 2026-10-05 | Prueba en el navegador | Con un usuario temporal en producción (vacía): registrar Luna-001 con raza, nacimiento sin mes, 250 → 310 kg en 60 días, compra $9.000 × 250 kg y foto 4000×3000 recortada (20 KB + 4 KB); simular y vender 2 lotes con $300.000 de transporte (una sola venta pese al doble toque, números iguales en el detalle); cambiar la foto 3 veces deja 2 archivos; eliminar el animal borra sus 2 archivos | Al terminar se borraron el usuario, los lotes, los animales, la venta y las fotos: producción quedó como estaba. Sin proyecto de pruebas no corre la suite E2E (DT-05-1) |
| 2026-10-05 | Correcciones r1 | A1: "Ventas del contrato" en Al partir con lotes, parte de las comisiones y pago (el reporte, que es antes de vender, salió de R8). M1: chapeta, raza y dueño bajo el nombre cuando su columna no cabe. M2: el margen esperado es el beneficio simulado de esos animales. M3: casilla del lote con área de 48 px. M4: pruebas del equipo con la RPC nueva y "Añadir animal". B1: nacimiento ≤ ingreso (cliente y migración 2000). B2: "por animal" en la cuenta. B3: "Confirmar venta" en la barra del celular. B5: pesos desde 1 kg. B7: kilos con 1 decimal también en el simulador. S1: la X de los diálogos es `type="button"`. S2–S4: selectores únicos en las E2E nuevas | B4 y B6 pasan a deuda (DT-06-2, DT-06-3) |

## 3. Verificación
| Spec | Ronda | Veredicto | Reporte |
|---|---|---|---|
| 022–025 | 1 | 022 RECHAZADO (M1 y E2E), 023 BLOQUEADO (E2E), 024 BLOQUEADO (E2E), 025 RECHAZADO (A1) | [sprint06-2026-10-05](../reports/verificacion/sprint06-2026-10-05.md) |

## 4. Cierre
