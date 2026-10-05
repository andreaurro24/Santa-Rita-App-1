import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';

// Specs 009 (pasto y destare), 010 (recomendación v2) y 011 (ventas). Limpia lo que crea.

const COMPRADOR = 'E2E Comprador';
const NOTA_PASTO = 'E2E pasto';

async function ids(supabase) {
  const { data: lotes } = await supabase.from('lotes').select('id, codigo');
  const { data: finca } = await supabase.from('fincas').select('id').eq('tipo', 'propia').single();
  return { lote: Object.fromEntries(lotes.map((l) => [l.codigo, l.id])), fincaPropia: finca.id };
}

async function limpiar() {
  const supabase = await clientePrueba();
  const { data: ventas } = await supabase.from('ventas').select('id, lote_id, animales:venta_animales ( animal_id )').eq('comprador', COMPRADOR);
  for (const v of ventas ?? []) {
    const animales = v.animales.map((a) => a.animal_id);
    await supabase.from('ventas').delete().eq('id', v.id);
    if (animales.length) await supabase.from('animales').update({ estado: 'activo' }).in('id', animales);
    await supabase.from('lotes').update({ estado: 'activo' }).eq('id', v.lote_id);
  }
  await supabase.from('condicion_pasto').delete().like('notas', `${NOTA_PASTO}%`);
  await supabase.from('parametros').update({ destare_pct: 0 }).eq('id', true);
}
test.beforeEach(limpiar);
test.afterAll(limpiar);

test('009 R1–R3: registrar el pasto de una finca y cambiar el destare', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/mercado');
  const pasto = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Estado del pasto' }) });
  await pasto.getByRole('button', { name: 'Registrar estado' }).click();
  const hoja = page.getByRole('dialog', { name: 'Registrar estado del pasto' });
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja.getByRole('alert')).toHaveText('Elige cómo está el pasto.');
  await hoja.getByRole('combobox').first().selectOption({ label: 'Finca Santa Rita' }); // el nombre accesible incluye la opción elegida
  await hoja.getByText('Escaso').click();
  await hoja.getByLabel('Notas').fill(`${NOTA_PASTO} seco`);
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toHaveCount(0);
  await expect(pasto.getByRole('listitem').filter({ hasText: 'Finca Santa Rita' })).toContainText('Escaso');

  const parametros = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Parámetros de venta' }) });
  await parametros.getByRole('button', { name: 'Cambiar destare' }).click();
  const d = page.getByRole('dialog', { name: 'Cambiar destare' });
  await d.getByLabel('Destare (%)').fill('20');
  await d.getByRole('button', { name: 'Guardar' }).click();
  await expect(d.getByRole('alert')).toHaveText('El destare debe estar entre 0 y 15 %.');
  await d.getByLabel('Destare (%)').fill('3,5');
  await d.getByRole('button', { name: 'Guardar' }).click();
  await expect(parametros).toContainText('3,5 %');
});

test('009 R4: la base de datos rechaza una fecha futura y un nivel inválido', async () => {
  const supabase = await clientePrueba();
  const { fincaPropia } = await ids(supabase);
  expect((await supabase.from('condicion_pasto').insert({ finca_id: fincaPropia, fecha: '2099-01-01', nivel: 'rojo', notas: NOTA_PASTO })).error?.message).toMatch(/^fecha_futura/);
  expect((await supabase.from('condicion_pasto').insert({ finca_id: fincaPropia, fecha: '2026-09-01', nivel: 'morado', notas: NOTA_PASTO })).error?.code).toBe('23514');
});

test('010: el lote en la meta recomienda vender, con equilibrio real, escenarios y sensibilidad', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/recomendacion');
  await page.getByLabel('Lote a evaluar').selectOption({ label: 'Lote 2025-B (Ceba – próximo a venta)' });
  await expect(page.getByText('Vender ahora')).toBeVisible();
  // Spec 015 · R5: las cifras de detalle están plegadas en "Ver detalles".
  await expect(page.getByText('Punto de equilibrio real').first()).toBeHidden();
  await page.getByText('Ver detalles').click();
  await expect(page.getByText('Punto de equilibrio real').first()).toBeVisible();
  for (const fila of ['Hoy', 'En 2 semanas', 'En 4 semanas', 'En 8 semanas']) await expect(page.getByRole('cell', { name: new RegExp(`^${fila}`) })).toBeVisible();
  await expect(page.getByText(/^[−+]10 %/).first()).toBeVisible();
});

test('010 R5: con el pasto en rojo, un lote a mitad de ciclo recomienda vender antes de la meta', async ({ page }) => {
  const supabase = await clientePrueba();
  const { fincaPropia } = await ids(supabase);
  await supabase.from('condicion_pasto').insert({ finca_id: fincaPropia, fecha: '2026-09-25', nivel: 'rojo', notas: `${NOTA_PASTO} rojo` });
  await iniciarSesion(page);
  await page.goto('/#/recomendacion');
  await page.getByLabel('Lote a evaluar').selectOption({ label: 'Lote 2026-A (Ceba – mitad de ciclo)' });
  await expect(page.getByText('Vender antes de la meta')).toBeVisible();
  await expect(page.getByText(/El pasto está en rojo/)).toBeVisible();
});

test('010 R5: con un precio muy bajo recomienda no vender', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/recomendacion');
  await page.getByLabel('Lote a evaluar').selectOption({ label: 'Lote 2026-A (Ceba – mitad de ciclo)' });
  await page.getByLabel('Probar con otro precio por kilo').fill('1000');
  await expect(page.getByText('No vender todavía')).toBeVisible();
  await expect(page.getByText(/dejaría una pérdida/)).toBeVisible();
});

test('011 R1–R6: vender 2 animales de un lote, ver el resultado, la comparación y los estados', async ({ page }) => {
  const supabase = await clientePrueba();
  const { lote } = await ids(supabase);
  await iniciarSesion(page);
  await page.goto(`/#/ventas/nueva?lote=${lote['LOTE-2025-B']}`);
  await expect(page.getByRole('heading', { name: 'Registrar venta' })).toBeVisible();
  const casillas = page.getByRole('checkbox', { name: /^Vender / });
  const total = await casillas.count();
  const vendidos = [];
  for (let i = 0; i < total; i++) {
    if (i < 2) vendidos.push((await casillas.nth(i).getAttribute('aria-label')).replace('Vender ', ''));
    else await casillas.nth(i).uncheck();
  }
  await expect(page.getByRole('heading', { name: `Animales (2 de ${total})` })).toBeVisible();
  // Spec 019 · R2: asistente en 3 pasos; cada paso valida lo suyo.
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('alert')).toHaveText('Escribe el nombre del comprador.');
  await page.getByLabel('Comprador').fill(COMPRADOR);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Guardar venta' }).click();

  await expect(page.getByRole('heading', { name: /^Venta de Lote 2025-B/ })).toBeVisible();
  await expect(page.getByText('Siguió la recomendación')).toBeVisible();
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Resultado real' }) })).toContainText('2');

  const { data: animales } = await supabase.from('animales').select('numero_interno, estado').in('numero_interno', vendidos);
  expect(animales.map((a) => a.estado)).toEqual(['vendido', 'vendido']);
  const { data: l } = await supabase.from('lotes').select('estado').eq('id', lote['LOTE-2025-B']).single();
  expect(l.estado).toBe('activo'); // le quedan animales activos

  await page.goto('/#/ventas');
  await expect(page.getByRole('link', { name: /Lote 2025-B/ })).toContainText(COMPRADOR);
});

test('011 R2: la base de datos no deja vender un vientre ni un animal de otro lote', async () => {
  const supabase = await clientePrueba();
  const { lote } = await ids(supabase);
  const { data: hembra } = await supabase.from('animales').select('id').eq('lote_id', lote['CRIA-2025-2026']).eq('sexo', 'Hembra').limit(1).single();
  await supabase.from('animales').update({ categoria: 'vientre_mayor' }).eq('id', hembra.id); // spec 016 · R5
  try {
    const base = { fecha: '2026-09-20', comprador: COMPRADOR, precio_kg: 8000, destare: 0, recomendacion: null, notas: null };
    const vientre = await supabase.rpc('registrar_venta', { ...base, lote: lote['CRIA-2025-2026'], animales: [{ animal_id: hembra.id, peso_kg: 200, costo_cop: 0 }] });
    expect(vientre.error?.message).toMatch(/^vientre_no_se_vende/);
    const otro = await supabase.rpc('registrar_venta', { ...base, lote: lote['LOTE-2026-A'], animales: [{ animal_id: hembra.id, peso_kg: 200, costo_cop: 0 }] });
    expect(otro.error?.message).toMatch(/^animal_de_otro_lote/);
    const { count } = await supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('comprador', COMPRADOR);
    expect(count).toBe(0);
  } finally {
    await supabase.from('animales').update({ categoria: 'ternera' }).eq('id', hembra.id);
  }
});
