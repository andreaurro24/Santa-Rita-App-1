import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';

// Spec 001 · R4, R5, R6, R8 — registro de pesaje y validaciones contra Supabase.

const ANIMAL = '0102'; // animal de la semilla (npm run db:seed)
const PESO = '355.5';
const PESO_ES = '355,5'; // así se muestra (es-CO, spec 012)

async function abrirAnimal(page, numero) {
  await page.goto('/#/animales');
  await page.getByPlaceholder(/Buscar por número/).fill(numero);
  await page.getByRole('link', { name: numero, exact: true }).click();
  await expect(page.getByRole('heading', { name: `Animal N° ${numero}` })).toBeVisible();
}

test.afterAll(async () => {
  // Deja la base de datos como estaba: borra los pesajes que crearon estas pruebas.
  const supabase = await clientePrueba();
  const { data: animal } = await supabase.from('animales').select('id').eq('numero_interno', ANIMAL).single();
  await supabase.from('pesajes').delete().eq('animal_id', animal.id).eq('peso_kg', Number(PESO));
});

test('R4/R6: un pesaje se guarda, sobrevive a la recarga y se ve desde otra sesión', async ({ page, browser }) => {
  await iniciarSesion(page);
  await abrirAnimal(page, ANIMAL);

  await page.getByRole('button', { name: 'Registrar peso' }).click();
  await page.getByLabel('Peso (kg)').fill(PESO);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(`${PESO_ES} kg`, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(`${PESO_ES} kg`, { exact: true })).toBeVisible();

  // Otra sesión, sin compartir almacenamiento con la primera.
  const otra = await browser.newContext();
  const page2 = await otra.newPage();
  await iniciarSesion(page2);
  await abrirAnimal(page2, ANIMAL);
  await expect(page2.getByText(`${PESO_ES} kg`, { exact: true })).toBeVisible();
  await otra.close();
});

test('R5: un peso negativo o en cero no se guarda', async ({ page }) => {
  await iniciarSesion(page);
  await abrirAnimal(page, ANIMAL);
  await page.getByRole('button', { name: 'Registrar peso' }).click();

  for (const valor of ['-10', '0']) {
    await page.getByLabel('Peso (kg)').fill(valor);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('alert')).toHaveText('El peso debe estar entre 0,1 y 1.499 kg.');
  }
});

test('R5: la base de datos rechaza un peso inválido aunque se salte la interfaz', async () => {
  const supabase = await clientePrueba();
  const { data: animal } = await supabase.from('animales').select('id').eq('numero_interno', ANIMAL).single();
  const { error } = await supabase.from('pesajes').insert({ animal_id: animal.id, fecha: '2026-09-01', peso_kg: -5 });
  expect(error?.code).toBe('23514');
});

test('R5: no se puede registrar un animal con un número interno que ya existe', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/animales');
  await page.getByRole('button', { name: 'Registrar animal' }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel(/Número interno/).fill('0101');
  await dialogo.getByLabel(/Chapeta ICA/).fill('COL-E2E-DUPLICADO');
  await dialogo.getByLabel(/Peso de ingreso/).fill('200');
  await dialogo.getByLabel(/Peso objetivo/).fill('350');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo.getByRole('alert')).toHaveText(/Ya existe un animal con ese número interno/);

  const supabase = await clientePrueba();
  const { count } = await supabase.from('animales').select('id', { count: 'exact', head: true }).eq('chapeta_ica', 'COL-E2E-DUPLICADO');
  expect(count).toBe(0);
});

test('R8: las seis pantallas cargan datos de Supabase', async ({ page }) => {
  await iniciarSesion(page);
  await expect(page.getByText('Reses activas')).toBeVisible();

  const pantallas = [
    ['/#/animales', 'Animales'],
    ['/#/mercado', 'Precio y pasto'],
    ['/#/recomendacion', '¿Vendo?'],
    ['/#/reporte', 'Reporte resumen de apoyo a la decisión'],
  ];
  for (const [ruta, titulo] of pantallas) {
    await page.goto(ruta);
    await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.goto('/#/animales');
  await expect(page.getByText(/\d+ reses activas/)).toBeVisible();
});
