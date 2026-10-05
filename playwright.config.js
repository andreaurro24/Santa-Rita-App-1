import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { exigirProyectoDePruebas } from './scripts/proyectos.mjs';

// Spec 001 · R10: E2E contra `npm run dev` y el proyecto Supabase de DESARROLLO, con el
// usuario de prueba de .env.test (nunca credenciales reales).
for (const f of ['.env.local', '.env.test']) if (existsSync(f)) process.loadEnvFile(f);
// Spec 014 · R2: la suite crea y borra datos; nunca corre contra producción.
exigirProyectoDePruebas(process.env.VITE_SUPABASE_URL, 'La suite E2E');

// E2E_PORT permite correr dos suites a la vez (p. ej. desde un git worktree) sin compartir servidor.
const PORT = Number(process.env.E2E_PORT ?? 5174);

export default defineConfig({
  testDir: 'tests/e2e',
  // Las pruebas escriben en la misma base de datos: en serie para que no se pisen.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'escritorio', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
