import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirControles, medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para la spec 007 ("Al partir"), RONDA 2.
// Confirma o refuta cada hallazgo de la ronda 1: editar tenedor (Alto), confirmación > 15 %,
// regla R6 (sin peso ni marca = no encontrado), porcentaje obligatorio, precios enteros, fecha de
// inicio, y los triggers de la migración 1400 (contrato que se suelta al salir de la finca,
// asignación estricta, visitas en escrituras directas). Prefijo VRF-A2; todo se borra al final.

const DIR = 'test-results/vrf-007-r2';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-A2';

const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

async function limpiar() {
  const supabase = await clientePrueba();
  const { data: tenedores } = await supabase.from('tenedores').select('id').like('nombre', `${P}%`);
  const idsTen = (tenedores ?? []).map((t) => t.id);
  const { data: contratos } = idsTen.length ? await supabase.from('contratos_al_partir').select('id').in('tenedor_id', idsTen) : { data: [] };
  const idsCon = (contratos ?? []).map((c) => c.id);
  if (idsCon.length) await supabase.from('visitas_verificacion').delete().in('contrato_id', idsCon);
  const { data: animales } = await supabase.from('animales').select('id').like('numero_interno', `${P}%`);
  for (const a of animales ?? []) await supabase.from('animales').delete().eq('id', a.id);
  if (idsCon.length) await supabase.from('contratos_al_partir').delete().in('id', idsCon);
  if (idsTen.length) await supabase.from('tenedores').delete().in('id', idsTen);
  await supabase.from('potreros').delete().like('nombre', `${P}%`);
  await supabase.from('fincas').delete().like('nombre', `${P}%`);
  await supabase.from('lotes').delete().like('codigo', `${P}%`);
}
test.beforeAll(limpiar);
test.afterAll(limpiar);

async function base(supabase, s) {
  const { data: propia } = await supabase.from('fincas').select('id').eq('tipo', 'propia').single();
  const { data: lote } = await supabase.from('lotes').insert({ codigo: `${P}-LOTE-${s}`, nombre: `${P} lote ${s}`, tipo: 'ceba', peso_meta_kg: 400 }).select('id').single();
  const tenedor = async (sufijo) => {
    const fincaId = (await supabase.from('fincas').insert({ nombre: `${P} finca ${sufijo}`, tipo: 'tenedor' }).select('id').single()).data.id;
    const t = (await supabase.from('tenedores').insert({ nombre: `${P} ${sufijo}`, finca_id: fincaId, telefono: '3001112233' }).select('id').single()).data;
    return { id: t.id, fincaId };
  };
  const contrato = async (tenedorId, extra = {}) =>
    (await supabase.from('contratos_al_partir').insert({ tenedor_id: tenedorId, porcentaje_ganancia: 50, fecha_inicio: haceDias(20), ...extra }).select('id').single()).data.id;
  const animal = async (sufijo, { ingreso = haceDias(60), peso = 250 } = {}) => {
    const numero = `${P}-${sufijo}`;
    const { data: id, error } = await supabase.rpc('registrar_animal', {
      datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: ingreso, peso_ingreso_kg: peso, peso_objetivo_kg: 400, lote_id: lote.id, finca_id: propia.id },
    });
    if (error) throw error;
    return { id, numero };
  };
  return { propia, lote, tenedor, contrato, animal };
}

test('VRF 007 r2 BD: triggers de la migración 1400, asignación estricta y lo que sigue abierto', async () => {
  test.setTimeout(120_000);
  const supabase = await clientePrueba();
  const b = await base(supabase, 'BD');
  const t1 = await b.tenedor('T1');
  const t2 = await b.tenedor('T2');
  const c1 = await b.contrato(t1.id);
  const c2 = await b.contrato(t2.id);
  const [a1, a2, a3, a4, a5] = [await b.animal('1'), await b.animal('2'), await b.animal('3'), await b.animal('4'), await b.animal('5', { ingreso: haceDias(5) })];
  const estado = async (id) => (await supabase.from('animales').select('finca_id, potrero_id, lote_id, contrato_id').eq('id', id).single()).data;
  const err = (res) => (res.error ? `${res.error.code} ${res.error.message.slice(0, 70)}` : 'ACEPTADO');
  const r = { asignar: {}, soltar: {}, visitas: {}, abiertos: {} };

  r.asignar.valido = err(await supabase.rpc('asignar_a_contrato', { ids: [a1.id, a2.id, a3.id], contrato: c1, fecha: hoyBogota(), motivo: `${P} entrega` }));
  r.asignar.otroContrato = err(await supabase.rpc('asignar_a_contrato', { ids: [a1.id], contrato: c2, fecha: hoyBogota(), motivo: `${P} x` }));
  r.asignar.antesDelIngreso = err(await supabase.rpc('asignar_a_contrato', { ids: [a5.id], contrato: c2, fecha: haceDias(10), motivo: `${P} x` }));
  // Antes del inicio del contrato (hace 20 días) pero después del ingreso (hace 60).
  r.asignar.antesDelInicioDelContrato = err(await supabase.rpc('asignar_a_contrato', { ids: [a4.id], contrato: c2, fecha: haceDias(40), motivo: `${P} antes del inicio` }));
  await supabase.from('animales').update({ contrato_id: null, finca_id: b.propia.id }).eq('id', a4.id);

  // Mover dentro de la finca del tenedor (potrero) o solo de lote: el contrato se mantiene.
  const { data: pot } = await supabase.from('potreros').insert({ finca_id: t1.fincaId, nombre: `${P} potrero T1` }).select('id').single();
  r.soltar.moverAPotreroDelTenedor = err(await supabase.rpc('mover_animales', { ids: [a1.id], fecha: hoyBogota(), motivo: `${P} potrero`, potrero_destino: pot.id }));
  r.soltar.a1SigueEnC1 = (await estado(a1.id)).contrato_id === c1;
  const { data: otroLote } = await supabase.from('lotes').insert({ codigo: `${P}-LOTE-OTRO`, nombre: `${P} lote otro`, tipo: 'ceba', peso_meta_kg: 400 }).select('id').single();
  await supabase.rpc('mover_animales', { ids: [a1.id], fecha: hoyBogota(), motivo: `${P} lote`, lote_destino: otroLote.id });
  r.soltar.a1SigueEnC1TrasCambiarLote = (await estado(a1.id)).contrato_id === c1;
  // Salir de la finca del tenedor: a Santa Rita y a la finca de otro tenedor.
  await supabase.rpc('mover_animales', { ids: [a2.id], fecha: hoyBogota(), motivo: `${P} vuelve`, finca_destino: b.propia.id });
  r.soltar.a2TrasVolverASantaRita = (await estado(a2.id)).contrato_id;
  await supabase.rpc('mover_animales', { ids: [a3.id], fecha: hoyBogota(), motivo: `${P} a T2`, finca_destino: t2.fincaId });
  r.soltar.a3TrasIrALaFincaDeT2 = (await estado(a3.id)).contrato_id;

  // Visitas: fecha futura y animal fuera del contrato en escrituras directas; animal soltado.
  const vf = await supabase.from('visitas_verificacion').insert({ contrato_id: c1, fecha: '2099-01-01' }).select('id').single();
  r.visitas.directaFechaFutura = vf.error?.message.slice(0, 40) ?? 'ACEPTADO';
  const vd = await supabase.from('visitas_verificacion').insert({ contrato_id: c1, fecha: hoyBogota(), notas: `${P} directa` }).select('id').single();
  r.visitas.animalFueraDirecto = err(await supabase.from('visita_animales').insert({ visita_id: vd.data.id, animal_id: a4.id, encontrado: true }).select('id'));
  r.visitas.animalSoltadoPorRpc = err(await supabase.rpc('registrar_visita', { contrato: c1, fecha: hoyBogota(), notas: null, revisiones: [{ animal_id: a2.id, peso_kg: 260 }] }));
  const vOk = await supabase.from('visita_animales').insert({ visita_id: vd.data.id, animal_id: a1.id, encontrado: false }).select('id').single();
  r.visitas.animalDelContratoDirecto = vOk.error ? err(vOk) : 'ACEPTADO';
  // Visita anterior a la asignación (hoy) y al inicio del contrato (hace 20 días).
  r.abiertos.visitaAntesDeLaAsignacion = err(await supabase.rpc('registrar_visita', { contrato: c1, fecha: haceDias(40), notas: `${P} antigua`, revisiones: [{ animal_id: a1.id, peso_kg: 255 }] }));
  // UPDATE directo del contrato de un animal que sigue en Santa Rita (sin movimiento ni finca).
  const up = await supabase.from('animales').update({ contrato_id: c1 }).eq('id', a4.id).select('finca_id, contrato_id').single();
  r.abiertos.updateDirectoContrato = up.error ? err(up) : { aceptado: true, fincaSigueEnSantaRita: up.data.finca_id === b.propia.id };
  await supabase.from('animales').update({ contrato_id: null }).eq('id', a4.id);
  r.abiertos.contratoInicio2099 = err(await supabase.from('contratos_al_partir').insert({ tenedor_id: t2.id, porcentaje_ganancia: 50, fecha_inicio: '2099-01-01' }).select('id'));
  // Corregir una visita antigua de un animal que ya salió del contrato (a2): ¿el trigger lo impide?
  const { data: vieja } = await supabase.rpc('registrar_visita', { contrato: c1, fecha: hoyBogota(), notas: `${P} con a1`, revisiones: [{ animal_id: a1.id, peso_kg: 256 }] });
  await supabase.rpc('mover_animales', { ids: [a1.id], fecha: hoyBogota(), motivo: `${P} a1 vuelve`, finca_destino: b.propia.id });
  r.abiertos.corregirVisitaDeAnimalQueSalio = err(await supabase.from('visita_animales').update({ encontrado: true }).eq('visita_id', vieja).eq('animal_id', a1.id).select('id'));
  // Editar la finca del tenedor con animales adentro: ¿qué pasa con ellos?
  const [a6] = [await b.animal('6')];
  await supabase.rpc('asignar_a_contrato', { ids: [a6.id], contrato: c1, fecha: hoyBogota(), motivo: `${P} entrega 6` });
  const nuevaFinca = (await supabase.from('fincas').insert({ nombre: `${P} finca T1 nueva`, tipo: 'tenedor' }).select('id').single()).data.id;
  await supabase.from('tenedores').update({ finca_id: nuevaFinca }).eq('id', t1.id);
  const e6 = await estado(a6.id);
  r.abiertos.cambiarFincaDelTenedor = { a6SigueEnC1: e6.contrato_id === c1, a6EnFincaVieja: e6.finca_id === t1.fincaId };

  registrar('BD 1400', r);
  expect(r.asignar.valido).toBe('ACEPTADO');
  expect(r.asignar.otroContrato).toMatch(/animal_en_otro_contrato/);
  expect(r.asignar.antesDelIngreso).toMatch(/fecha_antes_del_ingreso/);
  expect(r.soltar.a1SigueEnC1).toBe(true);
  expect(r.soltar.a1SigueEnC1TrasCambiarLote).toBe(true);
  expect(r.soltar.a2TrasVolverASantaRita).toBeNull();
  expect(r.soltar.a3TrasIrALaFincaDeT2).toBeNull();
  expect(r.visitas.directaFechaFutura).toMatch(/fecha_futura/);
  expect(r.visitas.animalFueraDirecto).toMatch(/animal_fuera_del_contrato/);
  expect(r.visitas.animalSoltadoPorRpc).toMatch(/animal_fuera_del_contrato/);
  expect(r.visitas.animalDelContratoDirecto).toBe('ACEPTADO');
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('VRF 007 r2 UI: editar tenedor, contrato, visita con confirmación > 15 % y R6, ficha y devolver a Santa Rita', async ({ page, browser }) => {
    test.setTimeout(200_000);
    const supabase = await clientePrueba();
    const b = await base(supabase, 'UI');
    const t = await b.tenedor('Tenedor UI');
    const c = await b.contrato(t.id);
    const U = [await b.animal('U1'), await b.animal('U2'), await b.animal('U3', { peso: 250.5 })];
    await supabase.rpc('asignar_a_contrato', { ids: U.map((a) => a.id), contrato: c, fecha: hoyBogota(), motivo: `${P} entrega` });
    const errores = [];
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    page.on('response', (x) => x.status() >= 400 && !x.url().includes('/auth/v1/') && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
    const r = {};
    const alertaDe = async (hoja) => ((await hoja.getByRole('alert').count()) ? (await hoja.getByRole('alert').first().innerText()).trim() : 'SIN MENSAJE');

    await iniciarSesion(page);
    await page.goto(`/#/al-partir/${c}`);
    await expect(page.getByRole('heading', { name: `${P} Tenedor UI` })).toBeVisible();

    // R1 (Alto de la ronda 1): editar el tenedor.
    await page.getByRole('button', { name: 'Editar tenedor' }).tap();
    let hoja = page.getByRole('dialog', { name: 'Editar tenedor' });
    await page.waitForTimeout(1500); // que carguen las fincas del selector
    r.tenedorForm = { nombre: await hoja.getByRole('textbox', { name: 'Nombre *' }).inputValue(), telefono: await hoja.getByLabel('Teléfono').inputValue(), finca: await hoja.getByLabel('Finca').evaluate((s) => s.options[s.selectedIndex]?.text) };
    await hoja.getByRole('textbox', { name: 'Nombre *' }).fill('  ');
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    r.tenedorNombreVacio = await alertaDe(hoja);
    await hoja.getByRole('textbox', { name: 'Nombre *' }).fill(`${P} Tenedor Editado`);
    await hoja.getByLabel('Teléfono').fill('310 999 8877');
    await hoja.getByRole('button', { name: 'Guardar' }).dblclick();
    await expect(hoja).toHaveCount(0);
    await expect(page.getByRole('heading', { name: `${P} Tenedor Editado` })).toBeVisible();
    r.tenedorEnPantalla = (await page.getByText(/tel\. 310 999 8877/).count()) > 0;
    r.tenedorBD = (await supabase.from('tenedores').select('nombre, telefono, finca_id').eq('id', t.id).single()).data;
    r.tenedorBD.mismaFinca = r.tenedorBD.finca_id === t.fincaId;
    delete r.tenedorBD.finca_id;
    r.tenedoresConEseNombre = (await supabase.from('tenedores').select('id').like('nombre', `${P} Tenedor%`)).data.length;
    const otra = await browser.newContext();
    const p2 = await otra.newPage();
    await iniciarSesion(p2);
    await p2.goto('/#/al-partir');
    r.otraSesion = await expect(p2.getByRole('heading', { name: `${P} Tenedor Editado` })).toBeVisible().then(() => true, () => false);
    await otra.close();

    // R2: porcentaje obligatorio, precios enteros, inicio no futuro.
    await page.getByRole('button', { name: 'Editar contrato' }).tap();
    hoja = page.getByRole('dialog', { name: 'Editar contrato' });
    const pct = hoja.getByLabel('Porcentaje de la ganancia neta (%)');
    r.contrato = {};
    await pct.fill('');
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    r.contrato.pctVacio = await alertaDe(hoja);
    await pct.fill('45');
    // Sprint 05 r2 (M1, premisa nueva): el campo rechaza el decimal con aviso; no se toca Guardar.
    await hoja.getByLabel('Precio del animal (COP)').fill('1500000.5');
    r.contrato.precioDecimal = ((await hoja.getByText(/Solo pesos enteros/).count()) ? 'AVISO Solo pesos enteros' : `SIN AVISO, valor ${await hoja.getByLabel('Precio del animal (COP)').inputValue()}`);
    await hoja.getByLabel('Precio del animal (COP)').fill('1500000');
    await hoja.getByLabel('Fecha de inicio').fill('2099-01-01');
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    r.contrato.inicioFuturo = await alertaDe(hoja);
    await hoja.getByLabel('Fecha de inicio').fill(haceDias(20));
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    await expect(hoja).toHaveCount(0);
    r.contrato.guardado = (await supabase.from('contratos_al_partir').select('porcentaje_ganancia, precio_animal_cop').eq('id', c).single()).data;

    // R5/R6: visita. U1 200 kg (−20 % frente a 250) pide confirmación; U2 "No encontrado"; U3 en blanco.
    await page.getByRole('button', { name: 'Registrar visita' }).tap();
    hoja = page.getByRole('dialog', { name: 'Registrar visita de verificación' });
    r.visita = { avisoInicial: (await hoja.getByText(/sin peso quedar/).innerText().catch(() => 'SIN AVISO')).trim() };
    r.visita.placeholders = await hoja.getByRole('textbox', { name: /^Peso de/ }).evaluateAll((els) => els.map((e) => ({ ph: e.placeholder, ancho: e.clientWidth })));
    await hoja.getByLabel(`Peso de ${U[0].numero} (kg)`).fill('abc');
    await hoja.getByRole('button', { name: 'Guardar visita' }).tap();
    r.visita.pesoTexto = await alertaDe(hoja);
    await hoja.getByLabel(`Peso de ${U[0].numero} (kg)`).fill('200');
    r.visita.errorSeBorraAlCorregir = (await alertaDe(hoja)) === 'SIN MENSAJE';
    await hoja.getByRole('checkbox', { name: `No encontrado ${U[1].numero}` }).check();
    r.visita.avisoConU3EnBlanco = (await hoja.getByText(/sin peso quedar/).innerText().catch(() => 'SIN AVISO')).trim();
    r.visita.controlesChicos = await page.evaluate(medirControles);
    r.visita.desborde = (await page.evaluate(medirDesborde)).scrollWidth;
    await page.screenshot({ path: `${DIR}/01-visita.png` });
    await hoja.getByRole('button', { name: 'Guardar visita' }).tap();
    await page.waitForTimeout(800);
    r.visita.primerToque = (await hoja.count()) ? await alertaDe(hoja) : 'GUARDADA SIN CONFIRMAR';
    await page.screenshot({ path: `${DIR}/02-visita-confirmacion.png` });
    if (await hoja.count()) {
      await hoja.getByRole('button', { name: 'Guardar visita' }).tap();
      await expect(hoja).toHaveCount(0);
    }
    const visitas = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Visitas de verificación' }) });
    await expect(visitas).toContainText('pesados', { timeout: 10_000 }).catch(() => {});
    r.visita.enContrato = (await visitas.innerText()).replace(/\s+/g, ' ');
    const { data: vs } = await supabase.from('visitas_verificacion').select('id, revisiones:visita_animales ( animal_id, encontrado, pesaje:pesajes ( peso_kg ) )').eq('contrato_id', c);
    r.visita.bd = vs.map((v) => v.revisiones.map((x) => `${U.find((a) => a.id === x.animal_id)?.numero}:${x.encontrado}:${x.pesaje?.peso_kg ?? '-'}`).sort());

    // Una visita con la hoja vacía (un toque accidental en Guardar): ¿qué queda?
    await page.getByRole('button', { name: 'Registrar visita' }).tap();
    hoja = page.getByRole('dialog', { name: 'Registrar visita de verificación' });
    r.visitaVacia = { aviso: (await hoja.getByText(/sin peso quedar/).innerText().catch(() => 'SIN AVISO')).trim() };
    await hoja.getByRole('button', { name: 'Guardar visita' }).tap();
    await page.waitForTimeout(1200);
    r.visitaVacia.resultado = (await hoja.count()) ? await alertaDe(hoja) : 'GUARDADA';
    if (await hoja.count()) await hoja.getByRole('button', { name: 'Cancelar' }).tap();
    r.visitaVacia.visitasEnBD = (await supabase.from('visitas_verificacion').select('id').eq('contrato_id', c)).data.length;

    // Ficha: U2 y U3 muestran "No encontrado"; U1 dos visitas el mismo día (¿llaves repetidas?).
    const erroresAntesFicha = errores.length;
    await page.goto(`/#/animales/${U[1].id}`);
    await expect(page.getByRole('heading', { name: `Animal ${U[1].numero}` })).toBeVisible();
    await expect(page.getByText('No encontrado', { exact: true }).first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
    r.fichaU2 = await page.getByText('No encontrado', { exact: true }).count();
    await page.screenshot({ path: `${DIR}/03-ficha-no-encontrado.png`, fullPage: true });
    await page.goto(`/#/animales/${U[2].id}`);
    await expect(page.getByRole('heading', { name: `Animal ${U[2].numero}` })).toBeVisible();
    await expect(page.getByText('No encontrado', { exact: true }).first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
    r.fichaU3 = await page.getByText('No encontrado', { exact: true }).count();
    await page.waitForTimeout(500);
    r.erroresConsolaFicha = errores.slice(erroresAntesFicha).map((e) => e.slice(0, 120));

    // Devolver U1 a Santa Rita desde la ficha: deja de estar "Al partir".
    await page.goto(`/#/animales/${U[0].id}`);
    await expect(page.getByRole('heading', { name: `Animal ${U[0].numero}` })).toBeVisible();
    await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ubicación' }) }).getByRole('button', { name: 'Mover' }).tap();
    hoja = page.getByRole('dialog', { name: `Mover ${U[0].numero}` });
    await hoja.getByLabel('Finca de destino').selectOption({ label: 'Finca Santa Rita' });
    await hoja.getByLabel('Motivo').fill(`${P} vuelve a Santa Rita`);
    await hoja.getByRole('button', { name: 'Mover' }).tap();
    await expect(hoja).toHaveCount(0);
    await expect(page.locator('dl').filter({ hasText: 'Esquema' })).toContainText('Propio', { timeout: 10_000 }).catch(() => {});
    r.devolver = { esquema: (await page.locator('dl').filter({ hasText: 'Esquema' }).innerText()).replace(/\s+/g, ' ').match(/Esquema (.+)$/)?.[1] };
    r.devolver.bd = (await supabase.from('animales').select('contrato_id').eq('id', U[0].id).single()).data.contrato_id;
    await page.goto(`/#/al-partir/${c}`);
    await expect(page.getByRole('heading', { name: /^Animales \(/ })).toHaveText('Animales (2)', { timeout: 10_000 }).catch(() => {});
    r.devolver.reses = await page.getByRole('heading', { name: /^Animales \(/ }).innerText();

    registrar('UI Al partir r2', r);
    registrar('consola y red', errores);
    expect(r.tenedorForm.nombre).toBe(`${P} Tenedor UI`);
    expect(r.tenedorNombreVacio).toMatch(/nombre/);
    expect(r.tenedorEnPantalla).toBe(true);
    expect(r.tenedorBD).toEqual({ nombre: `${P} Tenedor Editado`, telefono: '310 999 8877', mismaFinca: true });
    expect(r.tenedoresConEseNombre).toBe(1);
    expect(r.otraSesion).toBe(true);
    expect(r.contrato.pctVacio).toMatch(/porcentaje/);
    expect(r.contrato.precioDecimal).toMatch(/enteros/);
    expect(r.contrato.inicioFuturo).toMatch(/futura/);
    expect(r.visita.pesoTexto).toMatch(new RegExp(U[0].numero));
    expect(r.visita.primerToque).toMatch(/15 %/);
    expect(r.visita.bd).toContainEqual([`${U[0].numero}:true:200`, `${U[1].numero}:false:-`, `${U[2].numero}:false:-`]);
    expect(r.visita.enContrato).toMatch(/1 pesados, 2 no encontrados/);
    expect(r.fichaU2).toBeGreaterThan(0);
    expect(r.fichaU3).toBeGreaterThan(0);
    expect(r.devolver.esquema).toBe('Propio');
    expect(r.devolver.bd).toBeNull();
    expect(r.devolver.reses).toBe('Animales (2)');
  });
});
