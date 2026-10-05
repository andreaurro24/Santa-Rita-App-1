# Spec 021 — Precio del ganado por zona y categoría

- Estado: hecha
- Sprint: 5
- Módulos del plan: M9, M10

## Contexto
En el norte del Cesar y La Guajira no hay un precio fijo: se negocia en un rango por kilo que depende
de la edad y el tipo de animal. La recomendación usaba un solo precio manual.

## Requisitos (EARS)
- R1 — El sistema deberá guardar un rango de precio por kilo (mínimo y máximo) para Cesar y La
  Guajira por categoría: ternero, ternera, levante, gordo y vaca, con fecha y fuente.
- R2 — Miguel deberá poder actualizar cada rango con un formulario; el sistema guarda el historial.
- R3 — La recomendación deberá usar, para cada animal, el punto medio del rango vigente de su
  categoría de precio: ternero → ternero; ternera → ternera; novillo y reproductor de menos de 350 kg →
  levante, de 350 kg o más → gordo. Si falta un rango, usa el último precio manual. El usuario puede
  seguir simulando un precio único.
- R4 — La carga inicial deberá citar su fuente y marcarse como "estimado inicial, por validar".

## Fuera de alcance
- Lectura automática de precios desde internet (las fuentes no publican Cesar o bloquean la lectura).

## Diseño
- Migración 1700: tabla `precios_referencia` (categoria, zona, precio_min_cop, precio_max_cop,
  fecha, fuente) con RLS de miembros; vigente = más reciente por categoría.
- `domain/precios.js`: `categoriaPrecio(animal, peso)`, `precioReferencia(rangos, categoria)`.
- `analizarLoteV2` acepta `precioKg` como número o como función por animal.

## Tareas
- [ ] T1 Tabla y carga inicial — verifica: SQL
- [ ] T2 Pantalla "Precio y pasto" con rangos y formulario — verifica: E2E
- [ ] T3 Recomendación por categoría — verifica: unitarias

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-10-04 (plan v2 del Sprint 05)
