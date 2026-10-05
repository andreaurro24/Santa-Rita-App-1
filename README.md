# Finca Santa Rita: trazabilidad del ganado y decisión de venta

App web del proyecto **"End-to-End IT Automation & Operational Improvement Project — Finca
Santa Rita"** (Gerencia de TI, Universidad de La Sabana, 2026-2). Digitaliza el hato de ceba y
cría (identificación, pesos, sanidad, ubicación y costos) y convierte esos datos en una
recomendación de venta explicable.

El plan del producto, las reglas de negocio y los sprints están en [docs/plan.md](docs/plan.md);
el contrato de cada funcionalidad, en [specs/](specs/README.md).

## Qué hace

- **Animales:** ficha de cada animal (hierro, número interno, chapeta ICA, dueño, foto), altas,
  edición, bajas, importación del censo desde CSV y alerta de pérdida de peso. También caballos.
- **Pesaje en el corral:** jornada por lote desde el celular, con ganancia diaria de peso (GDP)
  por animal y por lote.
- **Lotes y ubicación:** ciclos de ceba con la fecha proyectada para llegar a la meta, fincas,
  potreros y movimientos con su historial.
- **"Al partir":** tenedores, contratos, asignación de animales y visitas de verificación.
- **Gastos:** de la finca entera, o por lote o por animal, repartidos según el lote en que estaba
  cada animal en cada fecha.
- **Decisión de venta:** punto de equilibrio real, margen neto para Santa Rita (descontando a
  los tenedores), escenarios de vender hoy o en 2, 4 u 8 semanas y estado del pasto. Incluye un
  reporte imprimible.
- **Ventas:** registro de la venta real, comparación con la recomendación y liquidación de los
  tenedores.
- **Indicadores:** los KPI del proyecto frente a la línea base AS-IS.
- **Precio de la zona:** rango del kilo en pie para Cesar y La Guajira por categoría (ternero,
  ternera, levante, gordo y vaca), actualizable desde la app. Sin clima ni TRM desde el Sprint 05.

## Stack

React 19 · Vite 8 · React Router 7 · Tailwind CSS 4 · TanStack Query · Recharts ·
Supabase (Auth, Postgres con RLS y funciones SQL) · Vitest · Playwright.

## Cómo correrlo

1. `npm install`.
2. Copia `.env.example` a `.env.local` con la URL y la llave **publicable** del proyecto
   Supabase de **pruebas**. Crea también `.env.test` con el usuario de prueba y
   `PROYECTO_PRUEBAS=<ref>`. Producción (`eiszvbwwpqcqognkcfew`) no se usa para desarrollar: ver
   [DEPLOY.md](DEPLOY.md).
3. Aplica las migraciones de `supabase/migrations/` en orden (SQL Editor o Supabase CLI) y crea
   un perfil para cada usuario:
   ```sql
   insert into public.perfiles (id, nombre, rol) values ('<uuid del usuario en Auth>', 'Miguel Ángel Lacouture', 'dueno');
   ```
4. `npm run db:seed` carga los datos de ejemplo (140 reses) en el proyecto de **pruebas**. Se
   niega a correr contra producción (`scripts/proyectos.mjs`), igual que `npm run test:e2e`.
5. `npm run dev` abre la app en http://localhost:5173.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` |
| `npm run lint` | oxlint |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test:e2e` | Pruebas de extremo a extremo (Playwright; `E2E_PORT` cambia el puerto) |
| `npm run db:seed` | Recarga los datos de ejemplo (`-- --sql` genera `supabase/seed.sql`) |

## Cómo se trabaja

Desarrollo guiado por specs ([CLAUDE.md](CLAUDE.md)):

1. Se escribe la spec y un humano la aprueba.
2. Se implementa.
3. El subagente [`verificador`](.claude/agents/verificador.md) la revisa de forma independiente
   y deja su reporte en `reports/verificacion/`.
4. Se cierra el sprint con retroalimentación, deuda e información importante (`sprints/`).

## Despliegue

Ver [DEPLOY.md](DEPLOY.md).
