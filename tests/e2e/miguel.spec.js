import { deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';

// Sprint 05 · "La app de Miguel" (specs 015–021). Todo lo que crea lleva el prefijo E2E-S5 y se
// borra al terminar.
const P = 'E2E-S5';

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
  // Spec 024: cada foto tiene su miniatura (-mini) al lado.
  if (fotos.length) await supabase.storage.from('fotos-animales').remove([...fotos, ...fotos.map((r) => r.replace(/(\.[a-z]+)$/, '-mini$1'))]);
  for (const a of animales ?? []) {
    await supabase.from('ventas_equinos').delete().eq('animal_id', a.id);
    await supabase.from('animales').delete().eq('id', a.id);
  }
  await supabase.from('costos').delete().like('descripcion', `${P}%`);
  await supabase.from('precios_referencia').delete().like('fuente', `${P}%`);
  await supabase.from('lotes').delete().like('codigo', `${P}%`);
  await supabase.from('fincas').delete().like('nombre', `${P}%`);
}
test.beforeAll(async () => {
  test.setTimeout(120_000);
  await limpiar();
});
test.afterAll(async () => {
  test.setTimeout(120_000);
  await limpiar();
});

async function loteSeed(supabase, codigo = 'LOTE-2026-B') {
  const { data } = await supabase.from('lotes').select('id').eq('codigo', codigo).single();
  return data.id;
}

async function animalPorRpc(supabase, numero, extra = {}) {
  const loteId = await loteSeed(supabase);
  const { data, error } = await supabase.rpc('registrar_animal', {
    datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: '2026-09-01', peso_ingreso_kg: 250, lote_id: loteId, ...extra },
  });
  if (error) throw error;
  return data;
}

// PNG RGB de ancho × alto (sin dependencias), para probar la reducción de fotos (spec 017 · R2).
function png(ancho, alto) {
  const crc = (buf) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (tipo, datos) => {
    const t = Buffer.from(tipo);
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(Buffer.concat([t, datos])));
    return Buffer.concat([largo, t, datos, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const fila = Buffer.alloc(1 + ancho * 3);
  const filas = [];
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      fila[1 + x * 3] = (x * 7 + y) & 255;
      fila[2 + x * 3] = (y * 3) & 255;
      fila[3 + x * 3] = (x ^ y) & 255;
    }
    filas.push(Buffer.from(fila));
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(filas))), chunk('IEND', Buffer.alloc(0))]);
}

test.describe('celular', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('015 · R2, R3, R1: menú de 4, accesos grandes en Inicio y sin clima ni TRM', async ({ page }) => {
    await iniciarSesion(page);
    const barra = page.getByRole('navigation', { name: 'Principal' }).last();
    for (const nombre of ['Inicio', 'Animales', 'Gastos', '¿Vendo?']) await expect(barra.getByRole('link', { name: nombre })).toBeVisible();
    const accesos = page.getByRole('navigation', { name: 'Accesos rápidos' });
    for (const nombre of ['Registrar animal', 'Pesar', 'Anotar gasto', '¿Vendo hoy?']) await expect(accesos.getByRole('link', { name: nombre })).toBeVisible();
    await barra.getByRole('button', { name: 'Más' }).click();
    const hoja = page.getByRole('dialog', { name: 'Más secciones' });
    await expect(hoja.getByRole('link', { name: 'Precio y pasto' })).toBeVisible();
    await expect(hoja.getByRole('link', { name: 'Indicadores' })).toHaveCount(0);
    await hoja.getByRole('link', { name: 'Precio y pasto' }).click();
    await expect(page.getByRole('heading', { name: 'Precio y pasto' })).toBeVisible();
    await expect(page.getByText(/clima|TRM|Open-Meteo/i)).toHaveCount(0);
    // R4: el texto base mide 18 px y los botones al menos 56 px.
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('18px');
    const alto = await page.getByRole('button', { name: /Actualizar/ }).first().evaluate((b) => b.getBoundingClientRect().height);
    expect(alto).toBeGreaterThanOrEqual(56);
    // La ruta de indicadores sigue existiendo para el equipo.
    await page.goto('/#/indicadores');
    await expect(page.getByRole('heading', { name: 'Indicadores del proyecto' })).toBeVisible();
  });

  test('015 · R6: al bajar más allá del final, la barra inferior no se mueve', async ({ page }) => {
    await iniciarSesion(page);
    await page.goto('/#/animales');
    await expect(page.getByRole('heading', { name: 'Animales' })).toBeVisible();
    const barra = page.getByRole('navigation', { name: 'Principal' }).last();
    const antes = await barra.boundingBox();
    await page.mouse.wheel(0, 50_000);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => getComputedStyle(document.body).overscrollBehaviorY)).toBe('none');
    expect((await barra.boundingBox()).y).toBe(antes.y);
  });
});

test('016 · R1, R4, R7 y 018: registrar con dueño y compra por kilo (miles en vivo), editar, dar de baja y eliminar', async ({ page }) => {
  test.setTimeout(90_000);
  const supabase = await clientePrueba();
  await iniciarSesion(page);
  await page.goto('/#/animales?nuevo=1');
  let hoja = page.getByRole('dialog', { name: 'Registrar animal' });
  // 018 · R2: caracteres raros no.
  await hoja.getByLabel(/^Nombre/).fill(`${P}<1>`);
  await hoja.getByLabel('Chapeta ICA').fill(`${P}-CH1`);
  await hoja.getByLabel('Peso inicial').fill('250');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja.getByRole('alert')).toContainText('solo puede tener letras');
  await hoja.getByLabel(/^Nombre/).fill(`${P}-1`);
  await hoja.getByLabel('Dueño').fill(`${P} Familia`);
  await hoja.getByText('Compré por kilo', { exact: true }).click();
  const precio = hoja.getByLabel('Precio por kilo');
  await precio.pressSequentially('8000');
  await expect(precio).toHaveValue('8.000'); // 018 · R1
  await expect(hoja.getByTestId('cuenta-compra')).toHaveText('$8.000 × 250 kg = $2.000.000'); // 023 · R6
  await expect(hoja.getByText('Precio por animal')).toBeVisible(); // 016 · R7
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toHaveCount(0);
  const { data: a } = await supabase.from('animales').select('id, dueno, costo_compra_cop, precio_compra_kg_cop, peso_objetivo_kg').eq('numero_interno', `${P}-1`).single();
  expect(a).toMatchObject({ dueno: `${P} Familia`, costo_compra_cop: 2_000_000, precio_compra_kg_cop: 8_000, peso_objetivo_kg: null });

  // R1: editar (el dueño se sugiere de la lista de existentes).
  await page.goto(`/#/animales/${a.id}`);
  await page.getByRole('button', { name: 'Editar' }).click();
  hoja = page.getByRole('dialog', { name: `Editar ${P}-1` });
  await hoja.getByLabel('Dueño').fill(`${P} José`);
  await hoja.getByLabel('Categoría').selectOption('ternero');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toHaveCount(0);
  await expect(page.getByText(`${P} José`)).toBeVisible();

  // R3: dar de baja.
  await page.getByRole('button', { name: 'Dar de baja' }).click();
  hoja = page.getByRole('dialog', { name: /Dar de baja/ });
  await hoja.getByLabel('Detalle').fill('Picadura de culebra');
  await hoja.getByRole('button', { name: 'Dar de baja' }).click();
  await expect(page.getByText(/Dado de baja el .* \(muerto\): Picadura de culebra/)).toBeVisible();
  const { data: muerto } = await supabase.from('animales').select('estado, fecha_baja, categoria, dueno').eq('id', a.id).single();
  expect(muerto).toMatchObject({ estado: 'muerto', categoria: 'ternero', dueno: `${P} José` });

  // R2: eliminar (registro por error).
  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('dialog', { name: /Eliminar/ }).getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page).toHaveURL(/#\/animales$/);
  const { count } = await supabase.from('animales').select('id', { count: 'exact', head: true }).eq('id', a.id);
  expect(count).toBe(0);
});

test('016 · R5, R6: un vientre parida no pide peso objetivo y la base de datos no deja venderlo; 018 · R2 en la base', async ({ page }) => {
  const supabase = await clientePrueba();
  await iniciarSesion(page);
  await page.goto('/#/animales?nuevo=1');
  const hoja = page.getByRole('dialog', { name: 'Registrar animal' });
  await hoja.getByLabel('Sexo').selectOption('Hembra');
  await hoja.getByLabel('Categoría').selectOption('vientre_parida');
  await expect(hoja.getByLabel('Peso objetivo')).toHaveCount(0);
  await expect(hoja.getByText('no se venden ni llevan peso objetivo')).toBeVisible();

  const id = await animalPorRpc(supabase, `${P}-V`, { sexo: 'Hembra', categoria: 'vientre_parida' });
  const loteId = await loteSeed(supabase);
  const venta = await supabase.rpc('registrar_venta', { lote: loteId, fecha: '2026-10-01', comprador: `${P} comprador`, precio_kg: 8000, destare: 0, recomendacion: null, notas: null, animales: [{ animal_id: id, peso_kg: 400, costo_cop: 0 }] });
  expect(venta.error?.message).toMatch(/^vientre_no_se_vende/);
  const malo = await supabase.from('animales').update({ dueno: 'Ana<script>' }).eq('id', id);
  expect(malo.error?.code).toBe('23514');
});

test('016 · R8: registrar un caballo con precio en miles y venderlo por precio del animal', async ({ page }) => {
  const supabase = await clientePrueba();
  await iniciarSesion(page);
  await page.goto('/#/animales?ver=caballos');
  await page.getByRole('button', { name: 'Registrar caballo' }).click();
  let hoja = page.getByRole('dialog', { name: 'Registrar caballo' });
  await expect(hoja.getByLabel('Chapeta ICA')).toHaveCount(0);
  await hoja.getByLabel('Nombre').fill(`${P} Relámpago`);
  await hoja.getByLabel('Color').fill('Alazán');
  await hoja.getByLabel('Precio del animal').pressSequentially('3000000');
  await expect(hoja.getByLabel('Precio del animal')).toHaveValue('3.000.000');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toHaveCount(0);
  await page.getByRole('link', { name: new RegExp(`${P} Relámpago`) }).click();
  await page.getByRole('button', { name: 'Vender caballo' }).click();
  hoja = page.getByRole('dialog', { name: /Vender/ });
  await hoja.getByLabel('Comprador').fill(`${P} comprador caballo`);
  await hoja.getByLabel('Precio de venta').pressSequentially('3500000');
  await expect(hoja.getByText('ganancia de $500.000')).toBeVisible();
  await hoja.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(hoja).toHaveCount(0);
  await expect(page.getByText(/a .*comprador caballo por \$3\.500\.000/)).toBeVisible();
  const { data } = await supabase.from('animales').select('estado, especie, chapeta_ica, lote_id, ventas_equinos ( precio_cop )').eq('numero_interno', `${P} Relámpago`).single();
  expect(data).toMatchObject({ estado: 'vendido', especie: 'equino', chapeta_ica: null, lote_id: null });
  // ventas_equinos.animal_id es único: PostgREST lo trae como objeto.
  expect([data.ventas_equinos].flat()[0].precio_cop).toBe(3_500_000);
});

test('020 · R4: un gasto de toda la finca se guarda sin lote y no se reparte', async ({ page }) => {
  const supabase = await clientePrueba();
  await iniciarSesion(page);
  await page.goto('/#/costos?ver=finca');
  await expect(page.getByRole('heading', { level: 1, name: 'Gastos' })).toBeVisible();
  await page.getByRole('button', { name: 'Anotar gasto' }).first().click();
  const hoja = page.getByRole('dialog', { name: 'Anotar gasto' });
  await expect(hoja.getByLabel('De toda la finca')).toBeChecked();
  await hoja.getByLabel('Monto').pressSequentially('250000');
  await hoja.getByLabel('Descripción').fill(`${P} gasolina de la guadañadora`);
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toHaveCount(0);
  await expect(page.getByText(`${P} gasolina de la guadañadora`)).toBeVisible();
  await expect(page.getByText('$250.000').first()).toBeVisible();
  const { data } = await supabase.from('costos').select('lote_id, finca_id, monto_cop').like('descripcion', `${P} gasolina%`).single();
  expect(data.lote_id).toBeNull();
  expect(data.finca_id).not.toBeNull();
  expect(data.monto_cop).toBe(250_000);
  const ambos = await supabase.from('costos').insert({ lote_id: await loteSeed(supabase), finca_id: data.finca_id, categoria: 'otros', descripcion: `${P} doble`, monto_cop: 1, fecha: '2026-10-01' });
  expect(ambos.error?.code).toBe('23514');
});

test('020 · R1, R2: finca a nombre de una persona y lote con descripción', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/fincas');
  await page.getByRole('button', { name: 'Nueva finca' }).click();
  let hoja = page.getByRole('dialog', { name: 'Nueva finca' });
  await hoja.getByLabel('Nombre de la finca').fill(`${P} La Esperanza`);
  await hoja.getByLabel('A nombre de').fill('Familia Lacouture');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toHaveCount(0);
  const tarjeta = page.locator('article').filter({ hasText: `${P} La Esperanza` });
  await expect(tarjeta.getByText('A nombre de: Familia Lacouture')).toBeVisible();

  await page.goto('/#/animales');
  await page.getByRole('button', { name: 'Crear lote' }).first().click(); // spec 022 · R2
  hoja = page.getByRole('dialog', { name: 'Nuevo lote' });
  await hoja.getByLabel('Código').fill(`${P}-L1`);
  await hoja.getByLabel('Nombre').first().fill(`${P} Lote diciembre`);
  await hoja.getByLabel('Descripción').fill('Novillos para vender en diciembre');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`${P} Lote diciembre`) })).toBeVisible();
  await page.getByRole('button', { name: 'Editar lotes' }).click();
  await expect(page.getByRole('dialog', { name: 'Editar lotes' }).getByText('Novillos para vender en diciembre')).toBeVisible();
});

test('021 · R1, R2: actualizar el rango del ganado gordo', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/mercado');
  await page.getByRole('button', { name: /Actualizar Gordo/ }).click();
  const hoja = page.getByRole('dialog');
  await hoja.getByLabel('Mínimo por kilo').fill('');
  await hoja.getByLabel('Mínimo por kilo').pressSequentially('8100');
  await hoja.getByLabel('Máximo por kilo').fill('');
  await hoja.getByLabel('Máximo por kilo').pressSequentially('9300');
  await hoja.getByLabel('Fuente').fill(`${P} subasta de prueba`);
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toHaveCount(0);
  await expect(page.getByText('$8.100 – $9.300')).toBeVisible();
  await expect(page.getByText('Mitad: $8.700/kg')).toBeVisible();
});

test('019 · R1–R3 y 025 · R9: vender un solo animal desde su ficha con el simulador', async ({ page }) => {
  test.setTimeout(90_000);
  const supabase = await clientePrueba();
  const id = await animalPorRpc(supabase, `${P}-VENTA`);
  await iniciarSesion(page);
  await page.goto(`/#/animales/${id}`);
  await page.getByRole('link', { name: 'Vender este animal' }).click();
  await expect(page.getByRole('heading', { name: 'Simulador de venta' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: `Vender ${P}-VENTA` })).toBeChecked();
  await expect(page.getByText('Precio de la zona:')).toBeVisible(); // 025 · R3
  await page.getByLabel('Precio de venta por kilo').pressSequentially('9000');
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('alert')).toContainText('comprador');
  await page.getByLabel('Comprador').fill(`${P} comprador`);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('heading', { name: 'Confirma la venta' })).toBeVisible();
  await expect(page.getByText(/1 res de .*\$9\.000\/kg/)).toBeVisible();
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByRole('heading', { name: /^Venta de / })).toBeVisible();
  const { data } = await supabase.from('animales').select('estado').eq('id', id).single();
  expect(data.estado).toBe('vendido');
});

test('017 y 024 · R1–R5: una foto de 3000×2000 se cuadra, se guarda en 800 px con su miniatura y se ve en la lista', async ({ page }) => {
  test.setTimeout(90_000);
  const supabase = await clientePrueba();
  const id = await animalPorRpc(supabase, `${P}-FOTO`);
  await iniciarSesion(page);
  await page.goto(`/#/animales/${id}`);
  await page.getByLabel('Elegir de la galería').setInputFiles({ name: 'vaca.png', mimeType: 'image/png', buffer: png(3000, 2000) });
  // 024 · R2: el recortador cuadrado se abre; "Listo" guarda.
  const recortador = page.getByRole('dialog', { name: 'Cuadrar la foto' });
  await expect(recortador.getByTestId('recortador')).toBeVisible({ timeout: 15_000 });
  await recortador.getByRole('button', { name: 'Listo' }).click();
  const img = page.getByRole('img', { name: `Foto de ${P}-FOTO` });
  await expect(img).toBeVisible({ timeout: 30_000 });
  const { data } = await supabase.from('animales').select('foto_path').eq('id', id).single();
  expect(data.foto_path).toMatch(new RegExp(`^${id}/\\d+\\.(webp|jpg)$`));
  const { data: blob, error } = await supabase.storage.from('fotos-animales').download(data.foto_path);
  expect(error).toBeNull();
  expect(blob.size).toBeLessThanOrEqual(300 * 1024); // 024 · R4
  const { data: mini } = await supabase.storage.from('fotos-animales').download(data.foto_path.replace(/(\.[a-z]+)$/, '-mini$1'));
  expect(mini.size).toBeLessThanOrEqual(40 * 1024);
  const [ancho, alto] = await img.evaluate((el) => [el.naturalWidth, el.naturalHeight]);
  expect([ancho, alto]).toEqual([800, 800]);
  // R3: sin sesión no se puede leer.
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/storage/v1/object/fotos-animales/${data.foto_path}`, { headers: { apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
  expect(res.status).toBeGreaterThanOrEqual(400);
  // R4: miniatura en la lista.
  await page.goto('/#/animales');
  await page.getByPlaceholder('Buscar por nombre, chapeta, dueño o raza').fill(`${P}-FOTO`);
  await expect(page.locator(`img[alt="Foto de ${P}-FOTO"]`).first()).toBeAttached();
});
