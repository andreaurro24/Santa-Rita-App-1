# Spec 022 — Animales y lotes en una sola página

- Estado: en-verificacion
- Sprint: 6
- Módulos del plan: M2, M3

## Contexto
Hoy los animales y los lotes están en páginas distintas y los lotes quedan escondidos en "Más". El
equipo quiere verlos juntos, como en el "Inventario de hato" del proyecto de referencia:
- Los grupos arriba.
- Una tabla clara con foto, nombre, pesos y precio.
- Los botones Crear lote, Editar lotes y Añadir animal a la mano.

La meta de peso se quita del lote, porque es de cada animal.

## Requisitos (EARS)
- R1 — La página **Animales** deberá mostrar, arriba, una fila de tarjetas de lote, que se desliza
  de lado en el celular. Cada tarjeta lleva:
  - nombre;
  - cabezas activas;
  - peso promedio;
  - "Al partir" si aplica.

  Hay una tarjeta "Todos" al inicio. Tocar una tarjeta filtra la tabla por ese lote, y la URL lo
  recuerda (`?lote=`).
- R2 — Arriba a la derecha (abajo del título en el celular) deberán estar **Añadir animal**,
  **Crear lote** y **Editar lotes**.
  - "Crear lote" abre el mismo formulario de hoy, sin la meta de peso.
  - "Editar lotes" abre una lista de los lotes con editar, ver detalle (costos y mover animales)
    y, si está vacío, cerrar.
- R3 — En escritorio, la tabla deberá tener, en este orden:

  | Columna | Contenido |
  |---|---|
  | Animal | Miniatura, nombre y estado con un punto de color |
  | Chapeta ICA | |
  | Lote | |
  | Raza | |
  | Peso actual | |
  | Peso inicial | |
  | Precio por kg | De compra |
  | Dueño | |

  Se puede ordenar por animal, peso actual, peso inicial y precio. El conteo va abajo ("1–20 de 34
  animales"), con páginas de 20. *Corrección r1 (M1): para que la tabla quepa sin desplazarse,
  la chapeta tiene columna desde 1280 px y la raza y el dueño desde 1536 px; en pantallas más
  angostas esos datos se muestran debajo del nombre del animal.*
- R4 — En el celular, cada animal deberá verse como una tarjeta con:
  - miniatura;
  - nombre;
  - lote;
  - peso actual y peso inicial;
  - avisos ("Pierde peso", "Al partir", estado).
- R5 — El buscador deberá encontrar por nombre, chapeta, dueño o raza, y deberá haber filtros de
  **estado** (activos, vendidos, de baja, todos; por defecto activos) y de **lote**, como en la
  referencia.
- R6 — El formulario de lote ya no deberá pedir la meta de peso. La meta y el avance del lote se
  calculan con el promedio de los pesos objetivo de sus animales, y si ninguno tiene objetivo se
  muestra "Sin meta". La columna `peso_meta_kg` queda en la base de datos sin usar.
- R7 — La entrada "Lotes" deberá salir del menú. `/lotes` deberá llevar a `/animales`, y
  `/lotes/:id` seguirá abriendo el detalle del lote (costos, mover animales), con "Volver a
  Animales".
- R8 — La pestaña **Caballos** deberá seguir, con la misma tabla sin las columnas de lote ni pesos.

## Fuera de alcance
- Columnas de collar o batería de la referencia: la finca no usa collares.
- Mover animales arrastrándolos entre tarjetas de lote.

## Diseño
- Datos: sin cambios de esquema. `useGuardarLote` deja de enviar `peso_meta_kg`, y los lotes ya
  creados conservan el valor guardado, pero se ignora.
- Dominio: `resumenLote` toma la meta solo de los animales (quitar `lote.pesoMeta ??`) y se
  actualizan sus pruebas. `ordenarAnimales(lista, campo, dir)` y `paginar` se prueban aparte.
- UI:
  - `src/pages/Animals.jsx` se reorganiza en `TarjetasLote`, `BarraFiltros`, `TablaAnimales` y
    `TarjetasAnimal`.
  - `LoteForm` y `EditarLotes` se mueven de `Lotes.jsx` a `src/components/LoteForm.jsx`.
  - `LoteDetalle` se queda en `Lotes.jsx`.
- Estilo: el de la referencia, con los colores y tamaños actuales de la app.
  - Encabezados en versalitas pequeñas sobre un fondo suave.
  - Filas de 64 px.
  - Estado con un punto de color: activo verde, de baja rojo, vendido gris.
  - Botón principal relleno y los secundarios con borde.
  - Las tarjetas de lote seleccionadas, con borde de marca.
- Decisión clave: lotes arriba y tabla abajo (elegido por el usuario el 2026-10-05). Se descartó
  la tabla sola, porque se perdía el resumen del lote de un vistazo.

## Tareas
- [x] T1 `resumenLote` sin meta del lote y pruebas; ordenar y paginar — verifica: `npm test`
- [x] T2 Tarjetas de lote, filtros, tabla, tarjetas en el celular y botones — verifica: E2E en 375 y 1280 px
- [x] T3 Formulario de lote sin meta y "Editar lotes"; menú y redirección de `/lotes` — verifica: E2E (crear un lote desde Animales, filtrar por él, abrir su detalle)
- [x] T4 Actualizar las pruebas E2E que entraban por `/lotes` — verifica: `npm run test:e2e`. *Actualizadas las del equipo (lotes, miguel, decision, indicadores) y escrita `sprint06.spec.js`; no se pueden correr sin proyecto de pruebas (DT-05-1). Las del verificador de sprints anteriores que usan `/lotes` o el asistente viejo quedan como DT-06-1.*

## Criterios de aceptación para el verificador
- Desde Animales se crea un lote sin meta, se registra un animal en él con objetivo 450 kg, y la
  tarjeta del lote muestra 1 cabeza y su peso promedio; el detalle del lote, meta 450 kg.
- El filtro de lote sobrevive a recargar la página.
- A 375 px no hay desplazamiento horizontal de la página y todos los controles miden 48 px o más.

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-10-05 ("Aprobo. Construye todo de una.")
