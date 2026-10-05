import { expect, test } from '@playwright/test';
import { credenciales, entrar, iniciarSesion } from './helpers';

// Spec 001 · R1, R2, R3

test('R2: sin sesión, una ruta protegida lleva al login y tras entrar vuelve a esa ruta', async ({ page }) => {
  await page.goto('/#/animales');
  await expect(page).toHaveURL(/#\/login$/);
  await entrar(page);
  await expect(page).toHaveURL(/#\/animales$/);
  await expect(page.getByRole('heading', { name: 'Animales', level: 1 })).toBeVisible();
});

test('R1: contraseña incorrecta muestra un error y no entra', async ({ page }) => {
  await page.goto('/#/login');
  await entrar(page, { email: credenciales().email, password: 'contraseña-equivocada' });
  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');
  await expect(page).toHaveURL(/#\/login$/);
});

test('R1: campos vacíos piden correo y contraseña sin llamar al servidor', async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Escribe tu correo y tu contraseña.');
});

test('R1: el login de demostración con contraseñas visibles ya no existe', async ({ page }) => {
  await page.goto('/#/login');
  await expect(page.getByText('santarita2026')).toHaveCount(0);
  await expect(page.getByText('Acceso de demostración')).toHaveCount(0);
});

test('R3: cerrar sesión vuelve al login y protege las rutas otra vez', async ({ page }) => {
  await iniciarSesion(page);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/#\/login/);
  await page.goto('/#/mercado');
  await expect(page).toHaveURL(/#\/login$/);
});

test('la sesión se mantiene al recargar la página', async ({ page }) => {
  await iniciarSesion(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
});
