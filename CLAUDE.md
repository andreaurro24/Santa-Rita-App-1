# Finca Santa Rita — Constitución del proyecto

App web para la trazabilidad del ganado de ceba y el apoyo a la decisión de venta de Finca
Santa Rita (Badillo, Cesar). Proyecto de Gerencia de TI, Universidad de La Sabana 2026-2.
El plan de producto, las reglas de negocio y los sprints están en `docs/plan.md`: léelo antes
de diseñar cualquier feature.

## 1. Proyecto
- Stack actual: React 19 + Vite 8 + React Router 7 (HashRouter) + Tailwind 4 + Recharts + lucide-react.
- Stack objetivo (Sprint 0): Supabase (Auth + Postgres + RLS) y despliegue en Vercel.
- Comandos: dev `npm run dev` · build `npm run build` · lint `npm run lint`
- Tests: TODO — Sprint 0 añade `npm test` (Vitest) y `npm run test:e2e` (Playwright).
- Idioma: la UI, el dominio y los nombres de negocio van en español (`animales`, `pesajes`, `lotes`).

## 2. Flujo de trabajo: Spec-Driven Development (SDD)
Toda feature no trivial (toca más de ~3 archivos, el esquema de BD o una regla de negocio)
sigue este flujo. Los bugs y cambios pequeños van directo, pero igual pasan por el verificador.

1. **Spec**: copiar `specs/_plantilla.md` a `specs/NNN-nombre/spec.md` y llenarla
   (requisitos EARS con IDs, diseño, tareas con comando de verificación). Estado: `borrador`.
2. **Puerta humana**: el usuario aprueba la spec. No se escribe código de producción antes.
3. **Implementación**: una tarea a la vez, en el orden de la spec. Marcar `[x]` al terminar.
4. **Verificación**: invocar el subagente `verificador` con la ruta de la spec. Él no corrige: reporta.
5. **Cierre**: el humano revisa el veredicto. Solo con `APROBADO` la spec pasa a `hecha`.

No hay bucles automáticos: si el verificador rechaza, se corrige y se vuelve a pedir
verificación explícitamente (máximo 2 rondas por spec); nunca se reintenta en silencio.

Las specs se agrupan en sprints. Cada sprint tiene su archivo `sprints/sprint-NN.md`
(plan → bitácora → verificación → cierre con retro, deuda e información importante) y se
gestiona con la skill `sprint` (`.claude/skills/sprint/SKILL.md`).

## 3. Matriz de delegación

### SIEMPRE
- SIEMPRE correr `npm run lint` y `npm run build` (y los tests cuando existan) antes de declarar algo terminado.
- SIEMPRE citar el ID del requisito de la spec (`R3`, `R4`…) en el código de reglas de negocio no obvias y en los tests.
- SIEMPRE validar entradas en el cliente Y en la base de datos (constraints/RLS); nunca solo en la UI.
- SIEMPRE diseñar primero para celular (375 px) y luego para escritorio.
- SIEMPRE usar las skills del repo cuando apliquen: `supabase`, `supabase-postgres-best-practices`,
  `vercel-react-best-practices`, `frontend-design`, `webapp-testing`.

### PREGUNTAR ANTES
- PREGUNTAR ANTES de cambiar el esquema de BD, las políticas RLS o correr migraciones.
- PREGUNTAR ANTES de añadir o actualizar dependencias.
- PREGUNTAR ANTES de salirse del alcance de la spec activa o refactorizar fuera de ella.
- PREGUNTAR ANTES de crear, pausar o borrar recursos en Supabase o Vercel.

### NUNCA
- NUNCA subir secretos, llaves ni archivos `.env*` (solo `.env.example`).
- NUNCA poner la `service_role` key de Supabase en código del cliente.
- NUNCA borrar o saltarse un test que falla para que la suite pase.
- NUNCA editar a mano `src/data/seedAnimals.json` ni `skills-lock.json`: se regeneran con scripts.
- NUNCA editar `node_modules/`, `dist/` ni las skills de terceros en `.claude/skills/`
  (las listadas en `skills-lock.json` se gestionan con `npx skills`). La skill propia `sprint` sí se edita.
- NUNCA usar datos reales de Miguel Ángel en pruebas: solo usuarios y datos de prueba.

## 4. Mapa
- Plan, reglas de negocio y sprints: `docs/plan.md`
- Specs activas y plantilla: `specs/` (ver `specs/README.md`)
- Sprints (plan, bitácora, cierre): `sprints/` · skill `sprint`
- Subagente verificador crítico: `.claude/agents/verificador.md`
- Lógica de negocio pura: `src/utils/` · Integraciones externas: `src/api/`
