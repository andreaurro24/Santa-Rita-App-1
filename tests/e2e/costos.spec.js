import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';

// Spec 008 · gastos por lote y por animal. Limpia lo que crea (descripciones con prefijo E2E).

const PREFIJO = 'E2E gasto';
const LOTE = 'LOTE-2026-B';

async function limpiar() {
  const supabase = await clientePrueba();
  await supabase.from('costos').delete().like('descripcion', `${PREFIJO}%`);
}
test.beforeEach(limpiar);
test.afterAll(limpiar);

async function datosLote(supabase) {
  const { data: lote } = await supabase.from('lotes').select('id').eq('codigo', LOTE).single();
  const { data: animales } = await supabase.from('animales').select('id, numero_interno, costo_compra_cop').eq('lote_id', lote.id).order('numero_interno');
  return { loteId: lote.id, animales };
}

const pesos = (n) => `$${new Intl.NumberFormat('es-CO').format(Math.round(n))}`;

test('R1, R3, R4: un gasto de $1.000.000 en un lote de 30 suma $33.333 a cada animal; uno directo solo a ese animal', async ({ page }) => {
  const supabase = await clientePrueba();
  const { loteId, animales } = await datosLote(supabase);
  expect(animales).toHaveLength(30);
  const [a, b] = animales;

  await iniciarSesion(page);
  await page.goto(`/#/costos?lote=${loteId}`);
  await expect(page.getByRole('heading', { name: 'Gastos', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Anotar gasto' }).first().click();
  let hoja = page.getByRole('dialog', { name: 'Anotar gasto' });
  await hoja.getByLabel('Categoría').selectOption('suplemento');
  await hoja.getByLabel('Monto').fill('1000000');
  await hoja.getByLabel('Descripción').fill(`${PREFIJO} suplemento del lote`);
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toHaveCount(0);
  await expect(page.getByText(`${PREFIJO} suplemento del lote`)).toBeVisible();

  await page.getByRole('button', { name: 'Anotar gasto' }).first().click();
  hoja = page.getByRole('dialog', { name: 'Anotar gasto' });
  await hoja.getByLabel('¿Para quién?').selectOption({ label: `Solo el animal ${b.numero_interno}` });
  await hoja.getByLabel('Categoría').selectOption('medicamentos');
  await hoja.getByLabel('Monto').fill('50000');
  await hoja.getByLabel('Descripción').fill(`${PREFIJO} tratamiento de ${b.numero_interno}`);
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toHaveCount(0);

  // Ficha de A: compra + 33.333
  await page.goto(`/#/animales/${a.id}`);
  const costoA = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Costo acumulado' }) });
  await expect(costoA).toContainText(pesos(a.costo_compra_cop + 1_000_000 / 30));
  await expect(costoA).toContainText('Suplemento: $33.333');

  // Ficha de B: compra + 33.333 + 50.000
  await page.goto(`/#/animales/${b.id}`);
  const costoB = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Costo acumulado' }) });
  await expect(costoB).toContainText(pesos(b.costo_compra_cop + 1_000_000 / 30 + 50_000));
  await expect(costoB).toContainText('Medicamentos: $50.000');
});

test('R2: validaciones en la interfaz y en la base de datos', async ({ page }) => {
  const supabase = await clientePrueba();
  const { loteId, animales } = await datosLote(supabase);
  await iniciarSesion(page);
  await page.goto(`/#/costos?lote=${loteId}`);
  await page.getByRole('button', { name: 'Anotar gasto' }).first().click();
  const hoja = page.getByRole('dialog', { name: 'Anotar gasto' });
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja.getByRole('alert')).toHaveText(/Describe el gasto/);
  await hoja.getByLabel('Descripción').fill(`${PREFIJO} inválido`);
  // Spec 018 · R1 (verificación Sprint 05, M1): "-5" se rechaza con aviso, no se convierte en 5.
  await hoja.getByLabel('Monto').fill('-5');
  await expect(hoja.getByLabel('Monto')).toHaveValue('');
  await expect(hoja.getByText('Solo pesos enteros')).toBeVisible();
  await hoja.getByLabel('Monto').fill('1000');
  await hoja.getByLabel('Fecha').fill('2099-01-01');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja.getByRole('alert')).toHaveText(/no puede ser futura/);

  const base = { lote_id: loteId, categoria: 'otros', descripcion: `${PREFIJO} api`, fecha: '2026-09-01' };
  expect((await supabase.from('costos').insert({ ...base, monto_cop: 0 })).error?.code).toBe('23514');
  expect((await supabase.from('costos').insert({ ...base, monto_cop: 10, fecha: '2099-01-01' })).error?.message).toMatch(/^fecha_futura/);
  const { data: otro } = await supabase.from('animales').select('id').neq('lote_id', loteId).limit(1).single();
  expect((await supabase.from('costos').insert({ ...base, monto_cop: 10, animal_id: otro.id })).error?.message).toMatch(/^animal_de_otro_lote/);
  expect(animales.length).toBeGreaterThan(0);
});

test('R5, R6: resumen del lote, edición y borrado con confirmación', async ({ page }) => {
  const supabase = await clientePrueba();
  const { loteId } = await datosLote(supabase);
  await supabase.from('costos').insert([
    { lote_id: loteId, categoria: 'sal_mineral', descripcion: `${PREFIJO} sal`, monto_cop: 300_000, fecha: '2026-09-10' },
    { lote_id: loteId, categoria: 'jornales', descripcion: `${PREFIJO} jornales`, monto_cop: 600_000, fecha: '2026-09-11' },
  ]);
  await iniciarSesion(page);
  await page.goto(`/#/costos?lote=${loteId}`);
  const resumen = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Resumen del lote' }) });
  await expect(resumen).toContainText('$900.000');
  await expect(resumen).toContainText('Jornales');

  await page.getByRole('button', { name: `Editar gasto ${PREFIJO} sal` }).click();
  const hoja = page.getByRole('dialog', { name: 'Editar gasto' });
  await hoja.getByLabel('Monto').fill('400000');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(resumen).toContainText('$1.000.000');

  await page.getByRole('button', { name: `Borrar gasto ${PREFIJO} jornales` }).click();
  await page.getByRole('dialog', { name: '¿Borrar este gasto?' }).getByRole('button', { name: 'Borrar gasto' }).click();
  await expect(page.getByText(`${PREFIJO} jornales`)).toHaveCount(0);
  await expect(resumen).toContainText('$400.000');

  const { data: lote } = await supabase.from('lotes').select('id').eq('id', loteId).single();
  await page.goto(`/#/lotes/${lote.id}`);
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Costos' }) })).toContainText('$400.000');
});
