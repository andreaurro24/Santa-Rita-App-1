# Spec 007 — "Al partir": tenedores, contratos y visitas de verificación

- Estado: en-verificacion
- Sprint: 2
- Módulos del plan: M7

## Contexto
Parte del hato está en fincas de terceros bajo contrato "Al partir" (D8). El tenedor cuida los
animales y, al vender, recibe un porcentaje de la ganancia neta. Hoy Miguel controla esto con
visitas sin previo aviso, y no queda nada documentado. Esta spec pone en la app a los
tenedores, sus contratos y las visitas, con los pesos que se toman en cada una.

## Requisitos (EARS)
- R1 — El sistema deberá permitir crear y editar tenedores (nombre, teléfono y finca).
- R2 — El sistema deberá permitir crear y editar contratos "Al partir": tenedor, fecha de
  inicio, precio del animal, precio por kilo, porcentaje de la ganancia neta (0–100) y estado
  (`vigente` / `terminado`).
- R3 — El sistema deberá permitir asignar animales activos a un contrato vigente. Al hacerlo,
  el animal pasa a la finca del tenedor y queda un movimiento con el motivo.
- R4 — El sistema deberá mostrar por contrato sus animales, el peso promedio actual, la
  ganancia diaria del grupo y la fecha de la última visita.
- R5 — El sistema deberá registrar una visita de verificación (contrato, fecha, notas) con el
  peso de cada animal revisado. Cada peso queda como un pesaje normal ligado a la visita.
- R6 — Si en una visita falta un animal del contrato, el sistema deberá dejarlo marcado como
  "no encontrado" en la visita.
- R7 — Mientras un contrato esté `terminado`, el sistema no deberá permitir asignarle animales.

## Fuera de alcance
- La liquidación del tenedor al vender (spec 011, con la venta real).
- El acceso de los tenedores a la app.

## Diseño
- **Datos:**
  - Tabla `visitas_verificacion` (contrato_id, fecha, notas).
  - Tabla `visita_animales` (visita_id, animal_id, encontrado, pesaje_id).
  - Asignación con la función SQL `asignar_a_contrato(ids, contrato, fecha, motivo)`,
    atómica: cambia `contrato_id` y `finca_id` y registra el movimiento.
  - RLS igual que en las demás tablas.
- **UI:**
  - Ruta `/al-partir`: tenedores y contratos.
  - `/al-partir/:contratoId`: animales, visitas, "Registrar visita" y "Asignar animales".
- **Dominio:** se reutilizan `gdpLote` y `pesoActual`.

## Correcciones de la verificación ronda 1 (`reports/verificacion/007-2026-09-28.md`)
- **Alto (R1):** "Editar tenedor" en el detalle del contrato.
- **Visitas:**
  - Un peso con más de 15 % de diferencia frente al último pide confirmación.
  - Un animal sin peso ni marca queda como "no encontrado" (R6), con un aviso antes de guardar.
  - Cada casilla dice de qué animal es y el error se borra al corregir.
- **Contrato:** el porcentaje es obligatorio, los precios van sin decimales y la fecha de inicio
  no puede ser futura.
- **Base de datos (migración 1400):**
  - Mover un animal fuera de la finca del tenedor le quita el contrato (trigger).
  - `asignar_a_contrato` rechaza fechas anteriores al ingreso y animales de otro contrato.
  - Las visitas rechazan fechas futuras y animales fuera del contrato también en escrituras
    directas (triggers).
- **Ficha:** muestra las visitas de verificación del animal, incluidos los "no encontrado".

## Tareas
- [x] T1 Migración visitas + función de asignación
- [x] T2 Tenedores y contratos (crear y editar)
- [x] T3 Asignar animales a un contrato
- [x] T4 Registrar visita con pesos y "no encontrado"
- [x] T5 E2E
- [ ] T6 Verificador

## Criterios de aceptación para el verificador
- Crear un contrato para un tenedor, asignarle 2 animales de Santa Rita (quedan en la finca
  del tenedor y con 2 movimientos), registrar una visita con un peso y uno "no encontrado", y
  verlos en la ficha y en el contrato.
- Un contrato terminado no acepta animales, ni en la interfaz ni en la base de datos.

## Aprobación
- [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs de los sprints antes de que se escribieran. Hay que confirmarlo al revisar.
