# Spec 016 — Animales: editar, baja, dueño, vientres, compra y caballos

- Estado: en-progreso
- Sprint: 5
- Módulos del plan: M2 (sustituye en parte a la spec 003, que nunca se escribió)

## Contexto
Tras la primera revisión, Miguel y Juan pidieron editar y borrar animales, anotar el dueño de cada
res, distinguir los tipos de vientre, no obligar el peso objetivo, registrar la compra por kilo o por
animal y llevar también los caballos.

## Requisitos (EARS)
- R1 — El sistema deberá permitir editar, desde la ficha, el número, la chapeta, el sexo, la
  categoría, el origen, la fecha de nacimiento, el peso objetivo, la compra, el dueño y el color.
  El peso y la fecha de ingreso no se editan (son el primer pesaje).
- R2 — "Eliminar" deberá borrar un animal registrado por error, con confirmación, junto con su
  historial y su foto. Si el animal ya está en una venta, la base de datos deberá impedirlo y la app
  deberá ofrecer "Dar de baja".
- R3 — "Dar de baja" deberá marcar un animal como muerto o perdido, con fecha (no futura ni anterior
  al ingreso) y motivo; el animal deja de contar como activo y no recibe gastos de lote posteriores.
- R4 — Cada animal deberá poder tener un dueño: se escribe uno nuevo o se elige de los dueños que ya
  existen (sugerencias).
- R5 — Las hembras de cría deberán poder ser vientre menor, vientre mayor o vientre parida; ningún
  vientre se vende (D2, también en la base de datos).
- R6 — El peso objetivo deberá ser opcional para todos los animales; para los vientres no se pide.
- R7 — La compra deberá poder registrarse por kilo o por animal: si es por kilo, el sistema muestra el
  total aproximado (precio × peso de ingreso) y guarda ambos; si es por animal, muestra el precio por
  kilo equivalente.
- R8 — El sistema deberá llevar caballos (especie equino: caballo, yegua, potro, potranca) con número
  o nombre, sexo, color, dueño, foto y precio de compra, sin chapeta ICA ni lote obligatorios, sin
  pesaje ni recomendación; y deberá permitir venderlos uno por uno por precio del animal.

## Diseño
- Migración 1700: `animales` + `especie`, `dueno`, `color`, `precio_compra_kg_cop`, `foto_path`,
  `fecha_baja`, `motivo_baja`; estado `perdido`; `peso_objetivo_kg`, `chapeta_ica`,
  `peso_ingreso_kg` y `lote_id` opcionales solo para equinos (checks); categorías nuevas;
  `registrar_animal` acepta los campos nuevos y no crea pesaje para equinos; `registrar_venta` rechaza
  cualquier `vientre_%`; tabla `ventas_equinos` con `vender_equino()` atómica.
- `useHato` devuelve `animales` (bovinos) y `caballos` por separado: los módulos de ganado no cambian.
- El reparto de costos usa `fecha_baja` como fecha de salida (resuelve DT-02-1).

## Tareas
- [ ] T1 Migración 1700 — verifica: aplicada sin errores; advisors sin alertas nuevas
- [ ] T2 Editar y dar de baja en la ficha; Eliminar con confirmación — verifica: E2E
- [ ] T3 Formulario nuevo: dueño con sugerencias, vientres, peso objetivo opcional, compra por kg o animal — verifica: E2E
- [ ] T4 Caballos: lista, registro, ficha y venta — verifica: E2E

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-10-04 (plan v2 del Sprint 05)
