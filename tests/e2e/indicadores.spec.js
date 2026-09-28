import { expect, test } from '@playwright/test';
import { iniciarSesion } from './helpers';

// Spec 012 · indicadores, carga por rutas y ficha imprimible.

test('R1: los indicadores muestran el hato registrado, el historial y los lotes', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/');
  await page.getByRole('link', { name: /Indicadores del proyecto/ }).click();
  await expect(page.getByRole('heading', { name: 'Indicadores del proyecto' })).toBeVisible();
  await expect(page.getByText(/Hoy: 100 % de 140 reses activas/)).toBeVisible();
  await expect(page.getByText(/Hoy: 100 % \(140 reses\)/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lote 2026-A (Ceba – mitad de ciclo)' })).toBeVisible();
  await expect(page.getByText('Antes: 0 (consulta manual dispersa)')).toBeVisible();
});

test('R3: las pantallas se cargan por partes y funcionan al navegar', async ({ page }) => {
  const scripts = new Set();
  page.on('response', (r) => {
    if (r.url().endsWith('.js') || r.url().includes('/src/pages/')) scripts.add(r.url());
  });
  await iniciarSesion(page);
  for (const [ruta, titulo] of [
    ['/#/lotes', 'Lotes y ciclos'],
    ['/#/costos', 'Insumos y costos'],
    ['/#/ventas', 'Ventas'],
    ['/#/indicadores', 'Indicadores del proyecto'],
  ]) {
    await page.goto(ruta);
    await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible();
  }
  expect([...scripts].some((u) => u.includes('Lotes'))).toBe(true);
});

test('R4: la ficha del animal se imprime sin navegación ni botones', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/animales');
  await page.getByPlaceholder(/Buscar por número interno/).fill('0101');
  await page.getByRole('link', { name: '0101', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Imprimir ficha' })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: 'Imprimir ficha' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Registrar peso' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Animal N° 0101' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Costo acumulado' })).toBeVisible();
});
