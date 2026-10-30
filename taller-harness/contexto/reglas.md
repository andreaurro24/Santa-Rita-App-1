# Reglas que revisa el arnés

Vienen de las reglas de negocio de la app (`docs/insumos-capitulos-6-a-8.md`) y del esquema de
la base de datos. **El extractor no las aplica: las aplica el validador con código** (regla de
diseño del taller: lo que se puede verificar con una regla fija, se verifica con una regla fija).

| ID | Regla | Origen en la app | Qué pasa si no se cumple |
|---|---|---|---|
| V1 | El número interno existe en el censo y el animal está activo. Si la fila solo trae chapeta, el validador busca el animal por chapeta (ciclo 2) | `animales.numero_interno` único | Dudoso: "no está en el censo" |
| V2 | Si el reporte trae chapeta, coincide con la del censo y con un solo animal | `animales.chapeta_ica` único (RN-15) | Dudoso: "la chapeta no coincide" |
| V3 | La fecha no es futura (frente a la fecha del mensaje) | RN-14, disparadores de fecha | Dudoso: "fecha futura" |
| V4 | La fecha no es anterior al ingreso del animal | RN-14 | Dudoso: "fecha anterior al ingreso" |
| V5 | El peso no cambia más de 15 % frente al último pesaje | RN-01 (`variacionSospechosa`) | Dudoso: "cambio de más del 15 %" |
| V6 | En un pesaje, un animal aparece una sola vez. En sanidad, el mismo evento (tipo y descripción) no se repite para un animal; dos eventos distintos sí pueden ir juntos (ciclo 1) | RN-15 y el índice `pesajes_uno_por_jornada` | Todas sus filas a dudosos: "repetido en la jornada" |
| V7 | El peso está en un rango razonable para un novillo (80 a 800 kg) | `pesajes.peso_kg` entre 0 y 1500 | Dudoso: "peso fuera de rango" |
| V8 | Nada inventado: el peso y el número aparecen en el `texto_original` de la fila | Criterio de terminado 5 | Dudoso: "el valor no aparece en el texto leído" |
| V9 | El tipo sanitario es `vacuna`, `tratamiento` o `desparasitacion`, con descripción | `eventos_sanitarios.tipo` | Dudoso: "evento sanitario incompleto" |
| V10 | Un evento "para todo el lote" se expande con el censo, no con la memoria del modelo | Diseño del arnés | El validador arma la lista de animales del lote |
