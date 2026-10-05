import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR, Sprint 05 ronda 2 (commit 09cfe4d): A1, A2, M1–M4, M6 y los bajos.
// Prefijo VRF5R; todo se borra al final. Corre contra producción con E2E_PERMITIR_PRODUCCION=si
// (decisión del equipo para este sprint).

const DIR = 'test-results/vrf-s05-r2';
mkdirSync(DIR, { recursive: true });
const P = 'VRF5R';
const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}
const resumen = (r) => (r.error ? `${r.error.code} ${String(r.error.message).slice(0, 90)}` : 'ACEPTADO');

async function limpiar() {
  const supabase = await clientePrueba();
  const { data: ventas } = await supabase.from('ventas').select('id').like('comprador', `${P}%`);
  for (const v of ventas ?? []) await supabase.from('ventas').delete().eq('id', v.id);
  const { data: animales } = await supabase.from('animales').select('id').like('numero_interno', `${P}%`);
  for (const a of animales ?? []) {
    const { data: objs } = await supabase.storage.from('fotos-animales').list(a.id);
    if (objs?.length) await supabase.storage.from('fotos-animales').remove(objs.map((o) => `${a.id}/${o.name}`));
    await supabase.from('venta_animales').delete().eq('animal_id', a.id);
    await supabase.from('animales').delete().eq('id', a.id);
  }
  await supabase.from('costos').delete().like('descripcion', `${P}%`);
  const { data: lotes } = await supabase.from('lotes').select('id').like('codigo', `${P}%`);
  for (const l of lotes ?? []) {
    await supabase.from('costos').delete().eq('lote_id', l.id);
    await supabase.from('lotes').delete().eq('id', l.id);
  }
  const { data: fincas } = await supabase.from('fincas').select('id').like('nombre', `${P}%`);
  const idsF = (fincas ?? []).map((f) => f.id);
  await supabase.from('tenedores').delete().like('nombre', `${P}%`);
  if (idsF.length) {
    await supabase.from('costos').delete().in('finca_id', idsF);
    await supabase.from('potreros').delete().in('finca_id', idsF);
    await supabase.from('fincas').delete().in('id', idsF);
  }
}

let LOTE;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  await limpiar();
  const supabase = await clientePrueba();
  const { data, error } = await supabase.from('lotes').insert({ codigo: `${P}-L`, nombre: `${P} Lote`, tipo: 'ceba', fecha_inicio: '2026-08-01' }).select('id').single();
  if (error) throw error;
  LOTE = data.id;
});
test.afterAll(async () => {
  test.setTimeout(180_000);
  await limpiar();
});

async function bovino(supabase, numero, extra = {}) {
  const { data, error } = await supabase.rpc('registrar_animal', {
    datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: '2026-09-01', peso_ingreso_kg: 400, lote_id: LOTE, costo_compra_cop: 1_000_000, ...extra },
  });
  if (error) throw error;
  return data;
}

function vigilar(page) {
  const consola = [];
  const red = [];
  page.on('console', (m) => m.type() === 'error' && consola.push(m.text().slice(0, 160)));
  page.on('pageerror', (e) => consola.push(`pageerror ${e.message.slice(0, 160)}`));
  page.on('response', (res) => res.status() >= 400 && red.push(`${res.status()} ${res.request().method()} ${res.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 100)}`));
  return { consola, red };
}

// ───────────────────────────── BD: guardar_finca (M2, M3) y caballos (M6) ─────────────────────────────
test('VRF5R BD: guardar_finca atómica y sin robar tenedores; caballos sin pesaje', async () => {
  const supabase = await clientePrueba();
  const r = {};
  const gf = (extra) => supabase.rpc('guardar_finca', { finca: null, nombre: `${P} F`, tipo: 'tenedor', municipio: null, propietario: null, tenedor: null, tenedor_nuevo: null, ...extra });
  const nFincas = async (nombre) => (await supabase.from('fincas').select('id').eq('nombre', nombre)).data.length;

  // M3: el tenedor nuevo no es válido → no queda la finca a medias.
  r.tenedorNuevoRaro = resumen(await gf({ nombre: `${P} F atomica`, tenedor_nuevo: `${P} <x>` }));
  r.fincaAMedias = await nFincas(`${P} F atomica`);
  r.sinTenedor = resumen(await gf({ nombre: `${P} F sin tenedor` }));
  r.fincaSinTenedorQueda = await nFincas(`${P} F sin tenedor`);
  // M2: un tenedor con otra finca se rechaza.
  const a = await gf({ nombre: `${P} F A`, tenedor_nuevo: `${P} Pedro` });
  r.fincaA = resumen(a);
  const { data: pedro } = await supabase.from('tenedores').select('id, finca_id').eq('nombre', `${P} Pedro`).single();
  r.pedroEnA = pedro.finca_id === a.data;
  r.robarPedro = resumen(await gf({ nombre: `${P} F B`, tenedor: pedro.id }));
  r.fincaBQueda = await nFincas(`${P} F B`);
  r.pedroSigueEnA = (await supabase.from('tenedores').select('finca_id').eq('id', pedro.id).single()).data.finca_id === a.data;
  // Editar la finca A con su mismo tenedor sí se puede.
  r.editarAConPedro = resumen(await gf({ finca: a.data, nombre: `${P} F A editada`, tenedor: pedro.id }));
  // Pasar la finca A a propia: ¿qué pasa con Pedro?
  r.tipoTenedorFinca = resumen(await gf({ nombre: `${P} F nombre raro <`, tenedor_nuevo: `${P} Ok` }));
  r.fincaRaraQueda = await nFincas(`${P} F nombre raro <`);
  r.tenedorOkHuerfano = (await supabase.from('tenedores').select('id').eq('nombre', `${P} Ok`)).data.length;

  // M6: un caballo no tiene lote, pesajes ni gastos directos; un bovino sí se sigue pesando.
  const { data: cab, error } = await supabase.rpc('registrar_animal', { datos: { especie: 'equino', numero_interno: `${P}-CAB`, sexo: 'Macho', categoria: 'caballo', origen: 'compra', fecha_ingreso: haceDias(5) } });
  if (error) throw error;
  r.caballoLote = resumen(await supabase.from('animales').update({ lote_id: LOTE }).eq('id', cab));
  r.caballoPesaje = resumen(await supabase.from('pesajes').insert({ animal_id: cab, fecha: haceDias(0), peso_kg: 400 }));
  r.caballoGasto = resumen(await supabase.from('costos').insert({ lote_id: LOTE, animal_id: cab, categoria: 'otros', descripcion: `${P} gasto caballo`, monto_cop: 1000, fecha: haceDias(0) }));
  const bov = await bovino(supabase, `${P}-BOV`);
  const pb = await supabase.from('pesajes').insert({ animal_id: bov, fecha: haceDias(0), peso_kg: 410 }).select('id').single();
  r.bovinoPesaje = resumen(pb);
  if (pb.data) await supabase.from('pesajes').delete().eq('id', pb.data.id);
  // Mover el pesaje de un bovino a un caballo (update of animal_id).
  const { data: pIng } = await supabase.from('pesajes').select('id').eq('animal_id', bov).limit(1).single();
  r.moverPesajeACaballo = resumen(await supabase.from('pesajes').update({ animal_id: cab }).eq('id', pIng.id));
  // Convertir un bovino en lote a equino.
  r.bovinoAEquino = resumen(await supabase.from('animales').update({ especie: 'equino', categoria: 'caballo', chapeta_ica: null }).eq('id', bov));
  registrar('BD r2', r);

  expect.soft(r.tenedorNuevoRaro).toMatch(/^23514/);
  expect.soft(r.fincaAMedias, 'M3: atómica').toBe(0);
  expect.soft(r.sinTenedor).toMatch(/sin_tenedor/);
  expect.soft(r.fincaSinTenedorQueda).toBe(0);
  expect.soft(r.fincaA).toBe('ACEPTADO');
  expect.soft(r.pedroEnA).toBe(true);
  expect.soft(r.robarPedro).toMatch(/tenedor_con_otra_finca/);
  expect.soft(r.fincaBQueda).toBe(0);
  expect.soft(r.pedroSigueEnA).toBe(true);
  expect.soft(r.editarAConPedro).toBe('ACEPTADO');
  expect.soft(r.fincaRaraQueda).toBe(0);
  expect.soft(r.tenedorOkHuerfano).toBe(0);
  expect.soft(r.caballoLote).toMatch(/^23514/);
  expect.soft(r.caballoPesaje).toMatch(/^23514/);
  expect.soft(r.caballoGasto).toMatch(/^23514/);
  expect.soft(r.bovinoPesaje).toBe('ACEPTADO');
  expect.soft(r.moverPesajeACaballo).toMatch(/^23514/);
});

// ───────────────────────────── Celular 375 ─────────────────────────────
test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('VRF5R A1 (019 R2): doble y triple toque, toques reales, Enter en el paso 2 y doble clic en Guardar', async ({ page }) => {
    test.setTimeout(150_000);
    const supabase = await clientePrueba();
    const v = vigilar(page);
    const r = {};
    const id = await bovino(supabase, `${P}-VT1`);
    const comprador = `${P} Comprador A1`;
    const ventas = async () => (await supabase.from('ventas').select('id').eq('comprador', comprador)).data.length;
    const pasoActual = async () => (await page.getByRole('heading', { name: 'Resultado de esta venta' }).count()) ? 3 : (await page.getByLabel('Comprador').count()) ? 2 : 1;
    const guardar = page.getByRole('button', { name: /Guardar venta|Guardando/ });
    await iniciarSesion(page);
    await page.goto(`/#/animales/${id}`);
    await page.getByRole('link', { name: 'Vender este animal' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByLabel('Comprador').fill(comprador);

    // Enter en el paso 2 (en Comprador y en Precio): ¿avanza, guarda o no hace nada?
    await page.getByLabel('Comprador').press('Enter');
    await page.waitForTimeout(300);
    r.enterComprador = { paso: await pasoActual(), ventas: await ventas() };
    if (r.enterComprador.paso === 3) await page.getByRole('button', { name: 'Atrás' }).click();
    await page.getByLabel('Precio por kilo').press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    r.enterPrecioTres = { paso: await pasoActual(), ventas: await ventas() };
    if (r.enterPrecioTres.paso === 3) await page.getByRole('button', { name: 'Atrás' }).click();

    // Doble toque (dblclick) en Siguiente.
    await page.getByRole('button', { name: 'Siguiente' }).dblclick();
    r.dobleClic = { paso: await pasoActual(), guardarDeshabilitado: await guardar.isDisabled() };
    await page.waitForTimeout(400);
    r.dobleClic.deshabilitado400ms = await guardar.isDisabled();
    await page.waitForTimeout(1200);
    r.dobleClic.habilitado1600ms = await guardar.isEnabled();
    r.dobleClic.ventas = await ventas();
    r.dobleClic.resumenVisible = await page.getByRole('heading', { name: 'Resultado de esta venta' }).isVisible();
    await page.screenshot({ path: `${DIR}/a1-paso3-375.png`, fullPage: true });

    // Triple clic.
    await page.getByRole('button', { name: 'Atrás' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click({ clickCount: 3 });
    await page.waitForTimeout(2000);
    r.tripleClic = { paso: await pasoActual(), ventas: await ventas() };

    // Toques reales en la pantalla táctil, en el mismo punto: 2 y 3 toques a 120 ms.
    for (const n of [2, 3]) {
      await page.getByRole('button', { name: 'Atrás' }).click();
      const caja = await page.getByRole('button', { name: 'Siguiente' }).boundingBox();
      for (let i = 0; i < n; i++) {
        await page.touchscreen.tap(caja.x + caja.width / 2, caja.y + caja.height / 2);
        await page.waitForTimeout(120);
      }
      await page.waitForTimeout(1500);
      r[`toques${n}`] = { paso: await pasoActual(), ventas: await ventas() };
    }
    // Atrás y Siguiente: Guardar vuelve a esperar.
    await page.getByRole('button', { name: 'Atrás' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    r.trasVolver = { guardarDeshabilitado: await guardar.isDisabled() };
    await expect(guardar).toBeEnabled({ timeout: 3000 });
    // Doble clic en Guardar venta (ya habilitado): una sola venta.
    await guardar.dblclick();
    await expect(page.getByRole('heading', { name: /^Venta de / })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    r.ventasTrasDobleGuardar = await ventas();
    r.estadoAnimal = (await supabase.from('animales').select('estado').eq('id', id).single()).data.estado;
    r.desborde = (await page.evaluate(medirDesborde)).scrollWidth;
    r.consola = v.consola;
    r.red = v.red;
    registrar('A1', r);

    expect.soft(r.enterComprador.ventas).toBe(0);
    expect.soft(r.enterPrecioTres.ventas).toBe(0);
    expect.soft(r.dobleClic.paso).toBe(3);
    expect.soft(r.dobleClic.guardarDeshabilitado).toBe(true);
    expect.soft(r.dobleClic.ventas).toBe(0);
    expect.soft(r.dobleClic.habilitado1600ms).toBe(true);
    expect.soft(r.tripleClic.ventas).toBe(0);
    expect.soft(r.toques2.ventas).toBe(0);
    expect.soft(r.toques3.ventas).toBe(0);
    expect.soft(r.trasVolver.guardarDeshabilitado).toBe(true);
    expect.soft(r.ventasTrasDobleGuardar).toBe(1);
    expect.soft(r.estadoAnimal).toBe('vendido');
    expect.soft(r.consola).toEqual([]);
    expect.soft(r.red).toEqual([]);
  });

  test('VRF5R A2 (016 R1): color del ganado al registrar y al editar; B8 reactivar un perdido', async ({ page }) => {
    test.setTimeout(120_000);
    const supabase = await clientePrueba();
    const v = vigilar(page);
    const r = {};
    await iniciarSesion(page);
    await page.goto('/#/animales?nuevo=1');
    let hoja = page.getByRole('dialog', { name: 'Registrar animal' });
    await hoja.getByLabel('Número interno').fill(`${P}-COL`);
    await hoja.getByLabel('Chapeta ICA').fill(`${P}-COL-CH`);
    await hoja.getByRole('combobox', { name: /^Lote/ }).selectOption({ value: LOTE });
    await hoja.getByLabel('Peso de ingreso').fill('250');
    r.colorAlRegistrar = await hoja.getByLabel('Color').count();
    await hoja.getByLabel('Color').fill('Pardo');
    await page.screenshot({ path: `${DIR}/a2-registrar-375.png`, fullPage: true });
    r.desbordeForm = (await page.evaluate(medirDesborde)).scrollWidth;
    await hoja.getByRole('button', { name: 'Guardar' }).dblclick();
    await expect(hoja).toHaveCount(0);
    await page.waitForTimeout(1000);
    const { data: creados } = await supabase.from('animales').select('id, color').eq('numero_interno', `${P}-COL`);
    r.creados = creados;
    const id = creados[0].id;
    await page.goto(`/#/animales/${id}`);
    r.colorEnFicha = await page.getByText('Pardo').count();
    await page.getByRole('button', { name: 'Editar' }).click();
    hoja = page.getByRole('dialog', { name: `Editar ${P}-COL` });
    r.colorPrecargado = await hoja.getByLabel('Color').inputValue();
    await hoja.getByLabel('Color').fill('Cebú blanco');
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    await expect(hoja).toHaveCount(0);
    await page.reload();
    await page.getByRole('button', { name: 'Editar' }).click();
    r.colorTrasRecargar = await page.getByRole('dialog', { name: `Editar ${P}-COL` }).getByLabel('Color').inputValue();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    r.colorBD = (await supabase.from('animales').select('color').eq('id', id).single()).data.color;

    // B8: perdido → "Apareció: reactivar". Un muerto no se reactiva.
    r.marcarPerdido = resumen(await supabase.from('animales').update({ estado: 'perdido', fecha_baja: hoyBogota(), motivo_baja: 'Se salió' }).eq('id', id));
    await page.reload();
    const reactivar = page.getByRole('button', { name: 'Apareció: reactivar' });
    await expect(page.getByRole('button', { name: 'Eliminar' })).toBeVisible();
    r.botonReactivar = await reactivar.count();
    await page.screenshot({ path: `${DIR}/b8-perdido-375.png`, fullPage: true });
    await reactivar.click();
    await expect(page.getByRole('button', { name: 'Dar de baja' })).toBeVisible();
    r.trasReactivar = (await supabase.from('animales').select('estado, fecha_baja, motivo_baja, lote_id').eq('id', id).single()).data;
    await supabase.from('animales').update({ estado: 'muerto', fecha_baja: hoyBogota() }).eq('id', id);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Eliminar' })).toBeVisible();
    r.botonReactivarMuerto = await reactivar.count();
    r.consola = v.consola;
    r.red = v.red;
    registrar('A2 y B8', r);

    expect.soft(r.colorAlRegistrar).toBe(1);
    expect.soft(r.creados).toHaveLength(1);
    expect.soft(r.creados[0].color).toBe('Pardo');
    expect.soft(r.colorPrecargado).toBe('Pardo');
    expect.soft(r.colorTrasRecargar).toBe('Cebú blanco');
    expect.soft(r.colorBD).toBe('Cebú blanco');
    expect.soft(r.botonReactivar).toBe(1);
    expect.soft(r.trasReactivar).toMatchObject({ estado: 'activo', fecha_baja: null, motivo_baja: null, lote_id: LOTE });
    expect.soft(r.botonReactivarMuerto).toBe(0);
    expect.soft(r.desbordeForm).toBeLessThanOrEqual(375);
    expect.soft(r.consola).toEqual([]);
  });

  test('VRF5R M1 (018 R1): CampoPesos al escribir, al pegar y al borrar en medio', async ({ page }) => {
    test.setTimeout(90_000);
    const supabase = await clientePrueba();
    const r = {};
    await iniciarSesion(page);
    await page.goto('/#/costos?ver=finca');
    await page.getByRole('button', { name: 'Anotar gasto' }).first().click();
    const hoja = page.getByRole('dialog', { name: 'Anotar gasto' });
    const monto = hoja.getByLabel('Monto');
    const aviso = hoja.getByText(/Solo pesos enteros/);
    const estado = async () => ({ valor: await monto.inputValue(), aviso: await aviso.count() });
    const escribir = async (txt, desde = '') => {
      await monto.fill(desde);
      await monto.pressSequentially(txt);
      return estado();
    };
    const pegar = async (txt, desde = '') => {
      await monto.fill(desde);
      await monto.fill(txt); // un solo evento de entrada con todo el texto, como al pegar
      return estado();
    };
    // Pegar.
    for (const t of ['1.000,50', '12,50', '1500000.5', '12.5', '-5', '1e6', '$ 1.250.000', '1.000.000', '1.000']) r[`pegar "${t}"`] = await pegar(t);
    // Pegar un decimal sobre un monto más largo (editar un monto ya escrito).
    r['pegar "1500.5" sobre 1.000.000'] = await pegar('1500.5', '1000000');
    r['pegar "35000.5" sobre 2.500.000'] = await pegar('35000.5', '2500000');
    r['pegar "12,5" sobre 1.000'] = await pegar('12,5', '1000');
    // Escribir tecla por tecla.
    for (const t of ['1.000,50', '12,50', '8500,5', '-5', '1500000.5', '12.5']) r[`escribir "${t}"`] = await escribir(t);
    // Insertar como pegado en medio del texto (insertText en el cursor).
    await monto.fill('1000');
    await monto.evaluate((el) => el.setSelectionRange(el.value.length, el.value.length));
    await page.keyboard.insertText(',50');
    r['insertar ",50" al final de 1.000'] = await estado();
    // Borrar en medio: 1.250.000, retroceso después del 2 → 150.000; retroceso después de un punto.
    await monto.fill('1250000');
    await monto.evaluate((el) => el.setSelectionRange(3, 3));
    await monto.press('Backspace');
    r['borrar el 2 de 1.250.000'] = { ...(await estado()), cursor: await monto.evaluate((el) => el.selectionStart) };
    await monto.fill('1250000');
    await monto.evaluate((el) => el.setSelectionRange(2, 2));
    await monto.press('Backspace');
    r['borrar el primer punto de 1.250.000'] = { ...(await estado()), cursor: await monto.evaluate((el) => el.selectionStart) };
    await monto.fill('1250000');
    await monto.evaluate((el) => el.setSelectionRange(7, 9));
    await monto.press('5');
    r['reemplazar los dos últimos 0 de 1.250.000 por 5'] = await estado();
    await monto.fill('1250000');
    await monto.evaluate((el) => el.setSelectionRange(0, el.value.length));
    await monto.press('Delete');
    r['borrar todo'] = await estado();
    // Guardar lo que quedó al escribir "1.000,50" tecla por tecla.
    await escribir('1.000,50');
    await hoja.getByLabel('Descripción').fill(`${P} m1 escrito`);
    await page.screenshot({ path: `${DIR}/m1-escrito-375.png` });
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    await expect(hoja).toHaveCount(0);
    r.guardadoTrasEscribir = (await supabase.from('costos').select('monto_cop').eq('descripcion', `${P} m1 escrito`)).data.map((x) => x.monto_cop);
    registrar('M1', r);

    for (const t of ['1.000,50', '12,50', '1500000.5', '12.5', '-5', '1e6']) expect.soft(r[`pegar "${t}"`], `pegar ${t}`).toEqual({ valor: '', aviso: 1 });
    expect.soft(r['pegar "$ 1.250.000"'].valor).toBe('1.250.000');
    expect.soft(r['pegar "1.000.000"']).toEqual({ valor: '1.000.000', aviso: 0 });
    expect.soft(r['pegar "1500.5" sobre 1.000.000'], 'pegar un decimal sobre un monto más largo').toEqual({ valor: '1.000.000', aviso: 1 });
    expect.soft(r['pegar "35000.5" sobre 2.500.000']).toEqual({ valor: '2.500.000', aviso: 1 });
    expect.soft(r['escribir "1.000,50"'].valor, 'escribir 1.000,50 no termina en 100.050').not.toBe('100.050');
    expect.soft(r['escribir "12,50"'].valor).not.toBe('1.250');
    expect.soft(r['borrar el 2 de 1.250.000']).toMatchObject({ valor: '150.000', aviso: 0 });
    expect.soft(r['borrar el primer punto de 1.250.000'].valor).toBe('1.250.000');
    expect.soft(r['borrar todo']).toEqual({ valor: '', aviso: 0 });
  });

  test('VRF5R M2/M3 (020 R1): tenedores ofrecidos, tenedor tomado mientras se llena el formulario, editar y doble toque ×3', async ({ page }) => {
    test.setTimeout(150_000);
    const supabase = await clientePrueba();
    const v = vigilar(page);
    const r = {};
    const { data: fa } = await supabase.rpc('guardar_finca', { finca: null, nombre: `${P} Finca A`, tipo: 'tenedor', municipio: null, propietario: null, tenedor: null, tenedor_nuevo: `${P} Pedro` });
    const { data: libre } = await supabase.from('tenedores').insert({ nombre: `${P} Libre` }).select('id').single();
    await iniciarSesion(page);
    await page.goto('/#/fincas');
    await page.getByRole('button', { name: 'Nueva finca' }).click();
    let hoja = page.getByRole('dialog', { name: 'Nueva finca' });
    await hoja.getByLabel('Nombre de la finca').fill(`${P} Finca B`);
    await hoja.getByLabel('Tipo').selectOption('tenedor');
    const tenedor = hoja.getByLabel(/^Tenedor/);
    await expect(tenedor.locator('option', { hasText: 'Cargando tenedores' })).toHaveCount(0);
    r.opciones = await tenedor.evaluate((s) => [...s.options].map((o) => o.text).filter((t) => t.startsWith('VRF5R') || t.startsWith('+')));
    r.ayuda = await hoja.getByText('Aparecen los tenedores sin finca').count();
    await tenedor.selectOption({ label: `${P} Libre` });
    // Mientras tanto, desde otro celular, a "Libre" le dan otra finca.
    const { data: fz } = await supabase.rpc('guardar_finca', { finca: null, nombre: `${P} Finca Z`, tipo: 'tenedor', municipio: null, propietario: null, tenedor: libre.id, tenedor_nuevo: null });
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    await expect(hoja.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    r.alertaTomado = await hoja.getByRole('alert').innerText();
    await page.screenshot({ path: `${DIR}/m2-tenedor-tomado-375.png`, fullPage: true });
    r.fincaBCreada = (await supabase.from('fincas').select('id').eq('nombre', `${P} Finca B`)).data.length;
    r.libreSigueEnZ = (await supabase.from('tenedores').select('finca_id').eq('id', libre.id).single()).data.finca_id === fz;
    await hoja.getByRole('button', { name: 'Cancelar' }).click();

    // Editar la finca A: su propio tenedor sí aparece y queda elegido.
    await page.reload();
    const tarjetaA = page.locator('article').filter({ hasText: `${P} Finca A` });
    await tarjetaA.getByRole('button', { name: 'Editar finca' }).click();
    hoja = page.getByRole('dialog').filter({ has: page.getByLabel('Nombre de la finca') });
    await expect(hoja.getByLabel(/^Tenedor/).locator('option', { hasText: 'Cargando tenedores' })).toHaveCount(0);
    r.editarA = { elegido: await hoja.getByLabel(/^Tenedor/).evaluate((s) => s.options[s.selectedIndex]?.text) };
    await hoja.getByLabel('Municipio').fill('Badillo').catch(() => {});
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    await expect(hoja).toHaveCount(0);
    r.editarA.pedroSigueEnA = (await supabase.from('tenedores').select('finca_id').eq('nombre', `${P} Pedro`).single()).data.finca_id === fa;

    // Doble toque en Guardar con tenedor nuevo, 3 veces.
    r.dobles = [];
    for (const n of [1, 2, 3]) {
      await page.getByRole('button', { name: 'Nueva finca' }).click();
      hoja = page.getByRole('dialog', { name: 'Nueva finca' });
      await hoja.getByLabel('Nombre de la finca').fill(`${P} Finca C${n}`);
      await hoja.getByLabel('Tipo').selectOption('tenedor');
      await hoja.getByLabel(/^Tenedor/).selectOption('nuevo');
      await hoja.getByLabel('Nombre del tenedor nuevo').fill(`${P} Rosa${n}`);
      await hoja.getByRole('button', { name: 'Guardar' }).dblclick();
      await page.waitForTimeout(2500);
      const abierta = await hoja.count();
      const alerta = abierta ? await hoja.getByRole('alert').innerText().catch(() => 'abierta sin alerta') : 'cerrada';
      if (abierta) await hoja.getByRole('button', { name: 'Cancelar' }).click();
      const fincas = (await supabase.from('fincas').select('id, tenedores ( nombre )').eq('nombre', `${P} Finca C${n}`)).data;
      r.dobles.push({ alerta, fincas: fincas.length, tenedores: fincas.flatMap((f) => f.tenedores).length });
    }
    r.desborde = (await page.evaluate(medirDesborde)).scrollWidth;
    r.consola = v.consola;
    r.red = v.red;
    registrar('M2 y M3', r);

    expect.soft(r.opciones).not.toContain(`${P} Pedro`);
    expect.soft(r.opciones).toContain(`${P} Libre`);
    expect.soft(r.alertaTomado).toMatch(/ya tiene la finca/);
    expect.soft(r.fincaBCreada, 'M3: rechazo atómico').toBe(0);
    expect.soft(r.libreSigueEnZ).toBe(true);
    expect.soft(r.editarA).toEqual({ elegido: `${P} Pedro`, pedroSigueEnA: true });
    for (const d of r.dobles) expect.soft(d).toEqual({ alerta: 'cerrada', fincas: 1, tenedores: 1 });
    expect.soft(r.desborde).toBeLessThanOrEqual(375);
  });

  test('VRF5R B4 (017): si falla guardar la ruta, la foto subida se borra y se avisa', async ({ page }) => {
    test.setTimeout(120_000);
    const supabase = await clientePrueba();
    const r = {};
    const id = await bovino(supabase, `${P}-FOTO`);
    await iniciarSesion(page);
    await page.goto(`/#/animales/${id}`);
    await page.route(/\/rest\/v1\/animales/, (route) =>
      route.request().method() === 'PATCH' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'XX000', message: 'falla simulada', details: null, hint: null }) }) : route.fallback(),
    );
    // JPEG mínimo válido de 1×1 generado en el navegador.
    const jpeg = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 48;
      c.getContext('2d').fillRect(0, 0, 64, 48);
      const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.8));
      return [...new Uint8Array(await b.arrayBuffer())];
    });
    await page.getByLabel('Foto del animal').setInputFiles({ name: 'v.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg) });
    await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 30_000 });
    r.alerta = await page.getByRole('alert').first().innerText();
    await page.waitForTimeout(2000);
    r.objetos = ((await supabase.storage.from('fotos-animales').list(id)).data ?? []).map((o) => o.name);
    r.fotoPath = (await supabase.from('animales').select('foto_path').eq('id', id).single()).data.foto_path;
    await page.screenshot({ path: `${DIR}/b4-foto-falla-375.png` });
    registrar('B4', r);
    expect.soft(r.objetos).toEqual([]);
    expect.soft(r.fotoPath).toBeNull();
  });

  test('VRF5R M4/B2/B3: base vacía simulada (Pesaje, ¿Vendo?, Reporte, Lotes) y pestañas de 56 px', async ({ page }) => {
    test.setTimeout(150_000);
    const r = {};
    await iniciarSesion(page);
    await page.goto('/#/animales');
    await expect(page.getByRole('tab').first()).toBeVisible();
    r.pestanas = await page.getByRole('tab').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height * 10) / 10));
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message.slice(0, 160)));
    page.on('console', (m) => m.type() === 'error' && !/406|PGRST116/.test(m.text()) && errores.push(m.text().slice(0, 160)));
    const vacias = ['animales', 'lotes', 'fincas', 'potreros', 'costos', 'ventas', 'ventas_equinos', 'venta_animales', 'pesajes', 'jornadas_pesaje', 'movimientos', 'tenedores', 'contratos_al_partir', 'visitas_verificacion', 'visita_animales', 'condicion_pasto', 'precios_mercado', 'eventos_sanitarios'];
    await page.route(/\/rest\/v1\/([a-z_]+)/, async (route) => {
      const tabla = route.request().url().match(/\/rest\/v1\/([a-z_]+)/)[1];
      if (route.request().method() !== 'GET' || !vacias.includes(tabla)) return route.fallback();
      if ((route.request().headers().accept ?? '').includes('vnd.pgrst.object')) {
        return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows', hint: null }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' });
    });
    r.vacia = {};
    for (const ruta of ['/pesaje', '/recomendacion', '/reporte', '/lotes', '/', '/animales', '/costos', '/ventas', '/ventas/nueva', '/fincas', '/al-partir']) {
      await page.goto(`/#${ruta}`);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);
      const texto = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
      r.vacia[ruta] = { texto: texto.slice(0, 200), cargando: /Cargando/.test(texto), raro: /undefined|NaN|Error/.test(texto) };
      await page.screenshot({ path: `${DIR}/vacia${ruta.replace(/[/?=]/g, '_')}.png`, fullPage: true });
    }
    // Desde Pesaje vacío, el enlace lleva a registrar.
    await page.goto('/#/pesaje');
    await page.reload();
    await page.getByRole('link', { name: 'Registrar animal' }).last().click();
    r.enlacePesaje = page.url().replace(/^.*#/, '#');
    r.errores = errores;
    registrar('base vacía', r);

    for (const h of r.pestanas) expect.soft(h).toBeGreaterThanOrEqual(56);
    for (const [ruta, x] of Object.entries(r.vacia)) {
      expect.soft(x.cargando, `${ruta} no se queda cargando`).toBe(false);
      expect.soft(x.raro, `${ruta} sin textos raros`).toBe(false);
    }
    expect.soft(r.vacia['/pesaje'].texto).toMatch(/Todavía no hay animales para pesar/);
    expect.soft(r.vacia['/recomendacion'].texto).toMatch(/Todavía no hay lotes/);
    expect.soft(r.vacia['/reporte'].texto).toMatch(/Todavía no hay lotes/);
    expect.soft(r.vacia['/lotes'].texto).toMatch(/Todavía no hay lotes/);
    expect.soft(r.enlacePesaje).toMatch(/#\/animales\?nuevo=1/);
    expect.soft(r.errores).toEqual([]);
  });
});

// ───────────────────────────── Escritorio ─────────────────────────────
test('VRF5R B7: tabla del hato a 1280 y 1440 px sin scroll horizontal', async ({ page }) => {
  const r = {};
  await iniciarSesion(page);
  for (const ancho of [1280, 1279, 1440, 1024]) {
    await page.setViewportSize({ width: ancho, height: 800 });
    await page.goto('/#/animales');
    await expect(page.locator('table')).toBeVisible();
    r[ancho] = await page.locator('table').evaluate((t) => {
      const caja = t.parentElement;
      return { scroll: caja.scrollWidth, visible: caja.clientWidth, columnas: [...t.querySelectorAll('thead th')].filter((th) => th.checkVisibility()).map((th) => th.innerText.trim()) };
    });
    r[ancho].pagina = (await page.evaluate(medirDesborde)).scrollWidth;
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: `${DIR}/b7-hato-1280.png` });
  registrar('B7', r);
  for (const ancho of [1280, 1279, 1440, 1024]) expect.soft(r[ancho].scroll, `tabla a ${ancho}`).toBeLessThanOrEqual(r[ancho].visible + 1);
});
