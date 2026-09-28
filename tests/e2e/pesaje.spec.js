import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';

// Spec 004 · jornada de pesaje por lote y GDP. Limpia lo que crea (jornadas y pesajes).

const LOTE = 'LOTE-2026-B';
const ANIMAL_PERDIDA = '0120';

async function loteId(supabase) {
  const { data } = await supabase.from('lotes').select('id').eq('codigo', LOTE).single();
  return data.id;
}

async function limpiar() {
  const supabase = await clientePrueba();
  const id = await loteId(supabase);
  const { data: jornadas } = await supabase.from('jornadas_pesaje').select('id').eq('lote_id', id);
  for (const j of jornadas ?? []) {
    await supabase.from('pesajes').delete().eq('jornada_id', j.id);
    await supabase.from('jornadas_pesaje').delete().eq('id', j.id);
  }
  const { data: a } = await supabase.from('animales').select('id').eq('numero_interno', ANIMAL_PERDIDA).single();
  await supabase.from('pesajes').delete().eq('animal_id', a.id).eq('peso_kg', 101.1);
}

test.beforeAll(limpiar);
test.afterAll(limpiar);

async function ultimoPeso(page) {
  const texto = await page.getByText(/^Último peso:/).innerText();
  return Number(texto.match(/([\d.,]+) kg/)[1].replace(/\./g, '').replace(',', '.'));
}

test('R1–R4, R8: jornada de 3 animales con confirmación por variación, cierre e historial', async ({ page }) => {
  const supabase = await clientePrueba();
  await iniciarSesion(page);
  await page.goto('/#/pesaje');
  await expect(page.getByRole('heading', { name: 'Jornada de pesaje' })).toBeVisible();
  await page.getByLabel('Lote').selectOption(await loteId(supabase));
  await page.getByRole('button', { name: 'Abrir jornada' }).click();
  await expect(page).toHaveURL(/#\/pesaje\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('avance')).toHaveText('0 de 30 pesados');

  // 1: peso normal (+2 kg)
  let anterior = await ultimoPeso(page);
  await page.getByLabel(/^Peso de \d+ \(kg\)$/).fill(String(anterior + 2).replace('.', ','));
  await page.getByRole('button', { name: 'Guardar peso' }).click();
  await expect(page.getByTestId('avance')).toHaveText('1 de 30 pesados');

  // 2: +30 % pide confirmación (R3); "Corregir" no guarda, "Guardar igual" sí
  anterior = await ultimoPeso(page);
  const alto = Math.round(anterior * 1.3 * 10) / 10;
  await page.getByLabel(/^Peso de \d+ \(kg\)$/).fill(String(alto));
  await page.getByRole('button', { name: 'Guardar peso' }).click();
  const dialogo = page.getByRole('dialog', { name: '¿El peso es correcto?' });
  await expect(dialogo).toContainText('+30 %');
  await dialogo.getByRole('button', { name: 'Corregir' }).click();
  await expect(page.getByTestId('avance')).toHaveText('1 de 30 pesados');
  await page.getByRole('button', { name: 'Guardar peso' }).click();
  await page.getByRole('dialog', { name: '¿El peso es correcto?' }).getByRole('button', { name: 'Guardar igual' }).click();
  await expect(page.getByTestId('avance')).toHaveText('2 de 30 pesados');

  // Saltar uno y pesar el siguiente
  await page.getByRole('button', { name: 'Saltar' }).click();
  anterior = await ultimoPeso(page);
  await page.getByLabel(/^Peso de \d+ \(kg\)$/).fill(String(anterior + 1));
  await page.getByRole('button', { name: 'Guardar peso' }).click();
  await expect(page.getByTestId('avance')).toHaveText('3 de 30 pesados');

  // R4: cerrar con 27 sin pesar, listados
  await page.getByRole('button', { name: 'Cerrar jornada' }).first().click();
  const cierre = page.getByRole('dialog', { name: 'Cerrar jornada' });
  await expect(cierre).toContainText('Quedan 27 animales sin pesar');
  await cierre.getByRole('button', { name: 'Cerrar jornada' }).click();
  await expect(page.getByText(/, cerrada$/)).toBeVisible();

  // R8: historial del lote
  await page.goto('/#/pesaje');
  await page.getByLabel('Lote').selectOption(await loteId(supabase));
  const fila = page.getByRole('link', { name: /3 pesados/ });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('Cerrada');
});

test('R1: no se puede abrir una jornada con fecha futura', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/pesaje');
  await page.getByLabel('Fecha de la jornada').fill('2099-01-01');
  await page.getByRole('button', { name: 'Abrir jornada' }).click();
  await expect(page.getByRole('alert')).toHaveText('La fecha de la jornada no puede ser futura.');
});

test('la base de datos impide pesar dos veces el mismo animal en una jornada', async () => {
  const supabase = await clientePrueba();
  const id = await loteId(supabase);
  const { data: j, error } = await supabase.from('jornadas_pesaje').insert({ lote_id: id, fecha: '2026-09-01' }).select('id').single();
  expect(error).toBeNull();
  const { data: a } = await supabase.from('animales').select('id').eq('lote_id', id).limit(1).single();
  const fila = { animal_id: a.id, fecha: '2026-09-01', peso_kg: 150, jornada_id: j.id };
  expect((await supabase.from('pesajes').insert(fila)).error).toBeNull();
  expect((await supabase.from('pesajes').insert(fila)).error?.code).toBe('23505');
});

test('R5, R7: un peso más bajo que el de hace 14 días o más marca "Pierde peso" en la ficha y en el panel', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/animales');
  await page.getByPlaceholder(/Buscar por número interno/).fill(ANIMAL_PERDIDA);
  await page.getByRole('link', { name: ANIMAL_PERDIDA, exact: true }).click();
  await expect(page.getByText('Pierde peso')).toHaveCount(0);
  await page.getByRole('button', { name: 'Registrar peso' }).click();
  await page.getByLabel('Peso (kg)').fill('101.1');
  await page.getByRole('button', { name: 'Guardar' }).click();
  // −70 %: la ficha pide confirmación (R3) antes de guardar.
  await expect(page.getByRole('dialog', { name: 'Registrar peso' }).getByRole('alert')).toContainText('¿Es correcto?');
  await page.getByRole('button', { name: 'Guardar igual' }).click();
  await expect(page.getByText('Pierde peso').first()).toBeVisible();
  await expect(page.getByText(/Ganancia diaria \(último periodo\)/)).toBeVisible();

  await page.goto('/#/');
  const tarjeta = page.getByRole('region', { name: 'Pierden peso' }).or(page.locator('section', { hasText: 'Pierden peso' }));
  await expect(tarjeta.getByRole('link', { name: ANIMAL_PERDIDA, exact: true })).toBeVisible();
});
