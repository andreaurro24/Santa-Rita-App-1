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
| 2026-09-27 | 001 · T1 | Proyecto `santa-rita-dev` creado (org GuardIA, us-east-1, plan gratuito, $0/mes); `.env.example` | — |
| 2026-09-27 | 001 · T2 | 2 migraciones aplicadas (esquema + RLS); asesor de seguridad sin alertas; anónimo recibe `permission denied` | Sin trigger de perfil automático (seguridad) |
| 2026-09-27 | 001 · T3 | `npm run db:seed`: 140 animales, 4 lotes, 9 precios, 1050 pesajes, 508 eventos | La semilla entra como usuario de prueba, no con `service_role` |
| 2026-09-27 | 001 · T4 | Supabase Auth; `seedUsers.js` borrado; `dist/` sin `service_role` ni contraseñas | Login por correo |
| 2026-09-27 | 001 · T5–T6 | `useHato`/`usePrecios` + mutaciones; 6 páginas migradas; `ConDatos` para carga y error | `DataContext` borrado; validaciones en formularios |
| 2026-09-27 | 001 · T7 | Motor movido a `src/domain/`; `npm test`: 13/13 | — |
| 2026-09-27 | 001 · T8 | Playwright; `npm run test:e2e`: 11/11 | Solo proyecto escritorio; el móvil entra con la spec 002 |
| 2026-09-28 | 001 · correcciones ronda 1 | Todos los Alto y Medio corregidos, y 4 de 6 Bajos. `npm test` 21/21; E2E 27/29 | Las 2 que fallan: "animal a medias" (su premisa cambió con `registrar_animal`) y la de celular (es de la spec 002). Bug propio en el trigger de fecha futura (AND sin cortocircuito), corregido con la migración 0400 |
| 2026-09-28 | 001 · T9 | Push al repo del equipo bloqueado por los permisos de Claude Code (lo cuenta como publicación). T9 queda para el usuario | — |
| 2026-09-27 | 001 · T9 | **Pendiente**: requiere decidir cómo desplegar (push al repo del equipo o subida directa a Vercel) | Se consulta al usuario |

## 3. Verificación
| Spec | Ronda | Veredicto | Reporte |
|---|---|---|---|
| 001 | 1 | RECHAZADO (1 Alto, 5 Medios, 6 Bajos; R7 no cumple; R11 sin evidencia) | [001-2026-09-27](../reports/verificacion/001-2026-09-27.md) |
| 001 | 2 | BLOQUEADO solo por R11 (despliegue pendiente del push del usuario). R1–R10 cumplen; 0 Críticos, 0 Altos; 1 Medio nuevo (precio con fecha futura) y 6 Bajos | [001-2026-09-28-ronda2](../reports/verificacion/001-2026-09-28-ronda2.md) |

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
