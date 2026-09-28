---
name: sprint
description: Ciclo de sprint del proyecto Santa Rita — planear, ejecutar, verificar, cerrar (retro, deuda, info importante), hacer commits y abrir el siguiente. Úsala cuando el usuario diga "planear sprint", "arrancar/ejecutar el sprint", "cerrar el sprint", "siguiente sprint" o /sprint, o cuando se termine la última spec de un sprint.
---

# Ciclo de sprint

Cada sprint vive en un solo archivo `sprints/sprint-NN.md`, creado desde
`sprints/_plantilla.md`. Ese archivo es la fuente de verdad del sprint: el plan, la bitácora,
los veredictos del verificador y el cierre. Las specs (`specs/NNN-*/spec.md`) siguen siendo el
contrato de cada feature; el sprint las agrupa y las ordena.

El ciclo tiene 4 fases. Detecta en qué fase está el sprint leyendo su campo `Estado` y
continúa desde ahí. No hay bucles automáticos: cada fase termina en un punto que el humano ve.

## Fase 1 — Planear (`Estado: planeado`)
1. Lee `docs/plan.md` §10 (qué módulos tocan este sprint) y la sección "Deuda" y
   "Para el siguiente sprint" del sprint anterior.
2. Crea `sprints/sprint-NN.md` desde la plantilla y llena: objetivo, alcance (módulos y
   specs), fuera de alcance, deuda que se arrastra, riesgos, orden de ejecución y definición
   de hecho.
3. Escribe una spec en `borrador` por cada feature nueva (plantilla `specs/_plantilla.md`) y
   agrégala al índice de `specs/README.md`.
4. **Puerta humana:** presenta el plan y las specs. No ejecutes nada hasta que el usuario
   apruebe. Al aprobar, marca las casillas de aprobación de cada spec y del sprint.

## Fase 2 — Ejecutar (`Estado: en-ejecucion`)
1. Implementa las specs en el orden del plan, tarea por tarea, respetando `CLAUDE.md`.
2. Tras cada tarea: corre su comando de verificación, marca `[x]` en la spec y añade una
   línea a la **Bitácora** del sprint (fecha, tarea, resultado, desvíos).
3. Si algo obliga a salirse del alcance, a cambiar el esquema no previsto en la spec o a
   añadir una dependencia no aprobada: para y pregunta. Anótalo en la bitácora.
4. Haz un commit por spec terminada (ver "Commits").

## Fase 3 — Verificar (`Estado: en-verificacion`)
1. Por cada spec del sprint, invoca el subagente `verificador` con la ruta de la spec.
2. Copia el veredicto y el enlace al reporte en la tabla **Verificación** del sprint.
3. Si es `RECHAZADO`: corrige los hallazgos Crítico/Alto y pide **una** verificación más.
   Si la segunda también falla, o el veredicto es `BLOQUEADO`, detente y lleva los hallazgos
   al humano. Máximo 2 rondas de verificación por spec.
4. Los hallazgos Medio/Bajo que no se corrijan pasan a la sección **Deuda**, nunca se pierden.

## Fase 4 — Cerrar (`Estado: cerrado`)
1. Llena el cierre del sprint:
   - **Retroalimentación:** qué funcionó, qué no, qué cambiar en el siguiente sprint
     (proceso, estimación, herramientas). Concreta, con ejemplos del sprint.
   - **Deuda:** tabla con ID `DT-NN-#`, descripción, severidad, origen (spec o hallazgo del
     verificador) y sprint destino propuesto.
   - **Información importante:** decisiones tomadas, URLs y recursos creados (sin secretos:
     solo dónde están), comandos nuevos, gotchas descubiertos, cambios de esquema.
   - **Para el siguiente sprint:** lo que el siguiente plan debe tener en cuenta.
2. Actualiza `docs/plan.md` (§10 estado del sprint, §12 decisiones) y `specs/README.md`
   (estados de las specs).
3. Haz el commit de cierre.
4. Resume al usuario: veredictos, deuda y lo que viene. Luego pasa a la Fase 1 del sprint
   siguiente, que vuelve a terminar en la puerta humana.

## Commits
- Rama: `main` (decisión del usuario, 2026-09-27).
- Un commit por spec terminada: `feat(spec-NNN): <resumen>` con el detalle de tareas en el cuerpo.
- Commit de cierre: `chore(sprint-NN): cierre — retro, deuda y veredictos`.
- Antes de cada commit: `npm run lint`, `npm run build` y los tests existentes deben pasar;
  revisa `git status` para no incluir `.env*`, `dist/` ni artefactos de pruebas.
- No hagas `push` a menos que el usuario lo pida.
