import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';

// Spec 006 · lotes, proyección, fincas, potreros y movimientos. Limpia lo que crea.

const POTRERO = 'E2E Potrero La Ceiba';
const POTRERO_API = 'E2E Potrero API';
const LOTE_NUEVO = 'E2E-LOTE-1';
const MOTIVO = 'E2E rotación de potrero';
const MOTIVO_API = 'E2E movimiento inválido';

async function limpiar() {
  const supabase = await clientePrueba();
  const { data: movs } = await supabase.from('movimientos').select('id, animal_id, desde_finca_id, desde_potrero_id, desde_lote_id')
    .in('motivo', [MOTIVO, MOTIVO_API]);
  for (const m of movs ?? []) {
    await supabase.from('animales').update({ finca_id: m.desde_finca_id, potrero_id: m.desde_potrero_id, lote_id: m.desde_lote_id }).eq('id', m.animal_id);
    await supabase.from('movimientos').delete().eq('id', m.id);
  }
  await supabase.from('potreros').delete().in('nombre', [POTRERO, POTRERO_API]);
  await supabase.from('lotes').delete().eq('codigo', LOTE_NUEVO);
}

test.beforeAll(limpiar);
test.afterAll(limpiar);

test('R2, R3 y spec 022 · R1/R7: los lotes están en Animales y el detalle muestra la proyección', async ({ page }) => {
  const supabase = await clientePrueba();
  await iniciarSesion(page);
  await page.goto('/#/lotes'); // 022 · R7: lleva a Animales
  await expect(page).toHaveURL(/#\/animales$/);
  await expect(page.getByRole('heading', { name: 'Animales', level: 1 })).toBeVisible();
  const tarjeta = page.getByRole('button', { name: /Lote 2026-A/ });
  await expect(tarjeta).toContainText(/cabezas?/);
  await tarjeta.click(); // 022 · R1: filtra la tabla y la URL lo recuerda
  await expect(page).toHaveURL(/lote=/);
  await expect(tarjeta).toHaveAttribute('aria-pressed', 'true');
  const { data: lote } = await supabase.from('lotes').select('id').eq('codigo', 'LOTE-2026-A').single();
  await page.goto(`/#/lotes/${lote.id}`);
  await expect(page.getByText(/Llega a la meta/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver a Animales' })).toBeVisible();
});

test('R1: crear y editar un lote', async ({ page }) => {
  await iniciarSesion(page);
  // Spec 022 · R2/R6: "Crear lote" desde Animales, sin meta de peso.
  await page.goto('/#/animales');
  await page.getByRole('button', { name: 'Crear lote' }).first().click();
  const dialogo = page.getByRole('dialog', { name: 'Nuevo lote' });
  await expect(dialogo.getByLabel(/Meta de peso/)).toHaveCount(0);
  await dialogo.getByLabel('Código').fill(LOTE_NUEVO.toLowerCase());
  await dialogo.getByLabel('Nombre').fill('Lote de prueba E2E');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('button', { name: /Lote de prueba E2E/ })).toHaveAttribute('aria-pressed', 'true');
  const supabase = await clientePrueba();
  const { data: creado } = await supabase.from('lotes').select('codigo, peso_meta_kg').eq('codigo', LOTE_NUEVO).single();
  expect(creado).toEqual({ codigo: LOTE_NUEVO, peso_meta_kg: null }); // el código se guarda en mayúsculas

  // "Editar lotes" → Editar
  await page.getByRole('button', { name: 'Editar lotes' }).click();
  await page.getByRole('dialog', { name: 'Editar lotes' }).locator('li').filter({ hasText: 'Lote de prueba E2E' }).getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('dialog', { name: 'Editar lote' }).getByLabel('Nombre').fill('Lote de prueba E2E editado');
  await page.getByRole('dialog', { name: 'Editar lote' }).getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('button', { name: /Lote de prueba E2E editado/ })).toBeVisible();

  // Código repetido
  await page.getByRole('button', { name: 'Crear lote' }).first().click();
  const otro = page.getByRole('dialog', { name: 'Nuevo lote' });
  await otro.getByLabel('Código').fill(LOTE_NUEVO);
  await otro.getByLabel('Nombre').fill('Duplicado');
  await otro.getByRole('button', { name: 'Guardar' }).click();
  await expect(otro.getByRole('alert')).toHaveText(/Ya existe un lote con ese código/);
});

test('R5–R7: crear un potrero, mover 2 animales a él y ver la ubicación y el historial', async ({ page }) => {
  const supabase = await clientePrueba();
  await iniciarSesion(page);

  await page.goto('/#/fincas');
  const santaRita = page.getByRole('article').filter({ hasText: 'Finca Santa Rita' });
  await santaRita.getByRole('button', { name: 'Agregar potrero' }).click();
  await santaRita.getByLabel('Nombre del potrero').fill(POTRERO);
  await santaRita.getByLabel('Área (ha)').fill('12.5');
  await santaRita.getByRole('button', { name: 'Guardar potrero' }).click();
  await expect(santaRita.getByText(POTRERO)).toBeVisible();

  const { data: lote } = await supabase.from('lotes').select('id').eq('codigo', 'LOTE-2026-A').single();
  await page.goto(`/#/lotes/${lote.id}`);
  const casillas = page.getByRole('checkbox');
  const primero = (await casillas.nth(0).getAttribute('aria-label')).replace('Seleccionar ', '');
  await casillas.nth(0).check();
  await casillas.nth(1).check();
  await page.getByRole('button', { name: 'Mover seleccionados (2)' }).click();
  const mover = page.getByRole('dialog', { name: 'Mover 2 animales' });
  await mover.getByRole('button', { name: 'Mover' }).click();
  await expect(mover.getByRole('alert')).toHaveText('Elige una finca o un lote de destino.');
  await mover.getByLabel('Finca de destino').selectOption({ label: 'Finca Santa Rita' });
  await mover.getByLabel('Potrero').selectOption({ label: POTRERO });
  await mover.getByLabel('Motivo').fill(MOTIVO);
  await mover.getByRole('button', { name: 'Mover' }).click();
  await expect(mover).toHaveCount(0);

  const { count } = await supabase.from('movimientos').select('id', { count: 'exact', head: true }).eq('motivo', MOTIVO);
  expect(count).toBe(2);

  await page.goto('/#/animales');
  await page.getByPlaceholder(/Buscar por nombre/).fill(primero);
  await page.getByRole('link', { name: primero, exact: true }).click();
  const ubicacion = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ubicación' }) });
  await expect(ubicacion).toContainText(POTRERO);
  await expect(ubicacion).toContainText(MOTIVO);

  await page.goto('/#/fincas');
  await expect(page.getByRole('article').filter({ hasText: 'Finca Santa Rita' }).getByRole('listitem').filter({ hasText: POTRERO })).toContainText('2 reses');
});

test('la base de datos rechaza un movimiento sin destino, con fecha futura o a un potrero de otra finca', async () => {
  const supabase = await clientePrueba();
  const { data: a } = await supabase.from('animales').select('id').eq('numero_interno', '0101').single();
  const { data: fincas } = await supabase.from('fincas').select('id, tipo');
  const tenedor = fincas.find((f) => f.tipo === 'tenedor');
  const { data: pot } = await supabase.from('potreros').insert({ finca_id: fincas.find((f) => f.tipo === 'propia').id, nombre: POTRERO_API }).select('id').single();

  const sinDestino = await supabase.rpc('mover_animales', { ids: [a.id], fecha: '2026-09-01', motivo: MOTIVO_API });
  expect(sinDestino.error?.message).toMatch(/^sin_destino/);
  const futura = await supabase.rpc('mover_animales', { ids: [a.id], fecha: '2099-01-01', motivo: MOTIVO_API, finca_destino: tenedor.id });
  expect(futura.error?.message).toMatch(/^fecha_futura/);
  const otraFinca = await supabase.rpc('mover_animales', { ids: [a.id], fecha: '2026-09-01', motivo: MOTIVO_API, finca_destino: tenedor.id, potrero_destino: pot.id });
  expect(otraFinca.error?.message).toMatch(/^potrero_de_otra_finca/);
  const { count } = await supabase.from('movimientos').select('id', { count: 'exact', head: true }).eq('motivo', MOTIVO_API);
  expect(count).toBe(0);
});
