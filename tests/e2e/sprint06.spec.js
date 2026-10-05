import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';

// Sprint 06 · specs 022–025 (hato en una página, registro v3, fotos cuadradas y simulador de venta).
// Todo lo que crea lleva el prefijo E2E-S6 y se borra al terminar.
const P = 'E2E-S6';
const mini = (ruta) => ruta.replace(/(\.[a-z]+)$/, '-mini$1');

async function limpiar() {
  const supabase = await clientePrueba();
  const { data: ventas } = await supabase.from('ventas').select('id, venta_animales ( animal_id )').like('comprador', `${P}%`);
  for (const v of ventas ?? []) {
    const ids = v.venta_animales.map((x) => x.animal_id);
    await supabase.from('ventas').delete().eq('id', v.id);
    if (ids.length) await supabase.from('animales').update({ estado: 'activo' }).in('id', ids);
  }
  const { data: animales } = await supabase.from('animales').select('id, foto_path').like('numero_interno', `${P}%`);
  const fotos = (animales ?? []).map((a) => a.foto_path).filter(Boolean);
  if (fotos.length) await supabase.storage.from('fotos-animales').remove([...fotos, ...fotos.map(mini)]);
  for (const a of animales ?? []) await supabase.from('animales').delete().eq('id', a.id);
  await supabase.from('lotes').delete().like('codigo', `${P}%`);
}
test.beforeAll(async () => {
  test.setTimeout(120_000);
  await limpiar();
});
test.afterAll(async () => {
  test.setTimeout(120_000);
  await limpiar();
});

const haceDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
};

async function crearLote(supabase, sufijo) {
  const { data, error } = await supabase.from('lotes').insert({ codigo: `${P}-${sufijo}`, nombre: `${P} Lote ${sufijo}`, tipo: 'ceba', estado: 'activo' }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function animal(supabase, loteId, numero, extra = {}) {
  const { data, error } = await supabase.rpc('registrar_animal', {
    datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: haceDias(60), peso_ingreso_kg: 250, lote_id: loteId, ...extra },
  });
  if (error) throw error;
  return data;
}

test('023 · R1–R6: registrar con nombre sugerido, raza, nacimiento sin mes, tres pesos y compra con la cuenta', async ({ page }) => {
  test.setTimeout(90_000);
  const supabase = await clientePrueba();
  const lote = await crearLote(supabase, 'R');
  await iniciarSesion(page);
  await page.goto(`/#/animales?lote=${lote}&nuevo=1`);
  const hoja = page.getByRole('dialog', { name: 'Registrar animal' });
  await hoja.getByLabel(/^Nombre/).fill(`${P} Luna`);
  await hoja.getByRole('button', { name: /^Usar «/ }).click(); // R1
  const nombre = await hoja.getByLabel(/^Nombre/).inputValue();
  expect(nombre).toMatch(new RegExp(`^${P} Luna-\\d{3}$`));
  await hoja.getByLabel('Chapeta ICA').fill(`${P}-CH1`);
  await hoja.getByLabel('Año').selectOption('2024'); // R3: mes desconocido
  await hoja.getByLabel('Raza').fill('Brahman'); // R2
  await hoja.getByLabel('Lote').selectOption(lote);
  await hoja.getByLabel('Peso inicial (kg)').fill('250');
  // R5: si entró hoy, el peso actual es el inicial y no se cambia.
  await expect(hoja.getByLabel('Peso actual (kg)')).toBeDisabled();
  await expect(hoja.getByLabel('Peso actual (kg)')).toHaveValue('250');
  await hoja.getByLabel('Fecha de ingreso').fill(haceDias(60));
  await hoja.getByLabel('Peso actual (kg)').fill('310');
  await hoja.getByLabel('Peso objetivo (kg)').fill('450');
  // R6: por kilo multiplica; por animal divide.
  await hoja.getByLabel('Precio por kilo').pressSequentially('9000');
  await expect(hoja.getByTestId('cuenta-compra')).toHaveText('$9.000 × 250 kg = $2.250.000');
  await hoja.getByText('Compré por animal', { exact: true }).click();
  await hoja.getByLabel('Precio por animal').pressSequentially('2250000');
  await expect(hoja.getByTestId('cuenta-compra')).toHaveText('$2.250.000 ÷ 250 kg = $9.000 por kilo');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toHaveCount(0);

  const { data: a } = await supabase
    .from('animales')
    .select('id, raza, fecha_nacimiento, nacimiento_mes_conocido, peso_objetivo_kg, costo_compra_cop, precio_compra_kg_cop, pesajes ( fecha, peso_kg )')
    .eq('numero_interno', nombre)
    .single();
  expect(a).toMatchObject({ raza: 'Brahman', fecha_nacimiento: '2024-01-01', nacimiento_mes_conocido: false, costo_compra_cop: 2_250_000, precio_compra_kg_cop: 9_000 });
  expect(a.pesajes.map((p) => Number(p.peso_kg)).sort()).toEqual([250, 310]); // R4: dos pesajes

  await page.goto(`/#/animales/${a.id}`);
  await expect(page.getByText(/Nació en 2024 \(unos/)).toBeVisible();
  await expect(page.getByText('1,00 kg/día').first()).toBeVisible();
});

test('023 · R8: la base de datos rechaza raza con caracteres raros, día distinto de 1 y peso actual con ingreso hoy', async () => {
  const supabase = await clientePrueba();
  const lote = await crearLote(supabase, 'DB');
  for (const extra of [{ raza: '<script>' }, { fecha_nacimiento: '2024-03-15', nacimiento_mes_conocido: true }, { fecha_ingreso: haceDias(0), peso_actual_kg: 300 }]) {
    const { error } = await supabase.rpc('registrar_animal', {
      datos: { numero_interno: `${P}-MAL-${Object.keys(extra)[0]}`, chapeta_ica: `${P}-MAL`, sexo: 'Macho', categoria: 'novillo', fecha_ingreso: haceDias(10), peso_ingreso_kg: 250, lote_id: lote, ...extra },
    });
    expect(error?.code, JSON.stringify(extra)).toBe('23514');
  }
});

test('022 · R1–R6: lotes arriba, tabla con pesos y precio, filtro que sobrevive a recargar y sin desbordes en 375 px', async ({ page }) => {
  const supabase = await clientePrueba();
  const lote = await crearLote(supabase, 'T');
  await animal(supabase, lote, `${P}-T1`, { peso_objetivo_kg: 450, raza: 'Gyr', precio_compra_kg_cop: 8_000 });
  await iniciarSesion(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/animales');
  await page.getByRole('button', { name: new RegExp(`${P} Lote T`) }).click();
  await expect(page).toHaveURL(new RegExp(`lote=${lote}`));
  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(`${P} Lote T`) })).toHaveAttribute('aria-pressed', 'true');
  const fila = page.getByRole('row').filter({ hasText: `${P}-T1` });
  await expect(fila).toContainText('250 kg');
  await expect(fila).toContainText('$8.000');
  await expect(page.getByText(/1–1 de 1 animal/)).toBeVisible();
  // R5: busca por raza.
  await page.getByPlaceholder('Buscar por nombre, chapeta, dueño o raza').fill('gyr');
  await expect(fila).toBeVisible();
  // R6: la meta del lote sale de los animales.
  await page.goto(`/#/lotes/${lote}`);
  await expect(page.getByText('450 kg').first()).toBeVisible();
  // 375 px: sin desplazamiento horizontal de la página.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/#/animales?lote=${lote}`);
  await expect(page.getByRole('heading', { name: 'Animales', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('025 · R1–R8: simular la venta de dos lotes con transporte, guardarla una sola vez y ver los mismos números', async ({ page }) => {
  test.setTimeout(120_000);
  const supabase = await clientePrueba();
  const a = await crearLote(supabase, 'VA');
  const b = await crearLote(supabase, 'VB');
  await animal(supabase, a, `${P}-VA1`, { peso_actual_kg: 300, costo_compra_cop: 1_000_000 });
  await animal(supabase, b, `${P}-VB1`, { peso_actual_kg: 350, costo_compra_cop: 1_500_000 });
  await animal(supabase, b, `${P}-VB2`, { categoria: 'vientre_mayor', sexo: 'Hembra' });
  await iniciarSesion(page);
  await page.goto('/#/ventas/nueva');
  await expect(page.getByRole('heading', { name: 'Simulador de venta' })).toBeVisible();
  await page.getByRole('checkbox', { name: `Vender el lote ${P} Lote VA` }).check();
  await page.getByRole('checkbox', { name: `Vender el lote ${P} Lote VB` }).check();
  await expect(page.getByText('1 vientre no se vende.')).toBeVisible(); // R4
  await page.getByLabel('Precio de venta por kilo').pressSequentially('8000');
  await page.getByLabel('Comisiones y transporte').pressSequentially('300000');
  // 650 kg × $8.000 = $5.200.000 − $2.500.000 − $300.000 (sin destare de prueba si el parámetro es 0).
  const neto = page.getByTestId('beneficio-neto').first();
  const textoNeto = await neto.textContent();
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  await page.getByLabel('Comprador').fill(`${P} comprador`);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Guardar venta' }).dblclick(); // 025 · R5: doble toque
  await expect(page.getByRole('heading', { name: new RegExp(`^Venta de ${P} Lote VA y ${P} Lote VB`) })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Comisiones y transporte')).toBeVisible();
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Resultado real' }) })).toContainText(textoNeto.replace('+', '').trim());

  const { data: ventas } = await supabase.from('ventas').select('id, gastos_venta_cop, venta_animales ( lote_id )').eq('comprador', `${P} comprador`);
  expect(ventas).toHaveLength(1);
  expect(Number(ventas[0].gastos_venta_cop)).toBe(300_000);
  expect(new Set(ventas[0].venta_animales.map((x) => x.lote_id))).toEqual(new Set([a, b]));
  const { data: lotes } = await supabase.from('lotes').select('id, estado').in('id', [a, b]);
  expect(Object.fromEntries(lotes.map((l) => [l.id, l.estado]))).toEqual({ [a]: 'vendido', [b]: 'activo' }); // el vientre sigue en B
});
