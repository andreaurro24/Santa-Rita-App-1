# Sprint 05 — La app de Miguel

- Estado: en-progreso
- Inicio: 2026-10-04 · Cierre: —
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
| [014 — Base limpia, guardas y bitácora](../specs/014-base-limpia/spec.md) | 1 | en-progreso |
| [015 — Simplificar para Miguel](../specs/015-simplificar/spec.md) | 2 | en-progreso |
| [016 — Animales: editar, baja, dueño, vientres, compra y caballos](../specs/016-animales-v2/spec.md) | 3 | en-progreso |
| [017 — Fotos de los animales](../specs/017-fotos/spec.md) | 3 | en-progreso |
| [018 — Dinero con miles y nombres válidos](../specs/018-datos-bien-escritos/spec.md) | 4 | en-progreso |
| [019 — Ventas más claras](../specs/019-ventas-claras/spec.md) | 6 | en-progreso |
| [020 — Fincas, lotes y gastos de finca](../specs/020-fincas-lotes-gastos/spec.md) | 5 | en-progreso |
| [021 — Precio del ganado por zona y categoría](../specs/021-precios-zona/spec.md) | 7 | en-progreso |

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
| 2026-10-04 | Correcciones r1 | A1 (doble toque guardaba la venta), A2 (color del ganado), M1 (montos alterados en silencio), M2/M3 (finca y tenedor: atómico con `guardar_finca`, sin quitarle la finca a otro tenedor), M4 (Pesaje vacío), M6 (caballo sin lote ni pesajes en la base), B1–B4, B6–B9; migración 1800 | B5 (miniaturas con la foto completa) queda como deuda: la transformación de imágenes de Supabase es de pago |

## 3. Verificación
| Spec | Ronda | Veredicto | Reporte |
|---|---|---|---|
| 014–021 | 1 | 015, 017, 018, 020, 021 APROBADO; 016 y 019 RECHAZADO (A2, A1); 014 RECHAZADO (README) y R1 BLOQUEADO hasta T4 | [sprint05-2026-10-04](../reports/verificacion/sprint05-2026-10-04.md) |

## 4. Cierre

### Retroalimentación
- Funcionó:
- No funcionó:
- Cambiar en el siguiente sprint:

### Deuda
| ID | Descripción | Severidad | Origen | Sprint destino |
|---|---|---|---|---|

### Información importante
- Decisiones:
- Recursos creados (sin secretos):
- Comandos nuevos:
- Gotchas:
