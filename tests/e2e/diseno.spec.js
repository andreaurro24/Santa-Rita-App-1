import { expect, test } from '@playwright/test';
import { iniciarSesion } from './helpers';

// Spec 002 · R3, R4, R5, R9, R10 — layout adaptable y tamaños táctiles.

const RUTAS = ['/#/', '/#/animales', '/#/pesaje', '/#/lotes', '/#/fincas', '/#/mercado', '/#/recomendacion', '/#/reporte'];

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('R3: ninguna pantalla tiene scroll horizontal y la navegación inferior está visible', async ({ page }) => {
    await iniciarSesion(page);
    for (const ruta of RUTAS) {
      await page.goto(ruta);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
      expect.soft(ancho, `${ruta} desborda`).toBeLessThanOrEqual(375);
      const main = await page.locator('main').boundingBox();
      expect.soft(main.width, `${ruta} área útil`).toBeGreaterThanOrEqual(360);
    }
    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link', { name: 'Hato' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Más' })).toBeVisible();
  });

  test('R5: los controles visibles miden al menos 48 px de alto', async ({ page }) => {
    await iniciarSesion(page);
    for (const ruta of ['/#/', '/#/animales', '/#/pesaje', '/#/lotes', '/#/fincas', '/#/recomendacion']) {
      await page.goto(ruta);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const pequenos = await page.evaluate(() =>
        [...document.querySelectorAll('main button, main a[href], main input, main select, nav a, nav button')]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({ texto: (el.innerText || el.getAttribute('aria-label') || el.placeholder || el.tagName).trim().slice(0, 30), alto: el.getBoundingClientRect().height }))
          .filter((c) => c.alto < 47.5),
      );
      expect.soft(pequenos, `${ruta}: controles de menos de 48 px`).toEqual([]);
    }
  });

  test('R10: el hato se ve como tarjetas y "Más" abre las demás secciones', async ({ page }) => {
    await iniciarSesion(page);
    await page.goto('/#/animales');
    await expect(page.getByRole('table')).toBeHidden();
    await expect(page.getByRole('link', { name: /0101/ })).toBeVisible();
    await page.getByRole('button', { name: 'Más' }).click();
    await page.getByRole('dialog', { name: 'Más secciones' }).getByRole('link', { name: 'Mercado y clima' }).click();
    await expect(page.getByRole('heading', { name: 'Mercado y clima' })).toBeVisible();
  });

  test('R9: el formulario de nuevo animal es una hoja inferior con Guardar siempre visible', async ({ page }) => {
    await iniciarSesion(page);
    await page.goto('/#/animales');
    await page.getByRole('button', { name: 'Registrar animal' }).click();
    const dialogo = page.getByRole('dialog');
    const caja = await dialogo.boundingBox();
    expect(caja.x).toBe(0);
    expect(Math.round(caja.width)).toBe(375);
    expect(Math.round(caja.y + caja.height)).toBe(812);
    await expect(dialogo.getByRole('button', { name: 'Guardar' })).toBeInViewport();
    await dialogo.getByRole('button', { name: 'Cerrar' }).click();
    await expect(dialogo).toHaveCount(0);
  });
});

test('R4: en escritorio hay navegación lateral y no inferior', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await iniciarSesion(page);
  await expect(page.getByRole('complementary').getByRole('link', { name: 'Mercado y clima' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Más' })).toBeHidden();
  await page.goto('/#/animales');
  await expect(page.getByRole('table')).toBeVisible();
});

test('R11: al imprimir el reporte no salen la navegación ni los controles', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await iniciarSesion(page);
  await page.goto('/#/reporte');
  await expect(page.getByRole('article')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('complementary')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Imprimir o guardar PDF' })).toBeHidden();
  await expect(page.getByLabel('Lote')).toBeHidden();
  await expect(page.getByRole('article')).toBeVisible();
  await expect(page.getByRole('article')).toContainText('Justificación');
});
