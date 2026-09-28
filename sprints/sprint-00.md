# Sprint 00 — Fundaciones

- Estado: cerrado
- Inicio: 2026-09-27 · Cierre: —
- Aprobación del plan: [x] Andrés Sánchez el 2026-09-27 (spec 001; la 002 se aprobó en el chat el mismo día)

## 1. Plan

### Objetivo
Que lo que Miguel Ángel registre quede guardado en una base de datos compartida, con login
real, en una interfaz que se pueda usar desde el celular, y que cada cambio se pueda
verificar automáticamente.

### Alcance
| Spec | Módulos | Estado |
|---|---|---|
| [001 — Supabase, autenticación y esquema](../specs/001-fundaciones/spec.md) | M1 + base de datos | aprobada |
| [002 — Sistema de diseño y layout adaptable](../specs/002-sistema-diseno/spec.md) | transversal | hecha |

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
| 2026-09-28 | 001 · hallazgos ronda 2 | Migración 0500: sin fechas futuras en precios ni en animales; categoría acorde al sexo (D2). Además: SIGNED_IN en otra pestaña, orden del gráfico de peso, `created_at` explícito en la semilla | La prueba de atomicidad del verificador depende de una fecha futura en el animal, que ahora se rechaza: el verificador debe ajustar su instrumento |
| 2026-09-28 | 002 · T1–T7 | Tokens, marca SR, componentes `ui/`, layout adaptable y 7 pantallas rediseñadas. Vitest 48/48 (incluye la prueba de tokens de R1). E2E de diseño 6/6. Suite completa 41/42 | Trabajado en un git worktree mientras corría la ronda 2 de la 001. Revisión visual a 375 y 1280 px. Corregido `.input` (sin capa CSS) que tapaba el ícono de búsqueda |
| 2026-09-28 | 002 · correcciones ronda 1 | Todos los Altos y el Medio corregidos, y 6 de 8 Bajos. Suite E2E completa 61/61 sin límite de Auth; Vitest 74/74 | El separador decimal (punto en kg) queda como deuda |
| 2026-09-27 | 001 · T9 | **Pendiente**: requiere decidir cómo desplegar (push al repo del equipo o subida directa a Vercel) | Se consulta al usuario |

## 3. Verificación
| Spec | Ronda | Veredicto | Reporte |
|---|---|---|---|
| 001 | 1 | RECHAZADO (1 Alto, 5 Medios, 6 Bajos; R7 no cumple; R11 sin evidencia) | [001-2026-09-27](../reports/verificacion/001-2026-09-27.md) |
| 001 | 2 | BLOQUEADO solo por R11 (despliegue pendiente del push del usuario). R1–R10 cumplen; 0 Críticos, 0 Altos; 1 Medio nuevo (precio con fecha futura) y 6 Bajos | [001-2026-09-28-ronda2](../reports/verificacion/001-2026-09-28-ronda2.md) |
| 002 | 2 | APROBADO (0 Críticos/Altos; 4 Bajos a deuda) | [002-2026-09-28-ronda2](../reports/verificacion/002-2026-09-28-ronda2.md) |
| 002 | 1 | RECHAZADO (4 Altos: R3 desborde en la ficha, R9 formularios en línea, R6 dos pares < AA, R5 botón de 38 px; 1 Medio de foco; 8 Bajos) | [002-2026-09-28](../reports/verificacion/002-2026-09-28.md) |

## 4. Cierre

**Cerrado el 2026-09-28 con una excepción:** la spec 002 está `hecha` (APROBADO en la ronda 2).
La spec 001 quedó `BLOQUEADO` solo por R11/T9 (despliegue en Vercel): el push al repositorio del
equipo lo bloqueó el control de permisos de Claude Code y lo tiene que hacer el usuario. R1–R10
de la 001 cumplen (ronda 2). El sprint se cierra para no frenar el trabajo; T9 pasa a la deuda
como acción del usuario (DT-00-1).

### Retroalimentación
- **Funcionó:**
  - El verificador como agente separado encontró problemas reales que las pruebas del
    implementador no cubrían: el login sin perfil volvía al formulario sin mensaje, la chapeta
    duplicada en minúsculas se aceptaba y la ficha se desbordaba en el celular.
  - Las 2 rondas máximas obligan a corregir de raíz.
  - Trabajar la spec siguiente en un git worktree mientras el verificador revisa `main`
    duplicó el ritmo.
- **No funcionó:**
  - Correr dos suites E2E a la vez contra la misma base de datos: la recarga de la semilla de
    una rompía la otra.
  - El límite de inicios de sesión de Supabase Auth tumbó la suite con más de 50 pruebas.
  - Un trigger con `AND` sin cortocircuito (migración 0300) y un espacio al final de las
    etiquetas: bugs propios que costaron una ronda.
- **Cambiar en el siguiente sprint:**
  - Nunca correr suites en paralelo contra la base de datos.
  - Reutilizar la sesión en las pruebas (ya hecho en `helpers.js`).
  - Cada migración nueva debe sumar su tabla a `npm run db:seed`.
  - Pensar en celular primero: cada formulario nuevo nace como hoja inferior.

### Deuda
| ID | Descripción | Severidad | Origen | Sprint destino |
|---|---|---|---|---|
| DT-00-1 | Despliegue en Vercel (T9/R11 de la 001): hacer push de `main` a `andreaurro24/Santa-Rita-App-1`, importar el repo en Vercel y configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` | Alta (bloquea el cierre de la 001) | 001 T9 | **Resuelta el 2026-09-28:** https://santa-rita-app-1.vercel.app desde el fork (ver `DEPLOY.md`); falta la verificación de R11 |
| DT-00-2 | Separador decimal inconsistente: punto en kg y %, coma en GDP; en es-CO debería ser coma | Baja | Verificación 002 | 4 |
| DT-00-3 | En Supabase Auth, desactivar el registro público y activar la protección contra contraseñas filtradas (Dashboard → Authentication) | Baja (mitigado: sin perfil no hay acceso) | Verificaciones 001 | Acción del usuario |
| DT-00-4 | Crear el usuario real de Miguel en Auth y su fila en `perfiles` (rol `dueno`) | Media | Plan | Acción del usuario, antes del piloto |
| DT-00-5 | Bundle de 940 kB: separar por rutas (`import()` dinámico) | Baja | Build | 4 |
| DT-00-6 | Foco que se pierde al cerrar una hoja cuyo botón de apertura se deshabilita (por ejemplo, tras mover animales) | Baja | Verificación 002 r2 | 4 |
| DT-00-7 | Escribir las specs 003 (gestión del hato) y 005 (sanidad): su creación la bloqueó el control de permisos | Media | Sprint 01 | Revisión humana |

### Información importante
- **Decisiones:**
  - No hay trigger de perfil: los perfiles se crean a mano.
  - La semilla entra con el usuario de prueba, sin `service_role`.
  - El cierre de sesión es local al dispositivo.
  - Se usa TanStack Query.
  - Identidad visual "Hierro y sabana", con ajustes de color para evitar los patrones genéricos.
- **Recursos creados (sin secretos):**
  - Proyecto Supabase `santa-rita-dev` (ref `eiszvbwwpqcqognkcfew`, org GuardIA, us-east-1, plan gratuito).
  - Usuario de prueba `verificador@santarita.test`, con rol `dueno`; su contraseña está en `.env.test`, fuera del repo.
- **Comandos nuevos:**
  - `npm test` (Vitest) y `npm run test:e2e` (Playwright; acepta `E2E_PORT`).
  - `npm run db:seed` (con `-- --sql` genera `supabase/seed.sql`).
- **Gotchas:**
  - En plpgsql, `AND` no garantiza cortocircuito: usa IF anidados.
  - En Tailwind v4, el CSS sin capa les gana a las utilidades: usa `@layer components`.
  - Una etiqueta con espacio al final rompe `getByLabel` con `$`.
  - El plan gratuito de Supabase pausa el proyecto tras 7 días sin actividad.

### Para el siguiente sprint
- Construir sobre la capa de datos de `src/data/` y el sistema `ui/`; no crear estilos sueltos.
