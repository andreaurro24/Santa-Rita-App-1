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

export async function entrar(page, { email, password } = credenciales()) {
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

export async function iniciarSesion(page) {
  await page.goto('/#/login');
  await entrar(page);
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
}

// Cliente autenticado como el usuario de prueba, para preparar o limpiar datos.
export async function clientePrueba() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.auth.signInWithPassword(credenciales());
  if (error) throw error;
  return supabase;
}
