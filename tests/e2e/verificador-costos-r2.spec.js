import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirControles, medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para la spec 008 (insumos y costos, D9), RONDA 2.
// Verifica las correcciones de la ronda 1: reparto histórico desde `movimientos` (repartirCostos,
// loteEnFecha, useRepartoCostos), gastos directos que siguen al animal, vendidos que dejan de
// recibir, edición de gastos de animales movidos (trigger de la migración 1400) y validaciones nuevas.
// Todo lo creado lleva el prefijo VRF-C2 (lotes, animales, descripciones, compradores) y se borra.

const DIR = 'test-results/vrf-008-r2';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-C2';

const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

async function limpiar() {
  const supabase = await clientePrueba();
  const { data: ventas } = await supabase.from('ventas').select('id').like('comprador', `${P}%`);
  for (const v of ventas ?? []) await supabase.from('ventas').delete().eq('id', v.id);
  await supabase.from('costos').delete().like('descripcion', `${P}%`);
  const { data: lotes } = await supabase.from('lotes').select('id').like('codigo', `${P}%`);
  for (const l of lotes ?? []) await supabase.from('costos').delete().eq('lote_id', l.id);
  const { data: animales } = await supabase.from('animales').select('id').like('numero_interno', `${P}%`);
  for (const a of animales ?? []) await supabase.from('animales').delete().eq('id', a.id);
  for (const l of lotes ?? []) await supabase.from('lotes').delete().eq('id', l.id);
}
test.beforeAll(limpiar);
test.afterAll(limpiar);

async function crearLote(supabase, sufijo) {
  const { data, error } = await supabase.from('lotes').insert({ codigo: `${P}-${sufijo}`, nombre: `${P} ${sufijo}`, tipo: 'ceba', peso_meta_kg: 400 }).select('id').single();
  if (error) throw error;
  return data.id;
}
async function crearAnimal(supabase, sufijo, loteId, { ingreso = haceDias(60), compra = 1_000_000 } = {}) {
  const numero = `${P}-${sufijo}`;
  const { data: id, error } = await supabase.rpc('registrar_animal', {
    datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: ingreso, peso_ingreso_kg: 250, peso_objetivo_kg: 400, costo_compra_cop: compra, lote_id: loteId },
  });
  if (error) throw error;
  return { id, numero };
}
const gasto = (loteId, monto, fecha, extra = {}) => ({ lote_id: loteId, categoria: 'suplemento', descripcion: `${P} ${monto} ${fecha}`, monto_cop: monto, fecha, ...extra });

// Navega dentro de la SPA (sin recargar: la caché de React Query se conserva) y lee "Costo acumulado".
async function costoEnFicha(page, id) {
  await page.evaluate((h) => {
    location.hash = h;
  }, `#/animales/${id}`);
  const tarjeta = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Costo acumulado' }) });
  await expect(tarjeta).toBeVisible();
  await page.waitForTimeout(300);
  const texto = (await tarjeta.innerText()).replace(/\s+/g, ' ');
  const valor = (label) => Number((texto.match(new RegExp(`${label} \\$([\\d.]+)`))?.[1] ?? 'NaN').replace(/\./g, ''));
  return { total: valor('Total'), directos: valor('Gastos directos'), deLote: valor('Parte de los gastos del lote') };
}
async function resumenCostos(page, loteId) {
  await page.evaluate((h) => {
    location.hash = h;
  }, `#/costos?lote=${loteId}`);
  const s = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Resumen del lote' }) });
  await expect(s).toBeVisible();
  await page.waitForTimeout(300);
  const texto = (await s.innerText()).replace(/\s+/g, ' ');
  const valor = (label) => Number((texto.match(new RegExp(`${label} \\$([\\d.]+)`))?.[1] ?? 'NaN').replace(/\./g, ''));
  return { gastado: valor('Gastado en el lote'), promedio: valor('Costo acumulado promedio por res') };
}

test('VRF 008 r2 · reparto histórico: mover con gasto directo (desde la ficha), llegar tarde y un vendido', async ({ page }) => {
  test.setTimeout(180_000);
  const supabase = await clientePrueba();
  const X = await crearLote(supabase, 'X');
  const Y = await crearLote(supabase, 'Y');
  const x1 = await crearAnimal(supabase, 'X1', X);
  const x2 = await crearAnimal(supabase, 'X2', X);
  const x3 = await crearAnimal(supabase, 'X3', X);
  const y1 = await crearAnimal(supabase, 'Y1', Y);
  const y2 = await crearAnimal(supabase, 'Y2', Y);
  // g1: X $900.000 hace 30 días (X1, X2, X3 → 300.000 c/u). g2: Y $200.000 hace 30 (Y1, Y2 → 100.000).
  // g3: $50.000 directos a X1 hace 20 (lote X).
  const ins = await supabase.from('costos').insert([gasto(X, 900_000, haceDias(30)), gasto(Y, 200_000, haceDias(30)), gasto(X, 50_000, haceDias(20), { animal_id: x1.id, categoria: 'medicamentos', descripcion: `${P} directo X1` })]);
  if (ins.error) throw ins.error;
  // Y2 se vende hace 10 días (spec 011, por la función). Luego g4: Y $100.000 hace 5 → solo Y1.
  const venta = await supabase.rpc('registrar_venta', { lote: Y, fecha: haceDias(10), comprador: `${P} comprador`, precio_kg: 8000, destare: 0, recomendacion: null, notas: null, animales: [{ animal_id: y2.id, peso_kg: 300, costo_cop: 1_100_000 }] });
  if (venta.error) throw venta.error;
  await supabase.from('costos').insert(gasto(Y, 100_000, haceDias(5)));

  const errores = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('response', (x) => x.status() >= 400 && !x.url().includes('/auth/v1/') && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
  await iniciarSesion(page);
  const r = { antes: {}, despues: {}, trasGastoNuevo: {} };
  for (const [k, a] of Object.entries({ x1, x2, y1, y2 })) r.antes[k] = await costoEnFicha(page, a.id);

  // Mover X1 de X a Y HOY desde la ficha (spec 006), sin recargar la página.
  await costoEnFicha(page, x1.id);
  await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ubicación' }) }).getByRole('button', { name: 'Mover' }).click();
  const hoja = page.getByRole('dialog', { name: `Mover ${x1.numero}` });
  await hoja.getByLabel('Lote de destino').selectOption({ label: `${P} Y` });
  await hoja.getByLabel('Motivo').fill(`${P} reagrupar`);
  await hoja.getByRole('button', { name: 'Mover' }).click();
  await expect(hoja).toHaveCount(0);
  await page.screenshot({ path: `${DIR}/01-ficha-tras-mover.png`, fullPage: true });
  for (const [k, a] of Object.entries({ x1, x2, x3, y1, y2 })) r.despues[k] = await costoEnFicha(page, a.id);

  // g5: Y $300.000 hoy, después del movimiento → Y1 y X1 (Y2 ya se vendió) → 150.000 c/u.
  await supabase.from('costos').insert(gasto(Y, 300_000, hoyBogota()));
  await page.reload();
  for (const [k, a] of Object.entries({ x1, x2, y1, y2 })) r.trasGastoNuevo[k] = await costoEnFicha(page, a.id);
  r.resumenX = await resumenCostos(page, X);
  r.resumenY = await resumenCostos(page, Y);
  await page.screenshot({ path: `${DIR}/02-costos-Y.png`, fullPage: true });

  // Detalle del lote Y (tarjeta Costos): mismo promedio.
  await page.goto(`/#/lotes/${Y}`);
  const tarjeta = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Costos' }) });
  await expect(tarjeta).toContainText('Gastado en el lote');
  r.tarjetaLoteY = (await tarjeta.innerText()).replace(/\s+/g, ' ');

  registrar('reparto histórico', r);
  registrar('consola y red', errores);
  // Antes de mover (cálculo a mano).
  expect(r.antes.x1).toEqual({ total: 1_350_000, directos: 50_000, deLote: 300_000 });
  expect(r.antes.x2.deLote).toBe(300_000);
  expect(r.antes.y1.deLote).toBe(200_000); // 100.000 (g2) + 100.000 (g4, Y2 ya vendido)
  expect(r.antes.y2).toEqual({ total: 1_100_000, directos: 0, deLote: 100_000 }); // vendido: no recibe g4
  // Después de mover X1 (sin recargar): nada cambia hacia atrás.
  expect(r.despues.x1).toEqual({ total: 1_350_000, directos: 50_000, deLote: 300_000 });
  expect(r.despues.x2.deLote).toBe(300_000);
  expect(r.despues.x3.deLote).toBe(300_000);
  expect(r.despues.y1.deLote).toBe(200_000);
  expect(r.despues.y2.deLote).toBe(100_000);
  // Gasto de Y posterior al movimiento: X1 (llegó hoy) y Y1; no Y2 (vendido).
  expect(r.trasGastoNuevo.x1).toEqual({ total: 1_500_000, directos: 50_000, deLote: 450_000 });
  expect(r.trasGastoNuevo.y1.deLote).toBe(350_000);
  expect(r.trasGastoNuevo.y2.deLote).toBe(100_000);
  expect(r.trasGastoNuevo.x2.deLote).toBe(300_000);
  // Resúmenes: X gastó 950.000 (con el directo de X1); promedio de sus activos de hoy (X2, X3) 1.300.000.
  expect(r.resumenX).toEqual({ gastado: 950_000, promedio: 1_300_000 });
  // Y gastó 600.000; promedio de sus activos de hoy (Y1 1.350.000, X1 1.500.000) = 1.425.000.
  expect(r.resumenY).toEqual({ gastado: 600_000, promedio: 1_425_000 });
  expect(r.tarjetaLoteY).toContain('$1.425.000');
});

test('VRF 008 r2 · movimientos con fecha pasada, fuera de orden, un animal muerto y un gasto sin animales', async ({ page }) => {
  test.setTimeout(150_000);
  const supabase = await clientePrueba();
  const Pl = await crearLote(supabase, 'P');
  const Q = await crearLote(supabase, 'Q');
  const R = await crearLote(supabase, 'R');
  const V = await crearLote(supabase, 'V'); // lote sin animales cuando se gasta
  const p1 = await crearAnimal(supabase, 'P1', Pl);
  const p2 = await crearAnimal(supabase, 'P2', Pl);
  const p3 = await crearAnimal(supabase, 'P3', Pl);
  const q1 = await crearAnimal(supabase, 'Q1', Q);
  await supabase.from('costos').insert([gasto(Pl, 200_000, haceDias(30)), gasto(Q, 100_000, haceDias(30)), gasto(Q, 90_000, haceDias(5))]);
  // P2 se pasó de P a Q hace 40 días, pero se registra hoy (movimiento con fecha pasada).
  const m1 = await supabase.rpc('mover_animales', { ids: [p2.id], fecha: haceDias(40), motivo: `${P} tarde`, lote_destino: Q });
  await iniciarSesion(page);
  const r = { m1: m1.error?.message ?? 'ok' };
  r.fechaPasada = { p1: (await costoEnFicha(page, p1.id)).deLote, p2: (await costoEnFicha(page, p2.id)).deLote, p3: (await costoEnFicha(page, p3.id)).deLote, q1: (await costoEnFicha(page, q1.id)).deLote };

  // D9 "activos": P3 muere (por API; no hay fecha de baja) y se gasta $100.000 en P hoy.
  await supabase.from('animales').update({ estado: 'muerto', fecha_baja: hoyBogota() }) /* Sprint 05: la baja lleva fecha */.eq('id', p3.id);
  await supabase.from('costos').insert(gasto(Pl, 100_000, hoyBogota()));
  await page.reload();
  r.muerto = { p1: (await costoEnFicha(page, p1.id)).deLote, p3: (await costoEnFicha(page, p3.id)).deLote };

  // Fuera de orden: hoy P2 va de Q a R; después se registra que el día −20 fue de "R" a P.
  const m2 = await supabase.rpc('mover_animales', { ids: [p2.id], fecha: hoyBogota(), motivo: `${P} a R`, lote_destino: R });
  const m3 = await supabase.rpc('mover_animales', { ids: [p2.id], fecha: haceDias(20), motivo: `${P} fuera de orden`, lote_destino: Pl });
  r.fueraDeOrden = { m2: m2.error?.message ?? 'ok', m3: m3.error?.message ?? 'aceptado' };
  const { data: p2bd } = await supabase.from('animales').select('lote_id').eq('id', p2.id).single();
  r.fueraDeOrden.loteActualP2EsP = p2bd.lote_id === Pl;
  // Un gasto de P hoy: P2 está hoy en P (según la BD y la ficha).
  await supabase.from('costos').insert(gasto(Pl, 60_000, hoyBogota(), { descripcion: `${P} P hoy tras fuera de orden` }));
  await page.reload();
  const fp2 = await costoEnFicha(page, p2.id);
  r.fueraDeOrden.p2 = fp2;
  r.fueraDeOrden.fichaP2Lote = (await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ubicación' }) }).innerText()).replace(/\s+/g, ' ').slice(0, 160);
  r.fueraDeOrden.p1 = (await costoEnFicha(page, p1.id)).deLote;

  // Un gasto de lote con fecha anterior al ingreso de todos sus animales (p. ej. arriendo pagado por adelantado).
  const v1 = await crearAnimal(supabase, 'V1', V, { ingreso: haceDias(10) });
  await supabase.from('costos').insert(gasto(V, 500_000, haceDias(15), { categoria: 'arriendo_pasto', descripcion: `${P} arriendo adelantado` }));
  await page.reload();
  r.sinAnimales = { resumen: await resumenCostos(page, V), v1: (await costoEnFicha(page, v1.id)).deLote };
  await page.goto(`/#/costos?lote=${V}`);
  r.sinAnimales.aviso = await page.getByText(/no lo carga|ningún animal|sin animales/i).count();
  await page.screenshot({ path: `${DIR}/03-gasto-sin-animales.png`, fullPage: true });

  registrar('fechas pasadas y fuera de orden', r);
  // Movimiento con fecha pasada: P2 estaba en Q hace 30 días → no paga el g de P; sí la mitad de los de Q.
  expect(r.m1).toBe('ok');
  expect(r.fechaPasada).toEqual({ p1: 100_000, p2: 95_000, p3: 100_000, q1: 95_000 });
  // Hallazgos como anotaciones (no fallas): muerto, fuera de orden y gasto sin animales.
  if (r.muerto.p3 > 100_000) registrar('HALLAZGO 008 D9 muertos', `un animal muerto sigue recibiendo gastos posteriores: P3 = ${r.muerto.p3}, P1 = ${r.muerto.p1}`);
  if (r.fueraDeOrden.m3 === 'aceptado' && r.fueraDeOrden.p2.deLote < 95_000 + 30_000) registrar('HALLAZGO 008 fuera de orden', `P2 está hoy en P pero no recibe el gasto de P de hoy: ${JSON.stringify(r.fueraDeOrden.p2)}`);
  if (r.sinAnimales.v1 === 0 && r.sinAnimales.resumen.gastado === 500_000) registrar('HALLAZGO 008 gasto sin animales', 'un gasto anterior al ingreso de todos los animales cuenta en el lote pero no lo carga nadie');
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('VRF 008 r2 · editar el gasto directo de un animal movido, selector de animales y validaciones nuevas', async ({ page }) => {
    test.setTimeout(150_000);
    const supabase = await clientePrueba();
    const S = await crearLote(supabase, 'S');
    const T = await crearLote(supabase, 'T');
    const s1 = await crearAnimal(supabase, 'S1', S);
    const s2 = await crearAnimal(supabase, 'S2', S);
    const s3 = await crearAnimal(supabase, 'S3', S);
    const t1 = await crearAnimal(supabase, 'T1', T);
    const { data: directo } = await supabase.from('costos').insert(gasto(S, 50_000, haceDias(10), { animal_id: s1.id, categoria: 'medicamentos', descripcion: `${P} directo S1` })).select('id').single();
    const { data: directo2 } = await supabase.from('costos').insert(gasto(S, 10_000, haceDias(9), { animal_id: s1.id, descripcion: `${P} otro directo S1` })).select('id').single();
    await supabase.rpc('mover_animales', { ids: [s1.id], fecha: hoyBogota(), motivo: `${P} mover S1`, lote_destino: T });
    await supabase.from('animales').update({ estado: 'muerto', fecha_baja: hoyBogota() }) /* Sprint 05: la baja lleva fecha */.eq('id', s2.id);
    const errores = [];
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    page.on('response', (x) => x.status() >= 400 && !x.url().includes('/auth/v1/') && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
    const r = { bd: {}, ui: {} };

    // BD: el trigger ya no bloquea editar un gasto de un animal que cambió de lote; sí reasignarlo mal.
    const e1 = await supabase.from('costos').update({ descripcion: `${P} directo S1 corregido` }).eq('id', directo.id).select('id');
    r.bd.editarDescripcion = e1.error ? `${e1.error.code} ${e1.error.message}` : 'ok';
    const e2 = await supabase.from('costos').update({ animal_id: t1.id }).eq('id', directo.id).select('id');
    r.bd.reasignarAAnimalDeOtroLote = e2.error ? e2.error.message.slice(0, 40) : 'ACEPTADO';
    // Con el otro directo de S1: pasarlo al lote actual del animal (T) es válido; devolverlo a S ya no.
    const e3 = await supabase.from('costos').update({ lote_id: T }).eq('id', directo2.id).select('id');
    r.bd.pasarAlLoteActualDelAnimal = e3.error ? e3.error.message.slice(0, 40) : 'ok';
    const e3b = await supabase.from('costos').update({ lote_id: S }).eq('id', directo2.id).select('id');
    r.bd.devolverAlLoteViejo = e3b.error ? e3b.error.message.slice(0, 40) : 'ok';
    await supabase.from('costos').delete().eq('id', directo2.id);
    const e4 = await supabase.from('costos').update({ fecha: '2099-01-01' }).eq('id', directo.id).select('id');
    r.bd.editarAFechaFutura = e4.error?.code ?? 'ACEPTADO';

    await iniciarSesion(page);
    await page.goto(`/#/costos?lote=${S}`);
    await expect(page.getByRole('button', { name: `Editar gasto ${P} directo S1 corregido` })).toBeVisible();
    r.ui.controles = await page.evaluate(medirControles);
    r.ui.desborde = (await page.evaluate(medirDesborde)).scrollWidth;
    await page.screenshot({ path: `${DIR}/04-costos-celular.png`, fullPage: true });
    await page.getByRole('button', { name: `Editar gasto ${P} directo S1 corregido` }).tap();
    let hoja = page.getByRole('dialog', { name: 'Editar gasto' });
    r.ui.paraQuien = await hoja.getByLabel('¿Para quién?').evaluate((s) => s.options[s.selectedIndex]?.text);
    await hoja.getByLabel('Monto').fill('60.000');
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    await expect(hoja).toHaveCount(0, { timeout: 5000 }).catch(() => {});
    r.ui.editarDirecto = (await hoja.count()) ? await hoja.getByRole('alert').innerText().catch(() => 'sin alerta') : 'guardado';
    r.ui.trasEditar = (await supabase.from('costos').select('monto_cop, animal_id, lote_id').eq('id', directo.id).single()).data;
    r.ui.trasEditar = { monto: r.ui.trasEditar.monto_cop, sigueDeS1: r.ui.trasEditar.animal_id === s1.id, loteS: r.ui.trasEditar.lote_id === S };
    r.ui.fichaS1 = await costoEnFicha(page, s1.id);

    // Selector "¿Para quién?" de un gasto nuevo en S: solo activos del lote (S3), no el muerto (S2) ni el movido (S1).
    await page.goto(`/#/costos?lote=${S}`);
    await page.getByRole('button', { name: 'Anotar gasto' }).first().tap();
    hoja = page.getByRole('dialog', { name: 'Anotar gasto' });
    r.ui.opciones = await hoja.getByLabel('¿Para quién?').evaluate((s) => [...s.options].map((o) => o.text));
    const alerta = async () => ((await hoja.getByRole('alert').count()) ? (await hoja.getByRole('alert').innerText()).trim() : 'SIN MENSAJE');
    await hoja.getByLabel('Descripción').fill(`${P} validación`);
    for (const monto of ['12.5', '12,50', '1.000,50', '100000000000', '99999999999999999999', '5000000001', '1e6', '0x10']) {
      await hoja.getByLabel('Monto').fill(monto);
      r.ui[`aviso ${monto}`] = await hoja.getByText(/Solo pesos enteros/).count(); // Sprint 05 r2 (M1)
      await hoja.getByRole('button', { name: 'Guardar' }).tap();
      await page.waitForTimeout(700);
      if (!(await hoja.count())) {
        r.ui[`monto ${monto}`] = 'GUARDADO';
        await page.getByRole('button', { name: 'Anotar gasto' }).first().tap();
        await hoja.getByLabel('Descripción').fill(`${P} validación`);
      } else r.ui[`monto ${monto}`] = await alerta();
    }
    r.ui.guardadosRaros = (await supabase.from('costos').select('monto_cop').eq('descripcion', `${P} validación`)).data.map((x) => x.monto_cop);
    await hoja.getByLabel('Monto').fill('1000');
    await hoja.getByLabel('Fecha').fill('1999-12-31');
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    await page.waitForTimeout(1500);
    r.ui.fecha1999 = (await hoja.count()) ? await alerta() : 'GUARDADO';
    r.ui.fechaMin = await hoja.getByLabel('Fecha').getAttribute('min');
    await page.screenshot({ path: `${DIR}/05-validaciones.png` });

    registrar('edición y validaciones', r);
    registrar('consola y red', errores);
    expect(r.bd.editarDescripcion).toBe('ok');
    expect(r.bd.reasignarAAnimalDeOtroLote).toMatch(/animal_de_otro_lote/);
    expect(r.bd.editarAFechaFutura).toBe('23514');
    expect(r.ui.paraQuien).toBe(`Solo el animal ${s1.numero}`);
    expect(r.ui.editarDirecto).toBe('guardado');
    expect(r.ui.trasEditar).toEqual({ monto: 60_000, sigueDeS1: true, loteS: true });
    expect(r.ui.fichaS1.directos).toBe(60_000);
    expect(r.ui.opciones).toEqual(['Todo el lote', `Solo el animal ${s3.numero}`]);
    // Premisa del Sprint 05 r2 (M1): se rechazan al escribirlos, con aviso, y no se guardan.
    for (const m of ['12.5', '12,50', '1.000,50']) expect(r.ui[`aviso ${m}`]).toBe(1);
    for (const m of ['12.5', '12,50', '1.000,50', '1e6', '0x10']) expect(r.ui[`monto ${m}`]).not.toBe('GUARDADO');
    for (const m of ['100000000000', '99999999999999999999', '5000000001']) expect(r.ui[`monto ${m}`]).toMatch(/5\.000 millones/);
    expect(r.ui.fecha1999).toMatch(/revisa el año/);
    expect(r.ui.controles.filter((c) => /gasto/.test(c.texto))).toEqual([]);
    expect(r.ui.desborde).toBe(375);
  });
});
