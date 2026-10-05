# Spec 023 — Registro del animal: nombre, raza, nacimiento, tres pesos y compra didáctica

- Estado: en-verificacion
- Sprint: 6
- Módulos del plan: M2

## Contexto
Tras ver la app, el equipo pidió que el registro se parezca más al de un proyecto ganadero de
referencia: cada animal con un nombre con número (por ejemplo, Luna-042) en vez de un "número
interno", su raza, el mes y el año de nacimiento, los tres pesos que importan (inicial, actual y
objetivo) y una compra que muestre la cuenta entre precio por kilo y precio por animal.

## Requisitos (EARS)
- R1 — El campo "Número interno" deberá llamarse **Nombre** en toda la app. Cuando Miguel escriba
  un nombre sin número (por ejemplo, "Luna"), el sistema deberá sugerir el siguiente número libre del
  hato ("Luna-042") y Miguel podrá aceptarlo o cambiarlo. El número es un consecutivo de toda la
  finca (el mayor número que ya exista, más uno, con 3 cifras). El nombre no se repite (ya lo exige
  la base de datos, sin distinguir mayúsculas).
- R2 — El animal deberá poder tener una **raza**, elegida de una lista con las razas más comunes en
  Colombia o escrita a mano (opcional, con la validación de nombres de la spec 018, hasta 40
  caracteres).
  - Ganado: Brahman, Cebú comercial, Gyr, Guzerá, Nelore, Gyrolando, Pardo Suizo, Holstein,
    Simmental, Simbrah, Angus, Brangus, Romosinuano, Costeño con Cuernos, Blanco Orejinegro (BON),
    Normando, Cruzado (mestizo).
  - Caballos: Criollo colombiano, Cuarto de milla, Paso fino, Mestizo.
- R3 — Después de la categoría, el formulario deberá pedir el **nacimiento por mes y año**
  (opcional). El mes tiene la opción "Mes desconocido". No se acepta un mes o año futuro ni un año
  anterior al 2000. La ficha muestra "Nació en marzo de 2024", o "Nació en 2024" si no se sabe el
  mes, y la edad aproximada en meses o años.
- R4 — Para el ganado, el formulario deberá pedir tres pesos:
  - **Peso inicial (kg)**, obligatorio, con su fecha de ingreso (por defecto hoy, se puede poner
    una fecha pasada).
  - **Peso actual (kg)**, que empieza igual al inicial; si Miguel lo cambia, se guarda como un
    pesaje de hoy.
  - **Peso objetivo (kg)**, opcional, mayor que el actual; los vientres no lo llevan (spec 016 · R6).
- R5 — Si la fecha de ingreso es hoy, el peso actual deberá ser el mismo que el inicial (no hay
  días para ganar peso) y el campo quedará bloqueado con esa explicación.
- R6 — En **Precio de compra**, Miguel deberá elegir si escribe el precio **por kilo** o **por
  animal**, y ver los dos campos al tiempo: el que escribe y, al lado, el otro calculado con la
  cuenta a la vista.
  - Por kilo: "$9.000 × 450 kg = **$4.050.000** por animal".
  - Por animal: "$4.050.000 ÷ 450 kg = **$9.000** por kilo".
  - La cuenta usa el peso inicial. Sin peso, dice qué falta. En los caballos solo existe el precio
    por animal.
- R7 — Al editar un animal, deberán poder cambiarse el nombre, la raza, el nacimiento y el peso
  objetivo, además de lo que ya se edita (spec 016 · R1). El peso inicial y la fecha de ingreso
  siguen sin editarse. El peso actual se cambia con un pesaje desde la ficha.
- R8 — Todo lo anterior deberá validarse también en la base de datos: la raza con
  `texto_valido`, el nacimiento razonable y no futuro, la fecha de ingreso no futura, el peso
  actual entre 1 y 1.499 kg, y el pesaje de hoy no puede ser anterior al ingreso.

## Fuera de alcance
- Árbol genealógico (padre y madre) y registro de partos.
- Cambiar el peso inicial de un animal ya registrado.

## Diseño
- Datos (migración 1900, parte A):
  - `animales.raza text` con check `texto_valido(raza, 40)`.
  - `animales.nacimiento_mes_conocido boolean`. `fecha_nacimiento` sigue siendo la columna: guarda
    el día 1 del mes, o el 1 de enero si no se sabe el mes. Así siguen sirviendo el check "≥ 2000" y
    el trigger de fechas no futuras. Hay un check nuevo: si `fecha_nacimiento` es nula, la marca
    también es nula.
  - `registrar_animal(datos)` acepta `raza`, `nacimiento_mes_conocido`, `fecha_ingreso` pasada y
    `peso_actual`. Si este es distinto del inicial y la fecha de ingreso es anterior a hoy, inserta
    un segundo pesaje con la fecha de hoy, todo en la misma transacción.
- Dominio: `src/domain/animales.js`:
  - `RAZAS_BOVINO` y `RAZAS_EQUINO`.
  - `siguienteNumero(animales)` y `sugerirNombre(texto, animales)`.
  - `nacimientoDesdeMesAnio` y `textoNacimiento` (con la edad).
  - `cuentaCompra({ modo, precioKg, total, peso })`, que devuelve el texto de la cuenta.
  - Todo con pruebas unitarias.
- UI: `AnimalForm.jsx`, en este orden:
  1. Nombre (con la sugerencia).
  2. Chapeta.
  3. Sexo y categoría.
  4. Nacimiento: dos selects, mes con "Mes desconocido" y año del actual hacia el 2000.
  5. Raza (datalist), color y dueño.
  6. Lote.
  7. Pesos: inicial con fecha, actual y objetivo.
  8. Compra: selector de modo y dos columnas, la escrita y la calculada.
  9. Esquema.

  En el celular, las dos columnas de la compra van una debajo de la otra, con la cuenta en el
  medio. La ficha muestra la raza, el nacimiento y los tres pesos.
- Textos: "N° interno" pasa a "Nombre" en la tabla, el buscador, la venta y el reporte.
  `numero_interno` no se renombra en la base de datos, para no tocar índices ni funciones.
- Decisión clave: el número sugerido es un consecutivo de toda la finca, no uno por nombre. La
  referencia usa "Claudio-01" y "Juana-02", y un consecutivo único sirve también de número de
  inventario. Se descartó guardar el número en otra columna: el nombre completo ya es único.

## Tareas
- [x] T1 Dominio y pruebas unitarias de R1, R3 y R6 — verifica: `npm test`
- [x] T2 Migración 1900 parte A (raza, nacimiento, `registrar_animal` con fecha y peso actual) — verifica: aplicada; advisors sin alertas nuevas; SQL de prueba que rechaza raza con `<`, mes futuro y peso actual con ingreso hoy distinto del inicial
- [x] T3 Formulario y ficha — verifica: E2E E2E-S6 (registrar "Luna" → "Luna-001" con raza Brahman, nacida en "Mes desconocido" de 2024, inicial 250 kg hace 60 días, actual 310 kg; la ficha muestra la ganancia diaria de 1 kg/día)
- [x] T4 Renombrar "Número interno" a "Nombre" en la UI y en la importación del censo — verifica: `grep -ri "número interno" src` vacío, salvo los comentarios

## Criterios de aceptación para el verificador
- Registrar un animal con fecha de ingreso pasada y peso actual distinto crea dos pesajes, y la
  ganancia diaria sale de ellos.
- Con ingreso hoy, el peso actual no se puede cambiar.
- La cuenta de la compra se ve en los dos modos y cuadra al peso: $9.000 × 450 kg = $4.050.000.
- La raza escrita a mano con caracteres raros se rechaza en la UI y en la base de datos.
- "Mes desconocido" se guarda y se muestra como "Nació en 2024".

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-10-05 ("Aprobo. Construye todo de una.")
