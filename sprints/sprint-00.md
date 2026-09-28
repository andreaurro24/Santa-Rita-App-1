# Sprint 00 — Fundaciones

- Estado: en-ejecucion
- Inicio: 2026-09-27 · Cierre: —
- Aprobación del plan: [x] Andrés Sánchez el 2026-09-27 (spec 001). La spec 002 está pendiente de aprobación.

## 1. Plan

### Objetivo
Que lo que Miguel Ángel registre quede guardado en una base de datos compartida, con login
real, en una interfaz que se pueda usar desde el celular, y que cada cambio se pueda
verificar automáticamente.

### Alcance
| Spec | Módulos | Estado |
|---|---|---|
| [001 — Supabase, autenticación y esquema](../specs/001-fundaciones/spec.md) | M1 + base de datos | aprobada |
| [002 — Sistema de diseño y layout adaptable](../specs/002-sistema-diseno/spec.md) | transversal | borrador |

### Fuera de alcance
- Módulos nuevos (costos, ciclos, ventas, "Al partir" v2, recomendación v2): Sprints 1–3.
- Proyecto Supabase de producción: se crea cuando haya datos reales.

### Deuda que se arrastra
- Ninguna (primer sprint).

### Orden de ejecución
1. Spec 001 — todo lo demás depende de tener datos en Supabase y pruebas funcionando.
2. Spec 002 — rediseña las pantallas ya conectadas a Supabase, protegidas por los E2E de la 001.

### Riesgos
| Riesgo | Mitigación |
|---|---|
| El plan gratuito de Supabase pausa proyectos inactivos por 7 días | Documentar cómo reactivarlo; el proyecto de producción se crea más adelante |
| Los E2E dependen de un usuario de prueba y de la red | Usuario dedicado en `.env.test`; el verificador marca BLOQUEADO si falta |
| Migrar las 6 páginas rompe comportamientos existentes | Criterio de paridad (R8 de la 001) y E2E antes del rediseño |

### Definición de hecho
- Specs 001 y 002 en `hecha` con veredicto `APROBADO` del verificador.
- `npm run lint`, `npm run build`, `npm test` y `npm run test:e2e` pasan.
- Commits hechos en `main`; `docs/plan.md` y `specs/README.md` actualizados.

## 2. Bitácora
| Fecha | Spec / tarea | Resultado | Notas y desvíos |
|---|---|---|---|
| 2026-09-27 | 001 · T1 | Proyecto `santa-rita-dev` creado (org GuardIA, us-east-1, plan gratuito, $0/mes) | — |

## 3. Verificación
| Spec | Ronda | Veredicto | Reporte |
|---|---|---|---|

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

### Para el siguiente sprint
- 
