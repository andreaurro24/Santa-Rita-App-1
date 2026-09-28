# Spec 013 — Importar el censo desde CSV

- Estado: hecha
- Sprint: 4
- Módulos del plan: M13

## Contexto
Para pasar del 0 % al 100 % del hato digital (KPI 1), Miguel necesita cargar su censo real de
unas 140 reses sin escribirlas una por una. Lo más probable es que lo tenga en Excel. Excel
puede guardar como CSV, así que no hace falta ninguna dependencia nueva.

## Requisitos (EARS)
- R1 — El sistema deberá leer un archivo CSV (separado por coma o punto y coma, en UTF-8) con
  estas columnas: número interno, chapeta, sexo, categoría, lote (código), fecha de ingreso,
  peso de ingreso, peso objetivo y costo de compra (opcional).
- R2 — El sistema deberá validar cada fila antes de importar y mostrar una vista previa con los
  errores de cada fila:
  - campos faltantes;
  - números inválidos;
  - fechas futuras o mal escritas;
  - lote inexistente;
  - número interno o chapeta repetidos, dentro del archivo o contra el hato;
  - categoría que no corresponde al sexo.
- R3 — Mientras haya filas con errores, el sistema deberá permitir importar solo las filas
  válidas, diciendo cuántas se omitirán.
- R4 — El sistema deberá importar las filas válidas y crear cada animal con su pesaje de ingreso
  (función `registrar_animal`), e informar cuántas se crearon.
- R5 — El sistema deberá ofrecer una plantilla CSV descargable con los encabezados y una fila de
  ejemplo.

## Diseño
- `src/domain/censo.js`: `parsearCSV` y `validarFilas`, con pruebas (comillas, separadores,
  BOM, fechas dd/mm/aaaa y aaaa-mm-dd).
- Página `/hato/importar`, enlazada desde el hato.
- Las filas se importan de a una con `registrar_animal`, para que un error no deje animales a
  medias. Al final se muestra el conteo.

## Tareas
- [x] T1 Dominio de lectura y validación + pruebas
- [x] T2 Pantalla con vista previa e importación
- [x] T3 Plantilla descargable
- [x] T4 E2E
- [ ] T5 Verificador

## Aprobación
- [x] Andrés Sánchez aprobó en el chat, el 2026-09-27, todas las specs de los sprints antes de que se escribieran. Hay que confirmarlo al revisar.
