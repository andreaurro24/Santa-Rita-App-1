# Spec 001 — Fundaciones: Supabase, autenticación y esquema

- Estado: en-progreso
- Sprint: 0
- Módulos del plan: M1 y la base de datos de M2–M9 (ver `docs/plan.md`)

## Contexto
Hoy cada navegador guarda su propia copia de los datos en `localStorage` y el login compara
contra contraseñas escritas en el código. Mientras sea así, lo que se registre en un celular
no existe para nadie más. Esta spec migra la app a Supabase con autenticación real y
mantiene exactamente las funciones que ya existen (paridad). Las funciones nuevas llegan en
los sprints siguientes.

## Requisitos (EARS)
- R1 — El sistema deberá autenticar con Supabase Auth (correo y contraseña) y no deberá
  contener contraseñas ni la llave `service_role` en el código del cliente.
- R2 — Si alguien sin sesión abre cualquier ruta distinta de `/login`, el sistema deberá
  llevarlo a `/login` y, tras entrar, devolverlo a la ruta que pidió.
- R3 — Cuando el usuario cierre sesión o la sesión expire, el sistema deberá borrar los datos
  en caché y volver a `/login`.
- R4 — El sistema deberá guardar animales, pesajes, eventos sanitarios, lotes, fincas,
  tenedores, contratos y precios en Postgres, con RLS activado en cada tabla, de modo que solo
  usuarios autenticados con perfil puedan leer y escribir.
- R5 — El sistema deberá rechazar en la base de datos: número interno o chapeta ICA
  repetidos, pesos ≤ 0, costos negativos y porcentajes fuera de 0–100.
- R6 — Cuando se guarde un dato en un dispositivo, el sistema deberá mostrarlo en otro
  dispositivo con la misma cuenta al recargar.
- R7 — El sistema deberá mostrar, en cada pantalla que carga datos, un estado de carga y un
  estado de error con un mensaje que diga qué hacer.
- R8 — El sistema deberá mantener el funcionamiento actual de Panel, Hato, Ficha del
  animal, Mercado y clima, Recomendación y Reporte, ahora leyendo de Supabase.
- R9 — El sistema deberá poder recargar en el proyecto de desarrollo los datos de ejemplo
  (140 reses, 4 lotes, precios) con un solo comando, sin tocar producción.
- R10 — El sistema deberá tener pruebas unitarias (`npm test`) del motor de punto de
  equilibrio actual y pruebas E2E (`npm run test:e2e`) de login y de registro de pesaje,
  usando un usuario de prueba.
- R11 — El sistema deberá desplegarse en Vercel leyendo la URL y la llave pública de
  Supabase desde variables de entorno.

## Fuera de alcance
- El nuevo diseño visual y el layout para celular (spec 002).
- Módulos nuevos: costos, ciclos, ventas, "Al partir" v2, recomendación v2.
- Tablas que solo usan módulos futuros (`costos`, `ventas`, `movimientos`, `jornadas_pesaje`,
  `condicion_pasto`, `visitas_verificacion`): se crean en la spec de su sprint.
- Roles distintos de `dueno` en la interfaz (el esquema los admite).

## Diseño
- **Datos:** migraciones SQL versionadas en `supabase/migrations/` para `perfiles`,
  `fincas`, `potreros`, `lotes`, `tenedores`, `contratos_al_partir`, `animales`, `pesajes`,
  `eventos_sanitarios` y `precios_mercado` (campos en `docs/plan.md` §5). Constraints
  `UNIQUE`/`CHECK` para R5. Una política RLS por tabla: acceso si `auth.uid()` tiene perfil.
  Trigger que crea el perfil al registrarse el usuario. Vista `v_animales_estado` con peso
  actual y fecha del último pesaje.
- **Semilla:** `scripts/seed-supabase.mjs` transforma `src/data/seedAnimals.json` y
  `seedMercado.js` al nuevo esquema e inserta con la llave de servicio, solo si
  `SUPABASE_URL` apunta al proyecto de desarrollo (lee `.env.local`, nunca del bundle).
- **Cliente:** `src/lib/supabase.js` (cliente único). `AuthContext` pasa a usar
  `supabase.auth`. `DataContext` se reemplaza por hooks en `src/data/` con TanStack Query
  (`useAnimales`, `useAnimal`, `useLotes`, `usePrecios`, y mutaciones `useAddPeso`,
  `useAddSanidad`, `useAddAnimal`, `useAddPrecio`).
- **Dominio:** `src/utils/breakeven.js` se mueve a `src/domain/breakeven.js` sin cambiar la
  lógica (la v2 es de otra spec), con tests.
- **Pruebas:** Vitest para `src/domain/`; Playwright en `tests/e2e/` contra `npm run dev` con
  el usuario de `.env.test`.
- **Archivos que se tocan:** `src/context/*`, `src/pages/*` (solo la capa de datos),
  `src/main.jsx`, `package.json`, `.env.example`, `supabase/`, `scripts/`, `tests/`.
- **Decisión clave:** usar TanStack Query en lugar de un contexto propio con `useEffect`,
  porque da caché, reintentos y estados de carga y error de forma uniforme (R7) sin escribirlos
  pantalla por pantalla. La alternativa descartada es llamar a Supabase directamente desde
  cada página, que duplica el manejo de errores.
- **Dependencias nuevas (requieren aprobación):** `@supabase/supabase-js`,
  `@tanstack/react-query`, `vitest`, `@playwright/test`.

## Tareas
- [ ] T1 Crear el proyecto Supabase de desarrollo y `.env.example` — verifica: la app lee la URL desde `import.meta.env`
- [ ] T2 Migraciones del esquema, constraints, RLS, trigger de perfil y vista — verifica: `get_advisors` de Supabase sin alertas de seguridad
- [ ] T3 Script de semilla — verifica: conteos 140 animales / 4 lotes / 9 precios en desarrollo
- [ ] T4 Cliente Supabase y `AuthContext` con Supabase Auth; borrar `seedUsers.js` — verifica: `grep` sin contraseñas en `dist/`
- [ ] T5 Hooks de datos con TanStack Query y migración de las 6 páginas — verifica: recorrido manual de las 6 pantallas
- [ ] T6 Estados de carga y error compartidos — verifica: cortar la red en DevTools muestra el mensaje de error
- [ ] T7 Mover el motor a `src/domain/` + Vitest — verifica: `npm test`
- [ ] T8 Playwright: login correcto, login incorrecto, ruta protegida y registro de pesaje — verifica: `npm run test:e2e`
- [ ] T9 Proyecto en Vercel con variables de entorno — verifica: URL de preview funcionando
- [ ] T10 Correr el `verificador` sobre esta spec

## Criterios de aceptación para el verificador
- Con el usuario de prueba: entrar, abrir un animal, registrar un peso de 355,5 kg, recargar y
  verlo; abrir otra sesión del navegador y verlo también.
- Intentar registrar un animal con un número interno que ya existe: la app muestra el error y
  la base de datos no crea el registro.
- Sin sesión, abrir `#/animales` lleva a `/login` y, tras entrar, vuelve a `#/animales`.
- `dist/` no contiene `service_role` ni contraseñas.

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-09-27 — antes de implementar (incluye las 4 dependencias nuevas)
