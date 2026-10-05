import { mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para la spec 006 (lotes, proyección, fincas, potreros y movimientos), ronda 1,
// actualizadas en la verificación 004 ronda 2 (regresión de los Medios corregidos de la 006): la proyección
// se cuenta desde el último pesaje, la fecha de inicio futura se rechaza y el potrero es una hoja inferior.
// - Proyección del 2026-A contra un cálculo manual independiente (± 1 día) y su sesgo por la fecha del pesaje.
// - mover_animales: atomicidad, reglas de destino, RLS/anon, casos no cubiertos (vientres, lotes cerrados).
// - R8/D2 en la interfaz y cómo se puede esquivar; R3/R4; formularios (vacíos, cero, duplicados, doble clic).
// Todo lo creado lleva el prefijo VRF-LOT; los animales de la semilla movidos se devuelven a su origen.

const DIR = 'test-results/vrf-006';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-LOT';

const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const MESES = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sept: 8, sep: 8, oct: 9, nov: 10, dic: 11 };

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

async function lotePorCodigo(supabase, codigo) {
  const { data } = await supabase.from('lotes').select('id, estado, tipo').eq('codigo', codigo).single();
  return data;
}

let estadoOriginal2025B;

async function limpiar() {
  const supabase = await clientePrueba();
  // Devolver a su origen los animales de la semilla que se movieron (del más nuevo al más viejo).
  const { data: movs } = await supabase
    .from('movimientos')
    .select('id, animal_id, desde_finca_id, desde_potrero_id, desde_lote_id, created_at')
    .like('motivo', `${P}%`)
    .order('created_at', { ascending: false });
  for (const m of movs ?? []) {
    await supabase.from('animales').update({ finca_id: m.desde_finca_id, potrero_id: m.desde_potrero_id, lote_id: m.desde_lote_id }).eq('id', m.animal_id);
    await supabase.from('movimientos').delete().eq('id', m.id);
  }
  const { data: animales } = await supabase.from('animales').select('id').like('numero_interno', `${P}%`);
  for (const a of animales ?? []) await supabase.from('animales').delete().eq('id', a.id);
  await supabase.from('potreros').delete().ilike('nombre', `${P}%`);
  await supabase.from('lotes').delete().ilike('codigo', `${P}%`);
  if (estadoOriginal2025B) await supabase.from('lotes').update({ estado: estadoOriginal2025B }).eq('codigo', 'LOTE-2025-B');
}

test.beforeAll(async () => {
  await limpiar();
  const supabase = await clientePrueba();
  estadoOriginal2025B = (await lotePorCodigo(supabase, 'LOTE-2025-B')).estado;
});
test.afterAll(limpiar);

async function crearAnimal(supabase, sufijo, { lote_id, sexo = 'Macho', categoria = 'novillo', pesos }) {
  const numero = `${P}-${sufijo}`;
  const [primero, ...resto] = pesos;
  const { data: id, error } = await supabase.rpc('registrar_animal', {
    datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo, categoria, origen: 'compra', fecha_ingreso: primero[0], peso_ingreso_kg: primero[1], peso_objetivo_kg: 400, lote_id },
  });
  if (error) throw error;
  for (const [fecha, peso_kg] of resto) await supabase.from('pesajes').insert({ animal_id: id, fecha, peso_kg });
  return { id, numero };
}

test('VRF 006 R2 criterio: la proyección del 2026-A coincide (± 1 día) con el cálculo manual', async ({ page }) => {
  const supabase = await clientePrueba();
  const lote = await lotePorCodigo(supabase, 'LOTE-2026-A');
  const { data: l } = await supabase.from('lotes').select('peso_meta_kg').eq('id', lote.id).single();
  const { data: animales } = await supabase.from('animales').select('estado, peso_ingreso_kg, pesajes(fecha, peso_kg, created_at)').eq('lote_id', lote.id);
  // Cálculo manual independiente (no usa src/domain): promedio del último peso y promedio de la GDP (primer → último día).
  const activos = animales.filter((a) => a.estado === 'activo');
  const series = activos.map((a) => {
    const porDia = new Map();
    for (const p of [...a.pesajes].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.created_at.localeCompare(y.created_at))) porDia.set(p.fecha, Number(p.peso_kg));
    return [...porDia.entries()];
  });
  const promedio = series.reduce((s, x) => s + x.at(-1)[1], 0) / series.length;
  const gdps = series.filter((x) => x.length >= 2).map((x) => (x.at(-1)[1] - x[0][1]) / diasEntre(x[0][0], x.at(-1)[0]));
  const gdp = gdps.reduce((s, g) => s + g, 0) / gdps.length;
  const meta = Number(l.peso_meta_kg);
  const diasManual = (meta - promedio) / gdp;
  const ultimoPesaje = series.map((x) => x.at(-1)[0]).sort().at(-1);
  const desdeUltimoPesaje = diasManual - diasEntre(ultimoPesaje, hoyBogota());

  await iniciarSesion(page);
  await page.goto('/#/lotes');
  const tarjeta = page.getByRole('link', { name: /Lote 2026-A/ });
  const texto = await tarjeta.innerText();
  const m = texto.match(/Llega a la meta: (\d{1,2}) de ([a-z]+)\.? de (\d{4}) \(en (\d+) días\)/);
  const fechaUI = new Date(Date.UTC(Number(m[3]), MESES[m[2]], Number(m[1]))).toISOString().slice(0, 10);
  const diasUI = Number(m[4]);
  const fechaEsperada = new Date(Date.parse(`${ultimoPesaje}T00:00:00Z`) + diasManual * 86_400_000).toISOString().slice(0, 10);
  const r = {
    meta, promedio: Math.round(promedio * 10) / 10, gdp: Math.round(gdp * 1000) / 1000, diasManual: Math.round(diasManual * 100) / 100,
    diasUI, fechaUI, coherente: diasEntre(hoyBogota(), fechaUI) === diasUI, fechaEsperada, desfaseDias: diasEntre(fechaEsperada, fechaUI),
    ultimoPesaje, diasDesdeUltimoPesaje: diasEntre(ultimoPesaje, hoyBogota()),
    fechaSiSeCuentaDesdeElPesaje: new Date(Date.parse(`${ultimoPesaje}T00:00:00Z`) + Math.ceil(diasManual) * 86_400_000).toISOString().slice(0, 10),
    diasRealesDesdeHoy: Math.round(desdeUltimoPesaje * 10) / 10,
    textoTarjeta: texto.replace(/\s+/g, ' '),
  };
  registrar('proyección 2026-A', r);
  // Premisa corregida (006, Medio 1): la fecha = último pesaje + (meta − promedio) / GDP, ± 1 día.
  expect(Math.abs(r.desfaseDias)).toBeLessThanOrEqual(1);
  expect(r.coherente).toBe(true);
});

test('VRF 006 R2 (regresión): un solo pesaje reciente en el lote no debe correr la proyección', async ({ page }) => {
  const supabase = await clientePrueba();
  const { data: l } = await supabase.from('lotes').insert({ codigo: `${P}-PROY`, nombre: `${P} proyección`, tipo: 'ceba', peso_meta_kg: 350 }).select('id').single();
  // 10 animales, todos 250 → 280 kg entre hace 60 y hace 30 días (GDP 1,0 kg/día). Faltan 70 kg: meta ≈ hoy + 40.
  const ids = [];
  for (let i = 0; i < 10; i++) ids.push((await crearAnimal(supabase, `PR${i}`, { lote_id: l.id, pesos: [[haceDias(60), 250], [haceDias(30), 280]] })).id);
  await iniciarSesion(page);
  const leer = async () => {
    await page.goto('/#/lotes');
    await page.reload();
    const t = (await page.getByRole('link', { name: new RegExp(`${P} proyección`) }).innerText()).replace(/\s+/g, ' ');
    return { texto: t.match(/Llega a la meta: [^)]*\)|Ya debería[^:]*|Sin datos suficientes/)?.[0], dias: Number(t.match(/\(en (\d+) días\)/)?.[1]) };
  };
  const antes = await leer();
  // Un solo animal se pesa hoy con un peso coherente con su GDP (280 + 30 × 1,0 = 310).
  await supabase.from('pesajes').insert({ animal_id: ids[0], fecha: hoyBogota(), peso_kg: 310 });
  const despues = await leer();
  const r = { antes, despues, esperadoAprox: 'en 37–40 días (el lote sigue ganando 1 kg/día)', salto: despues.dias - antes.dias };
  registrar('proyección con un pesaje reciente', r);
  expect(antes.dias).toBeGreaterThanOrEqual(39);
  expect(antes.dias).toBeLessThanOrEqual(41);
  // Hallazgo (anotación, no falla): la base de la proyección es el pesaje MÁS reciente de cualquier animal.
  if (r.salto > 5) registrar('HALLAZGO 006 R2 (regresión)', `un solo pesaje de hoy corre la proyección ${r.salto} días más tarde`);
});

test('VRF 006 mover_animales: atomicidad, reglas de destino, anon y lo que no valida', async () => {
  const supabase = await clientePrueba();
  const loteA = await lotePorCodigo(supabase, 'LOTE-2026-A');
  const loteCria = await lotePorCodigo(supabase, 'CRIA-2025-2026');
  const { data: fincas } = await supabase.from('fincas').select('id, nombre, tipo');
  const propia = fincas.find((f) => f.tipo === 'propia');
  const tenedor = fincas.find((f) => f.tipo === 'tenedor');
  const { data: pot } = await supabase.from('potreros').insert({ finca_id: propia.id, nombre: `${P} potrero` }).select('id').single();
  const { data: dos } = await supabase.from('animales').select('id, finca_id, potrero_id, lote_id').eq('lote_id', loteA.id).eq('estado', 'activo').order('numero_interno').limit(2);
  const estado = async (ids) => (await supabase.from('animales').select('id, finca_id, potrero_id, lote_id').in('id', ids).order('id')).data;
  const cuenta = async (motivo) => (await supabase.from('movimientos').select('id', { count: 'exact', head: true }).eq('motivo', motivo)).count;
  const r = {};
  const antes = await estado(dos.map((a) => a.id));

  // Atomicidad: un id que no existe junto a dos válidos → nada cambia, ningún movimiento.
  const falso = '00000000-0000-4000-8000-000000000000';
  const at = await supabase.rpc('mover_animales', { ids: [dos[0].id, dos[1].id, falso], fecha: hoyBogota(), motivo: `${P} atomicidad`, potrero_destino: pot.id });
  r.atomicidad = { error: at.error?.message, movimientos: await cuenta(`${P} atomicidad`), animalesIguales: JSON.stringify(await estado(dos.map((a) => a.id))) === JSON.stringify(antes) };
  const dup = await supabase.rpc('mover_animales', { ids: [dos[0].id, dos[0].id], fecha: hoyBogota(), motivo: `${P} duplicado`, potrero_destino: pot.id });
  r.idsRepetidos = { error: dup.error?.message ?? 'ACEPTADO', movimientos: await cuenta(`${P} duplicado`) };
  const vacio = await supabase.rpc('mover_animales', { ids: [], fecha: hoyBogota(), motivo: `${P} vacío`, potrero_destino: pot.id });
  r.sinAnimales = vacio.error?.message ?? 'ACEPTADO';
  const motivoBlanco = await supabase.rpc('mover_animales', { ids: [dos[0].id], fecha: hoyBogota(), motivo: '   ', potrero_destino: pot.id });
  r.motivoEnBlanco = motivoBlanco.error?.code ?? 'ACEPTADO';
  const potInexistente = await supabase.rpc('mover_animales', { ids: [dos[0].id], fecha: hoyBogota(), motivo: `${P} x`, potrero_destino: falso });
  r.potreroInexistente = potInexistente.error?.message ?? 'ACEPTADO';
  const loteInexistente = await supabase.rpc('mover_animales', { ids: [dos[0].id], fecha: hoyBogota(), motivo: `${P} x`, lote_destino: falso });
  r.loteInexistente = loteInexistente.error?.code ?? 'ACEPTADO';

  // anon
  const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const an = await anon.rpc('mover_animales', { ids: [dos[0].id], fecha: hoyBogota(), motivo: `${P} anon`, potrero_destino: pot.id });
  const anSel = await anon.from('movimientos').select('id');
  r.anon = { rpc: an.error?.code ?? 'ACEPTADO', select: anSel.error?.code ?? `devolvió ${anSel.data?.length}` };

  // Reglas: solo potrero → la finca va implícita.
  await supabase.rpc('mover_animales', { ids: [dos[0].id], fecha: hoyBogota(), motivo: `${P} regla potrero`, potrero_destino: pot.id });
  const [s1] = await estado([dos[0].id]);
  r.soloPotrero = { finca: s1.finca_id === propia.id, potrero: s1.potrero_id === pot.id, loteIgual: s1.lote_id === dos[0].lote_id };
  // Solo otra finca → el potrero queda vacío.
  await supabase.rpc('mover_animales', { ids: [dos[0].id], fecha: hoyBogota(), motivo: `${P} regla finca`, finca_destino: tenedor.id });
  const [s2] = await estado([dos[0].id]);
  r.soloOtraFinca = { finca: s2.finca_id === tenedor.id, potreroVacio: s2.potrero_id === null };
  // Solo lote → finca y potrero no cambian.
  await supabase.rpc('mover_animales', { ids: [dos[0].id], fecha: hoyBogota(), motivo: `${P} regla lote`, lote_destino: loteCria.id });
  const [s3] = await estado([dos[0].id]);
  r.soloLote = { lote: s3.lote_id === loteCria.id, fincaIgual: s3.finca_id === tenedor.id };
  const { data: hist } = await supabase.from('movimientos').select('motivo, desde_finca_id, hacia_finca_id, desde_potrero_id, hacia_potrero_id, desde_lote_id, hacia_lote_id').eq('animal_id', dos[0].id).like('motivo', `${P} regla%`).order('created_at');
  r.historialEncadenado = hist.every((m, i) => i === 0 || (m.desde_finca_id === hist[i - 1].hacia_finca_id && m.desde_potrero_id === hist[i - 1].hacia_potrero_id && m.desde_lote_id === hist[i - 1].hacia_lote_id));

  // Lo que la función NO valida.
  const { data: loteVendido } = await supabase.from('lotes').insert({ codigo: `${P}-VENDIDO`, nombre: `${P} vendido`, tipo: 'ceba', estado: 'vendido' }).select('id').single();
  const aVendido = await supabase.rpc('mover_animales', { ids: [dos[1].id], fecha: hoyBogota(), motivo: `${P} a lote vendido`, lote_destino: loteVendido.id });
  r.haciaLoteVendido = aVendido.error?.code ?? 'ACEPTADO';
  const vientre = await crearAnimal(supabase, 'V1', { lote_id: loteCria.id, sexo: 'Hembra', categoria: 'vientre_mayor', pesos: [[haceDias(60), 380]] });
  const vientreCeba = await supabase.rpc('mover_animales', { ids: [vientre.id], fecha: hoyBogota(), motivo: `${P} vientre a ceba`, lote_destino: loteA.id });
  r.vientreACebaPorAPI = vientreCeba.error?.code ?? 'ACEPTADO';
  const muerto = await crearAnimal(supabase, 'M1', { lote_id: loteCria.id, sexo: 'Macho', categoria: 'ternero', pesos: [[haceDias(60), 150]] });
  await supabase.from('animales').update({ estado: 'muerto', fecha_baja: hoyBogota() }) /* Sprint 05: la baja lleva fecha */.eq('id', muerto.id);
  const mMuerto = await supabase.rpc('mover_animales', { ids: [muerto.id], fecha: hoyBogota(), motivo: `${P} animal muerto`, lote_destino: loteA.id });
  r.moverAnimalMuerto = mMuerto.error?.code ?? 'ACEPTADO';
  const vivo = await crearAnimal(supabase, 'I1', { lote_id: loteCria.id, sexo: 'Macho', categoria: 'ternero', pesos: [[haceDias(60), 150]] });
  const antesDeIngreso = await supabase.rpc('mover_animales', { ids: [vivo.id], fecha: haceDias(400), motivo: `${P} antes del ingreso`, lote_destino: loteCria.id });
  r.fechaAnteriorAlIngreso = antesDeIngreso.error?.code ?? 'ACEPTADO';
  // Saltarse la función: actualizar la ubicación directamente, sin movimiento.
  const directo = await supabase.from('animales').update({ potrero_id: pot.id, finca_id: tenedor.id }).eq('id', dos[1].id).select('id');
  r.updateDirectoPotreroDeOtraFinca = directo.error?.code ?? 'ACEPTADO (sin movimiento y con potrero de otra finca)';
  // Residuo: un UPDATE directo coherente (potrero de su finca) sigue sin dejar movimiento.
  const directoCoherente = await supabase.from('animales').update({ potrero_id: pot.id, finca_id: propia.id }).eq('id', dos[1].id).select('id');
  const { count: movsDirecto } = await supabase.from('movimientos').select('id', { count: 'exact', head: true }).eq('animal_id', dos[1].id);
  r.updateDirectoCoherente = { resultado: directoCoherente.error?.code ?? 'ACEPTADO', movimientosDelAnimal: movsDirecto };
  await supabase.from('animales').update({ finca_id: antes.find((a) => a.id === dos[1].id).finca_id, potrero_id: antes.find((a) => a.id === dos[1].id).potrero_id }).eq('id', dos[1].id);

  registrar('mover_animales', r);
  expect(r.atomicidad.movimientos).toBe(0);
  expect(r.atomicidad.animalesIguales).toBe(true);
  expect(r.idsRepetidos.movimientos).toBe(0);
  expect(r.anon.rpc).toBe('42501');
  expect(r.anon.select).toBe('42501');
  expect(r.soloPotrero).toEqual({ finca: true, potrero: true, loteIgual: true });
  expect(r.soloOtraFinca).toEqual({ finca: true, potreroVacio: true });
  expect(r.soloLote).toEqual({ lote: true, fincaIgual: true });
  expect(r.historialEncadenado).toBe(true);
  // Regresión de la 006 (Medio 3, migración 1100): ahora se rechazan.
  expect(r.haciaLoteVendido).toBe('23514');
  expect(r.moverAnimalMuerto).toBe('23514');
  expect(r.fechaAnteriorAlIngreso).toBe('23514');
  expect(r.updateDirectoPotreroDeOtraFinca).toBe('23514');
});

test('VRF 006 R8/D2: la interfaz advierte al pasar un vientre a ceba, y cómo se esquiva', async ({ page }) => {
  const supabase = await clientePrueba();
  const loteA = await lotePorCodigo(supabase, 'LOTE-2026-A');
  const { data: loteCriaNuevo } = await supabase.from('lotes').insert({ codigo: `${P}-CRIA`, nombre: `${P} cría`, tipo: 'cria' }).select('id').single();
  const vientre = await crearAnimal(supabase, 'V2', { lote_id: loteCriaNuevo.id, sexo: 'Hembra', categoria: 'vientre_mayor', pesos: [[haceDias(60), 380], [haceDias(20), 390]] });
  const ternera = await crearAnimal(supabase, 'T2', { lote_id: loteCriaNuevo.id, sexo: 'Hembra', categoria: 'ternera', pesos: [[haceDias(60), 150]] });
  const r = {};
  await iniciarSesion(page);

  // 1) Vientre → lote de ceba desde la ficha: advertencia y confirmación.
  await page.goto(`/#/animales/${vientre.id}`);
  await page.getByRole('button', { name: 'Mover' }).click();
  const d = page.getByRole('dialog', { name: `Mover ${vientre.numero}` });
  await d.getByLabel('Lote de destino').selectOption(loteA.id);
  await d.getByLabel('Motivo').fill(`${P} vientre UI`);
  await d.getByRole('button', { name: 'Mover' }).click();
  await expect(d.getByRole('alert').first()).toBeVisible();
  r.advertencia = await d.getByRole('alert').first().innerText();
  r.botonTrasAdvertir = await d.getByRole('button', { name: /Mover/ }).last().innerText();
  const { count: sinConfirmar } = await supabase.from('movimientos').select('id', { count: 'exact', head: true }).eq('motivo', `${P} vientre UI`);
  r.movidoSinConfirmar = sinConfirmar;
  await page.screenshot({ path: `${DIR}/r8-advertencia.png` });
  await d.getByRole('button', { name: 'Mover de todas formas' }).click();
  await expect(d).toHaveCount(0);
  const { data: tras } = await supabase.from('animales').select('lote_id').eq('id', vientre.id).single();
  r.movidoTrasConfirmar = tras.lote_id === loteA.id;

  // 2) Ternera (hembra con potencial reproductivo, D2) → ceba: ¿advierte?
  await page.goto(`/#/animales/${ternera.id}`);
  await page.getByRole('button', { name: 'Mover' }).click();
  const d2 = page.getByRole('dialog', { name: `Mover ${ternera.numero}` });
  await d2.getByLabel('Lote de destino').selectOption(loteA.id);
  await d2.getByLabel('Motivo').fill(`${P} ternera UI`);
  await d2.getByRole('button', { name: 'Mover' }).click();
  await page.waitForTimeout(1500);
  r.terneraAdvierte = (await d2.count()) > 0 && (await d2.getByText(/vientre|no se venden/).count()) > 0;
  if (r.terneraAdvierte) await d2.getByRole('button', { name: 'Cancelar' }).click();

  // 3) Esquivar R8: devolver el vientre a su lote de cría y cambiar el TIPO del lote a ceba.
  await supabase.rpc('mover_animales', { ids: [vientre.id], fecha: hoyBogota(), motivo: `${P} volver a cría`, lote_destino: loteCriaNuevo.id });
  await page.goto(`/#/lotes/${loteCriaNuevo.id}`);
  await page.getByRole('button', { name: 'Editar lote' }).click();
  const e = page.getByRole('dialog', { name: 'Editar lote' });
  await e.getByLabel('Tipo').selectOption('ceba');
  await e.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(1200);
  r.cambioDeTipo = { dialogoSigueAbierto: (await e.count()) > 0, advertencia: (await e.getByText(/vientres o terneras/).count()) > 0 };
  const { data: lc } = await supabase.from('lotes').select('tipo').eq('id', loteCriaNuevo.id).single();
  r.cambioDeTipo.tipoFinal = lc.tipo;

  // 4) Confirmar el cambio de tipo (segundo Guardar) y dejarlo como estaba.
  if (r.cambioDeTipo.dialogoSigueAbierto) {
    await e.getByRole('button', { name: 'Guardar' }).click();
    await expect(e).toHaveCount(0);
    r.cambioDeTipo.tipoTrasConfirmar = (await supabase.from('lotes').select('tipo').eq('id', loteCriaNuevo.id).single()).data.tipo;
  }

  // 5) Registrar una hembra (ternera) directamente en un lote de ceba.
  await page.goto('/#/animales');
  await page.getByRole('button', { name: 'Registrar animal' }).first().click();
  const n = page.getByRole('dialog', { name: 'Registrar animal' });
  await n.getByLabel(/^Nombre/).fill(`${P}-NH`);
  await n.getByLabel('Chapeta ICA / Sinigán').fill(`${P}-NH-CH`);
  await n.getByLabel('Sexo').selectOption('Hembra');
  await n.getByLabel('Categoría').selectOption('ternera');
  await n.getByRole('combobox', { name: /^Lote/ }).selectOption(loteA.id);
  await n.getByLabel('Peso inicial (kg)').fill('150');
  await n.getByLabel('Peso objetivo pactado (kg)').fill('300');
  await n.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(800);
  r.altaHembraEnCeba = {
    aviso: (await n.getByRole('alert').count()) ? (await n.getByRole('alert').first().innerText()).replace(/\s+/g, ' ') : null,
    creadaSinConfirmar: (await supabase.from('animales').select('id').eq('numero_interno', `${P}-NH`)).data.length,
  };

  registrar('R8/D2', r);
  expect(r.movidoSinConfirmar).toBe(0);
  expect(r.advertencia).toMatch(/hembra|vientre/);
  expect(r.movidoTrasConfirmar).toBe(true);
  // Regresión (006, Medio 2 corregido): la ternera, el cambio de tipo y el alta advierten.
  expect(r.terneraAdvierte).toBe(true);
  expect(r.cambioDeTipo.advertencia).toBe(true);
  expect(r.cambioDeTipo.tipoFinal).toBe('cria');
  expect(r.altaHembraEnCeba.creadaSinConfirmar).toBe(0);
  expect(r.altaHembraEnCeba.aviso).toMatch(/hembra/);
});

test('VRF 006 R3/R4: "sin datos suficientes" con un solo pesaje o GDP ≤ 0, y "Marcar como listo"', async ({ page }) => {
  const supabase = await clientePrueba();
  const { data: l1 } = await supabase.from('lotes').insert({ codigo: `${P}-UNO`, nombre: `${P} un pesaje`, tipo: 'ceba', peso_meta_kg: 350 }).select('id').single();
  const { data: l2 } = await supabase.from('lotes').insert({ codigo: `${P}-BAJA`, nombre: `${P} baja`, tipo: 'ceba', peso_meta_kg: 350 }).select('id').single();
  const { data: l3 } = await supabase.from('lotes').insert({ codigo: `${P}-SINMETA`, nombre: `${P} sin meta`, tipo: 'ceba' }).select('id').single();
  await crearAnimal(supabase, 'U1', { lote_id: l1.id, pesos: [[haceDias(5), 250]] });
  await crearAnimal(supabase, 'B1', { lote_id: l2.id, pesos: [[haceDias(60), 260], [haceDias(1), 250]] });
  await crearAnimal(supabase, 'S1', { lote_id: l3.id, pesos: [[haceDias(60), 260], [haceDias(1), 290]] }); // meta del animal 400
  const r = {};
  await iniciarSesion(page);
  await page.goto('/#/lotes');
  const t = async (n) => (await page.getByRole('link', { name: new RegExp(n) }).innerText()).replace(/\s+/g, ' ');
  r.unPesaje = await t(`${P} un pesaje`);
  r.gdpNegativa = await t(`${P} baja`);
  r.sinMetaDelLote = await t(`${P} sin meta`);
  r.loteVacio = null;

  // R4: 2025-B alcanzó la meta → sugerir "listo".
  const b = await lotePorCodigo(supabase, 'LOTE-2025-B');
  await page.goto(`/#/lotes/${b.id}`);
  await expect(page.getByRole('status')).toContainText('alcanzó la meta');
  // Regresión (006, Bajo 3): si falla la red, "Marcar como listo" dice algo.
  await page.route('**/rest/v1/lotes*', (route) => (route.request().method() === 'PATCH' ? route.abort('internetdisconnected') : route.continue()));
  await page.getByRole('button', { name: 'Marcar como listo' }).click();
  await expect(page.getByRole('status').getByRole('alert')).toBeVisible({ timeout: 10_000 });
  r.errorMarcarListo = await page.getByRole('status').getByRole('alert').innerText();
  await page.unroute('**/rest/v1/lotes*');
  await page.getByRole('button', { name: 'Marcar como listo' }).click();
  await expect(page.getByText(/Estado: listo para vender/)).toBeVisible();
  r.marcadoListo = (await lotePorCodigo(supabase, 'LOTE-2025-B')).estado;
  r.sugerenciaDesaparece = (await page.getByRole('button', { name: 'Marcar como listo' }).count()) === 0;
  await supabase.from('lotes').update({ estado: estadoOriginal2025B }).eq('id', b.id);

  registrar('R3/R4', r);
  expect(r.unPesaje).toContain('Sin datos suficientes');
  expect(r.gdpNegativa).toContain('Sin datos suficientes');
  expect(r.marcadoListo).toBe('listo');
  expect(r.errorMarcarListo).toMatch(/conexión/);
});

test('VRF 006 R1/R5: formularios de lote y potrero (vacíos, cero, negativos, duplicados, doble clic, persistencia)', async ({ page, browser }) => {
  const supabase = await clientePrueba();
  await iniciarSesion(page);
  const r = {};

  await page.goto('/#/lotes');
  await page.getByRole('button', { name: 'Nuevo lote' }).click();
  const d = page.getByRole('dialog', { name: 'Nuevo lote' });
  const alerta = async () => ((await d.getByRole('alert').count()) ? (await d.getByRole('alert').innerText()).trim() : 'SIN MENSAJE');
  await d.getByRole('button', { name: 'Guardar' }).click();
  r.loteVacio = await alerta();
  await d.getByLabel('Código').fill(`${P}-F1`);
  await d.getByLabel('Nombre').fill('   ');
  await d.getByRole('button', { name: 'Guardar' }).click();
  r.loteNombreEnBlanco = await alerta();
  await d.getByLabel('Nombre').fill(`${P} formulario`);
  for (const meta of ['0', '-5', '1500']) {
    await d.getByLabel('Meta de peso pactada (kg)').fill(meta);
    await d.getByRole('button', { name: 'Guardar' }).click();
    r[`meta ${meta}`] = await alerta();
  }
  await d.getByLabel('Meta de peso pactada (kg)').fill('350.5');
  await d.getByLabel('Fecha de inicio').fill('2099-01-01');
  await d.getByRole('button', { name: 'Guardar' }).click();
  r.fechaInicio2099 = await alerta();
  r.fechaInicio2099PorAPI = (await supabase.from('lotes').insert({ codigo: `${P}-F2099`, nombre: `${P} 2099`, tipo: 'ceba', fecha_inicio: '2099-01-01' }).select('id')).error?.code ?? 'ACEPTADO';
  await d.getByLabel('Fecha de inicio').fill(haceDias(3));
  await d.getByRole('button', { name: 'Guardar' }).dblclick();
  await expect(page.getByRole('heading', { name: `${P} formulario` })).toBeVisible({ timeout: 10_000 });
  const { data: creados } = await supabase.from('lotes').select('id, fecha_inicio, peso_meta_kg').eq('codigo', `${P}-F1`);
  r.dobleClicLote = creados.length;
  r.fechaInicioGuardada = creados[0]?.fecha_inicio;
  r.metaDecimal = creados[0]?.peso_meta_kg;

  // Persistencia: recargar y otra sesión.
  await page.reload();
  r.persisteTrasRecargar = await expect(page.getByRole('heading', { name: `${P} formulario` })).toBeVisible().then(() => true, () => false);
  const otro = await browser.newContext();
  const p2 = await otro.newPage();
  await iniciarSesion(p2);
  await p2.goto('/#/lotes');
  r.visibleEnOtraSesion = await expect(p2.getByRole('link', { name: new RegExp(`${P} formulario`) })).toBeVisible().then(() => true, () => false);
  await otro.close();

  // Potrero
  await page.goto('/#/fincas');
  const finca = page.getByRole('article').filter({ hasText: 'Finca Santa Rita' });
  await finca.getByRole('button', { name: 'Agregar potrero' }).click();
  // Premisa corregida (006, Medio 4): el formulario es una hoja inferior (diálogo), no un bloque en línea.
  const hojaP = page.getByRole('dialog', { name: 'Nuevo potrero en Finca Santa Rita' });
  await expect(hojaP).toBeVisible();
  const guardar = hojaP.getByRole('button', { name: 'Guardar potrero' });
  const alertaP = async () => ((await hojaP.getByRole('alert').count()) ? (await hojaP.getByRole('alert').innerText()).trim() : 'SIN MENSAJE');
  await guardar.click();
  r.potreroVacio = await alertaP();
  await hojaP.getByLabel('Nombre del potrero').fill(`${P} potrero F`);
  for (const area of ['0', '-3']) {
    await hojaP.getByLabel('Área (ha)').fill(area);
    await guardar.click();
    r[`área ${area}`] = await alertaP();
  }
  await hojaP.getByLabel('Área (ha)').fill('7.5');
  await guardar.dblclick();
  await expect(hojaP).toHaveCount(0);
  await expect(finca.getByText(new RegExp(`^${P} potrero F`))).toBeVisible();
  const { count: nPot } = await supabase.from('potreros').select('id', { count: 'exact', head: true }).eq('nombre', `${P} potrero F`);
  r.dobleClicPotrero = nPot;
  await finca.getByRole('button', { name: 'Agregar potrero' }).click();
  await hojaP.getByLabel('Nombre del potrero').fill(`${P} potrero F`);
  await hojaP.getByRole('button', { name: 'Guardar potrero' }).click();
  await expect(hojaP.getByRole('alert')).toBeVisible().catch(() => {});
  r.potreroDuplicado = await alertaP();
  await hojaP.getByLabel('Nombre del potrero').fill(`${P.toLowerCase()} potrero f `);
  await hojaP.getByRole('button', { name: 'Guardar potrero' }).click();
  await page.waitForTimeout(1500);
  r.potreroDuplicadoMayusculasMensaje = await alertaP();
  await hojaP.getByRole('button', { name: 'Cancelar' }).click();
  r.potreroDuplicadoMayusculasEspacios = (await supabase.from('potreros').select('nombre').ilike('nombre', `${P} potrero f%`)).data.map((x) => x.nombre);

  // R5: el número de animales por finca coincide con la BD.
  const { data: fincas } = await supabase.from('fincas').select('id, nombre');
  const conteos = {};
  for (const f of fincas) {
    const { count } = await supabase.from('animales').select('id', { count: 'exact', head: true }).eq('finca_id', f.id).eq('estado', 'activo');
    const ui = await page.getByRole('article').filter({ hasText: f.nombre }).getByText(/reses activas/).innerText();
    conteos[f.nombre] = { bd: count, ui: Number(ui.match(/(\d+) reses activas/)[1]) };
  }
  r.conteosFincas = conteos;

  registrar('formularios', r);
  expect(r.loteVacio).toMatch(/obligatorios|Escribe/);
  expect(r.loteNombreEnBlanco).toMatch(/obligatorios|Escribe/);
  expect(r['meta 0']).toMatch(/entre 1 y 1.499/);
  expect(r['meta -5']).toMatch(/entre 1 y 1.499/);
  expect(r['meta 1500']).toMatch(/entre 1 y 1.499/);
  expect(r.dobleClicLote).toBe(1);
  expect(r.persisteTrasRecargar && r.visibleEnOtraSesion).toBe(true);
  expect(r.potreroVacio).toMatch(/nombre/);
  expect(r.dobleClicPotrero).toBe(1);
  expect(r.potreroDuplicado).toMatch(/ya tiene un potrero/);
  // Regresión (006, Bajos 1 y 2): fecha de inicio futura rechazada en la interfaz; potreros únicos sin mayúsculas.
  expect(r.fechaInicio2099).toMatch(/no puede ser futura/);
  expect(r.potreroDuplicadoMayusculasEspacios).toHaveLength(1);
  expect(r.potreroDuplicadoMayusculasMensaje).toMatch(/ya tiene un potrero/);
  for (const c of Object.values(conteos)) expect(c.ui).toBe(c.bd);
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('VRF 006 R6/R7 criterio: mover 2 animales a un potrero nuevo desde el celular crea 2 movimientos y la ficha muestra la ubicación', async ({ page }) => {
    const supabase = await clientePrueba();
    const { data: propia } = await supabase.from('fincas').select('id').eq('tipo', 'propia').single();
    const nombrePot = `${P} potrero con un nombre bastante largo para ver cómo se acomoda`;
    await supabase.from('potreros').insert({ finca_id: propia.id, nombre: nombrePot, area_ha: 3.2 });
    const lote = await lotePorCodigo(supabase, 'LOTE-2026-B');
    await iniciarSesion(page);
    await page.goto(`/#/lotes/${lote.id}`);
    const casillas = page.getByRole('checkbox');
    const n1 = (await casillas.nth(2).getAttribute('aria-label')).replace('Seleccionar ', '');
    const n2 = (await casillas.nth(3).getAttribute('aria-label')).replace('Seleccionar ', '');
    await page.getByText(n1, { exact: true }).tap();
    await page.getByText(n2, { exact: true }).tap();
    await page.getByRole('button', { name: 'Mover seleccionados (2)' }).tap();
    const d = page.getByRole('dialog', { name: 'Mover 2 animales' });
    await d.getByLabel('Finca de destino').selectOption(propia.id);
    await d.getByLabel('Potrero').selectOption({ label: nombrePot });
    await d.getByLabel('Fecha').fill(hoyBogota());
    await d.getByLabel('Motivo').fill(`${P} rotación desde el celular con un motivo largo sinespaciosquepuedadesbordarlaficha`);
    await page.screenshot({ path: `${DIR}/movil-mover.png` });
    await d.getByRole('button', { name: 'Mover' }).tap();
    await expect(d).toHaveCount(0);
    const r = {};
    r.seleccionTrasMover = await page.getByRole('button', { name: /Mover seleccionados/ }).innerText();
    const { data: movs } = await supabase.from('movimientos').select('animal_id, hacia_potrero_id').like('motivo', `${P} rotación desde el celular%`);
    r.movimientos = movs.length;

    await page.goto('/#/animales');
    await page.getByPlaceholder(/Buscar por nombre/).fill(n1);
    await page.getByRole('link', { name: new RegExp(`^${n1}`) }).first().tap();
    const ubic = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ubicación' }) });
    await expect(ubic).toContainText(nombrePot);
    await expect(ubic).toContainText(`${P} rotación desde el celular`);
    r.ficha = (await ubic.innerText()).replace(/\s+/g, ' ');
    r.desborde = await page.evaluate(() => document.documentElement.scrollWidth);
    r.textoFuera = (await page.evaluate(medirDesborde)).textoFuera;
    await ubic.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${DIR}/movil-ficha-ubicacion.png` });
    await page.reload();
    r.persisteTrasRecargar = await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ubicación' }) }).getByText(nombrePot).first())
      .toBeVisible()
      .then(() => true, () => false);

    await page.goto('/#/fincas');
    r.potreroEnFincas = (await page.getByRole('article').filter({ hasText: 'Finca Santa Rita' }).getByRole('listitem').filter({ hasText: nombrePot }).innerText()).replace(/\s+/g, ' ');
    r.desbordeFincas = await page.evaluate(() => document.documentElement.scrollWidth);

    registrar('mover desde el celular', r);
    expect(r.movimientos).toBe(2);
    expect(r.desborde).toBe(375);
    expect(r.textoFuera).toEqual([]);
    expect(r.desbordeFincas).toBe(375);
    expect(r.persisteTrasRecargar).toBe(true);
    expect(r.potreroEnFincas).toContain('2 reses');
  });
});
