# Sprint 05 — La app de Miguel

- Estado: cerrado
- Inicio: 2026-10-04 · Cierre: 2026-10-04
- Aprobación del plan: [x] Andrés Sánchez aprobó en el chat, el 2026-10-04, el plan v2 (bloques 1–7),
  los cambios de base de datos y las decisiones: producción = proyecto actual limpio; dueño escrito o
  elegido de los existentes; "Eliminar" para errores y "Dar de baja" para lo demás; precios de
  referencia cargados por el implementador y ajustables. Pidió hacer todos los bloques sin pedir más
  aprobaciones.

## 1. Plan

### Objetivo
Una app sencilla para Miguel (60 años), con datos limpios y lo que él y Juan pidieron tras la primera
demostración (ver `docs/retroalimentacion.md`).

### Alcance
| Spec | Bloque | Estado |
|---|---|---|
| [014 — Base limpia, guardas y bitácora](../specs/014-base-limpia/spec.md) | 1 | hecha |
| [015 — Simplificar para Miguel](../specs/015-simplificar/spec.md) | 2 | hecha |
| [016 — Animales: editar, baja, dueño, vientres, compra y caballos](../specs/016-animales-v2/spec.md) | 3 | hecha |
| [017 — Fotos de los animales](../specs/017-fotos/spec.md) | 3 | hecha |
| [018 — Dinero con miles y nombres válidos](../specs/018-datos-bien-escritos/spec.md) | 4 | hecha |
| [019 — Ventas más claras](../specs/019-ventas-claras/spec.md) | 6 | hecha |
| [020 — Fincas, lotes y gastos de finca](../specs/020-fincas-lotes-gastos/spec.md) | 5 | hecha |
| [021 — Precio del ganado por zona y categoría](../specs/021-precios-zona/spec.md) | 7 | hecha |

### Fuera de alcance
- Proyecto de Supabase separado para pruebas: la organización llegó al límite de 2 proyectos gratis
  por miembro (`create_project` lo rechazó) y no hay Docker en el equipo para Supabase local.
- Lectura automática de precios desde internet (las fuentes bloquean la lectura o no publican Cesar).

### Riesgos
| Riesgo | Mitigación |
|---|---|
| Las pruebas E2E escriben en la base que usará Miguel | Se verifica todo antes de limpiar; al final se limpia producción y se bloquean el script de datos de ejemplo y Playwright contra producción |
| Muchos cambios a la vez en el modelo de animales | Una sola migración (1700) con constraints; los caballos se filtran en `useHato` para que el resto de módulos no cambie |

### Definición de hecho
- Specs 014–021 en `hecha` con `APROBADO`; lint, build y pruebas en verde; commits y push en `main`.

## 2. Bitácora
| Fecha | Spec / tarea | Resultado | Notas y desvíos |
|---|---|---|---|
| 2026-10-04 | 014 · T1–T3 | Bitácora del cliente, guardas en `scripts/proyectos.mjs` (seed y Playwright), DEPLOY y README | **Desvío:** no se pudo crear el proyecto de pruebas (límite de 2 proyectos gratis por miembro; sin Docker). Se verifica en producción antes de limpiarla, con la excepción temporal `E2E_PERMITIR_PRODUCCION=si`, que se quita en T4 |
| 2026-10-04 | 014 · limpieza parcial | Borrados 1 animal, 1 pesaje, 1 gasto y 1 lote de la demostración del equipo ("DROGA Xxx bla bla", chapeta 111111) | Alteraban las pruebas (lote de 31 en vez de 30); parte de la limpieza aprobada |
| 2026-10-04 | 015–021 | Migración 1700; menú de 4, Inicio con accesos, letra de 18 px; animales v2 y caballos; fotos; CampoPesos y nombres válidos; asistente de venta en 3 pasos; fincas, lotes y gastos de finca; precios por zona | Paquete inicial 434 kB. Los rangos iniciales de precio son estimados "por validar" |
| 2026-10-04 | Correcciones r2 | M1-r2 (CampoPesos con `beforeinput` nativo y bloqueo tras un punto o una coma), Enter en el asistente, estado vacío de venta, tabla a 1280 px, color en la ficha, error al reactivar, controles de 48 px a tamaño completo | La prueba `verificador-sprint05-r2.spec.js:374` falla en grupo y pasa sola: aislamiento entre las pruebas del verificador (DT-05-6) |
| 2026-10-04 | 014 · T4 | Producción limpia: solo "Finca Santa Rita", 5 rangos de precio y los usuarios del equipo; se borró el usuario de prueba y la excepción de las pruebas | Las protecciones se comprobaron: suite y seed se niegan aunque se pase `E2E_PERMITIR_PRODUCCION=si` |
| 2026-10-04 | Correcciones r1 | A1 (doble toque guardaba la venta), A2 (color del ganado), M1 (montos alterados en silencio), M2/M3 (finca y tenedor: atómico con `guardar_finca`, sin quitarle la finca a otro tenedor), M4 (Pesaje vacío), M6 (caballo sin lote ni pesajes en la base), B1–B4, B6–B9; migración 1800 | B5 (miniaturas con la foto completa) queda como deuda: la transformación de imágenes de Supabase es de pago |

## 3. Verificación
| Spec | Ronda | Veredicto | Reporte |
|---|---|---|---|
| 014–021 | 1 | 015, 017, 018, 020, 021 APROBADO; 016 y 019 RECHAZADO (A2, A1); 014 RECHAZADO (README) y R1 BLOQUEADO hasta T4 | [sprint05-2026-10-04](../reports/verificacion/sprint05-2026-10-04.md) |
| 014–021 | 2 | 015–021 APROBADO; 014 BLOQUEADO solo por R1 (limpieza T4, hecha después) | [sprint05-2026-10-04-ronda2](../reports/verificacion/sprint05-2026-10-04-ronda2.md) |

## 4. Cierre

**Cerrado el 2026-10-04:** las specs 014 a 021 están `hecha`. 015–021 se aprobaron en la ronda 2; la
014 quedó bloqueada solo por su R1 (limpiar producción), que se hizo después del veredicto.

### Retroalimentación
- **Funcionó:**
  - Escribir la bitácora del cliente primero y mapear cada pedido a una spec: nada del audio ni de
    las notas quedó por fuera.
  - Un módulo de dominio por regla nueva (animales, precios, validar) con pruebas antes de la UI.
  - El verificador encontró lo que una persona de 60 años sufriría: el doble toque que guardaba una
    venta y los montos que cambiaban en silencio.
- **No funcionó:**
  - Verificar en producción por no tener proyecto de pruebas: obligó a una excepción temporal y a
    limpiar al final. Con un proyecto de pruebas no habría hecho falta.
  - El campo de pesos necesitó dos rondas: filtrar caracteres en `onChange` no basta; hay que
    decidir en `beforeinput` qué significa cada tecla.
  - Ocultar controles con `sr-only` choca con la regla de 48 px; mejor el control invisible a tamaño
    completo encima de su etiqueta.
- **Cambiar en el siguiente sprint:**
  - Conseguir el proyecto de pruebas antes de tocar código (DT-05-1).
  - Probar cada formulario con doble toque, Enter y pegado desde el primer día.

### Deuda
| ID | Descripción | Severidad | Origen | Sprint destino |
|---|---|---|---|---|
| DT-05-1 | No hay proyecto de Supabase de pruebas: la suite E2E y `db:seed` no pueden correr hasta crearlo (límite de proyectos gratis; ver DEPLOY.md) | Alta | 014 | Humano |
| DT-05-2 | Los rangos de precio iniciales son estimados "por validar": Miguel debe ajustarlos con precios reales de la zona | Media | 021 | Humano |
| DT-05-3 | Las miniaturas descargan la foto completa (hasta 1 MB); la transformación de imágenes de Supabase es de pago | Baja | 017 (B5) | 6 |
| DT-05-4 | Usuarios con correos de ejemplo (`miguel@ejemplo.com` sin perfil y `correo-de-miguel@ejemplo.com` con perfil `dueno`): la cuenta real de Miguel debe usar su correo | Media | Revisión de usuarios | Humano |
| DT-05-5 | Los caballos se venden por la función `vender_equino`, pero no aparecen en la lista de ventas ni en los indicadores | Baja | 016 | 6 |
| DT-05-6 | `verificador-sprint05-r2.spec.js:374` depende del orden: falla en grupo y pasa sola | Baja | Verificación r2 | 6 |

### Información importante
- **Decisiones:**
  - Producción = proyecto `eiszvbwwpqcqognkcfew`, limpio desde el 2026-10-04.
  - El dueño de cada res es texto libre con sugerencias (no una tabla aparte).
  - Los vientres son tres categorías; los caballos son `especie = 'equino'` en la misma tabla.
  - Gastos de finca: no se reparten entre los animales.
  - Precio por animal: punto medio del rango de su categoría (levante < 350 kg ≤ gordo).
- **Recursos creados:** migraciones 1700 y 1800; bucket privado `fotos-animales`; tabla
  `precios_referencia`; funciones `vender_equino` y `guardar_finca`.
- **Comandos nuevos:** ninguno. `npm run db:seed` y `npm run test:e2e` exigen `PROYECTO_PRUEBAS`.
- **Gotchas:**
  - Para cancelar una tecla en un campo hay que usar el evento nativo `beforeinput`; el
    `onBeforeInput` de React no siempre la cancela.
  - Una consulta de TanStack deshabilitada se queda `isPending`: no envolverla en `ConDatos`.
  - PostgREST devuelve como objeto (no lista) una relación con llave única (`ventas_equinos`).

### Para el siguiente sprint
- Antes de que Miguel cargue sus animales: confirmar su cuenta real (DT-05-4) y los precios (DT-05-2).
- Crear el proyecto de pruebas (DT-05-1) para poder seguir verificando sin tocar producción.
