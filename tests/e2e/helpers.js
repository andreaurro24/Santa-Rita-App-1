import { expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

export const credenciales = () => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error('Faltan TEST_USER_EMAIL / TEST_USER_PASSWORD en .env.test (ver .env.example).');
  }
  return { email, password };
};

// Clave donde supabase-js guarda la sesión en el navegador: sb-<ref>-auth-token.
const CLAVE_SESION = () => `sb-${new URL(process.env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

// Un solo inicio de sesión por proceso de Playwright. Supabase Auth limita los inicios de
// sesión por IP, y con más de 50 pruebas que entraban una por una la suite chocaba con ese
// límite (verificación 002, ronda 1). Las pruebas del flujo de login usan `entrar()`, que sí
// pasa por el formulario.
let clienteEnCache;
export function clientePrueba() {
  clienteEnCache ??= (async () => {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.auth.signInWithPassword(credenciales());
    if (error) {
      clienteEnCache = undefined;
      throw error;
    }
    return supabase;
  })();
  return clienteEnCache;
}

export async function entrar(page, { email, password } = credenciales()) {
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

// Deja la página con sesión iniciada reutilizando la sesión en caché (sin pasar por Auth).
export async function iniciarSesion(page) {
  const supabase = await clientePrueba();
  const { data } = await supabase.auth.getSession();
  await page.goto('/#/login');
  await page.evaluate(([clave, valor]) => localStorage.setItem(clave, valor), [CLAVE_SESION(), JSON.stringify(data.session)]);
  await page.goto('/#/');
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}
