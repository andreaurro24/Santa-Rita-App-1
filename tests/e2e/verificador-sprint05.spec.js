import { mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirContraste, medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para el Sprint 05 (specs 014–021), ronda 1 (commit d2808f7) y ronda 2
// (commit 09cfe4d: premisas de M6 y M2 adaptadas; lo nuevo de la ronda 2 está en verificador-sprint05-r2).
// Prefijo VRF5; todo se borra al final (ventas, ventas de caballos, animales, fotos, costos, lotes,
// fincas, tenedores, precios). Corre contra producción con E2E_PERMITIR_PRODUCCION=si (decisión del
// equipo para este sprint: producción aún tiene solo datos de ejemplo y el usuario de prueba).

const DIR = 'test-results/vrf-s05';
mkdirSync(DIR, { recursive: true });
const P = 'VRF5';
const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const enDias = (n) => haceDias(-n);
const num = (s) => (s == null ? NaN : Number(String(s).replace(/[−-]/, '-').replace(/[^\d-]/g, '')));

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}
const resumen = (r) => (r.error ? `${r.error.code} ${String(r.error.message).slice(0, 70)}` : 'ACEPTADO');

async function listarFotos(supabase, animalId) {
  const { data } = await supabase.storage.from('fotos-animales').list(animalId);
  return (data ?? []).map((o) => o.name);
}

async function limpiar() {
  const supabase = await clientePrueba();
  const { data: ventas } = await supabase.from('ventas').select('id').like('comprador', `${P}%`);
  for (const v of ventas ?? []) await supabase.from('ventas').delete().eq('id', v.id);
  const { data: animales } = await supabase.from('animales').select('id, foto_path').like('numero_interno', `${P}%`);
  for (const a of animales ?? []) {
    const nombres = await listarFotos(supabase, a.id);
    if (nombres.length) await supabase.storage.from('fotos-animales').remove(nombres.map((n) => `${a.id}/${n}`));
    await supabase.from('ventas_equinos').delete().eq('animal_id', a.id);
    await supabase.from('venta_animales').delete().eq('animal_id', a.id);
    await supabase.from('animales').delete().eq('id', a.id);
  }
  await supabase.from('costos').delete().like('descripcion', `${P}%`);
  await supabase.from('precios_referencia').delete().like('fuente', `${P}%`);
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
  const { data, error } = await supabase
    .from('lotes')
    .insert({ codigo: `${P}-L`, nombre: `${P} Lote`, tipo: 'ceba', peso_meta_kg: null, fecha_inicio: '2026-08-01' })
    .select('id')
    .single();
  if (error) throw error;
  LOTE = data.id;
});
test.afterAll(async () => {
  test.setTimeout(180_000);
  await limpiar();
});

async function bovino(supabase, numero, extra = {}) {
  const { data, error } = await supabase.rpc('registrar_animal', {
    datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: '2026-09-01', peso_ingreso_kg: 250, lote_id: LOTE, costo_compra_cop: 1_000_000, ...extra },
  });
  if (error) throw error;
  return data;
}

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
  const filas = [];
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 3);
    for (let x = 0; x < ancho; x++) {
      // Ruido: el peor caso para el tamaño del archivo comprimido.
      const v = (x * 2654435761 + y * 40503) >>> 0;
      fila[1 + x * 3] = v & 255;
      fila[2 + x * 3] = (v >>> 8) & 255;
      fila[3 + x * 3] = (v >>> 16) & 255;
    }
    filas.push(fila);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(filas))), chunk('IEND', Buffer.alloc(0))]);
}

// ───────────────────────────── Base de datos: escrituras directas ─────────────────────────────
test('VRF5 BD: nombres, montos, bajas, caballos, gastos y precios por escritura directa (018, 016, 020, 021)', async () => {
  test.setTimeout(120_000);
  const supabase = await clientePrueba();
  const r = {};
  const a = await bovino(supabase, `${P}-BD1`);

  // 018 · R2 en animales.
  r.numero31 = resumen(await supabase.from('animales').update({ numero_interno: 'X'.repeat(31) }).eq('id', a));
  r.numeroScript = resumen(await supabase.from('animales').update({ numero_interno: `${P}<b>` }).eq('id', a));
  r.duenoEmoji = resumen(await supabase.from('animales').update({ dueno: 'Juan 🐄' }).eq('id', a));
  r.duenoPuntoYComa = resumen(await supabase.from('animales').update({ dueno: 'Juan; drop' }).eq('id', a));
  r.duenoValido = resumen(await supabase.from('animales').update({ dueno: "José Ñúñez O'Neil (hijo) #2 / Rosana–Miguel" }).eq('id', a));
  r.duenoSoloEspacios = resumen(await supabase.from('animales').update({ dueno: '   ' }).eq('id', a));
  r.color41 = resumen(await supabase.from('animales').update({ color: 'a'.repeat(41) }).eq('id', a));
  r.chapetaRara = resumen(await supabase.from('animales').update({ chapeta_ica: 'AB$12' }).eq('id', a));
  // 020 / 018 en fincas, tenedores, potreros, lotes.
  r.fincaRara = resumen(await supabase.from('fincas').insert({ nombre: `${P} <x>`, tipo: 'propia' }));
  r.fincaPropietarioRaro = resumen(await supabase.from('fincas').insert({ nombre: `${P} F ok`, tipo: 'propia', propietario: 'Ana@correo' }));
  const { data: finca } = await supabase.from('fincas').insert({ nombre: `${P} Finca BD`, tipo: 'tenedor' }).select('id').single();
  r.tenedorRaro = resumen(await supabase.from('tenedores').insert({ nombre: `${P} Pe$dro`, finca_id: finca.id }));
  r.potreroRaro = resumen(await supabase.from('potreros').insert({ nombre: 'La {Ceiba}', finca_id: finca.id }));
  r.loteNombreRaro = resumen(await supabase.from('lotes').insert({ codigo: `${P}-X1`, nombre: 'Lote *', tipo: 'ceba' }));
  r.loteCodigo31 = resumen(await supabase.from('lotes').insert({ codigo: `${P}-${'9'.repeat(27)}`, nombre: `${P} ok`, tipo: 'ceba' }));
  r.loteDescripcion301 = resumen(await supabase.from('lotes').update({ descripcion: 'd'.repeat(301) }).eq('id', LOTE));
  r.loteDescripcion300 = resumen(await supabase.from('lotes').update({ descripcion: 'd'.repeat(300) }).eq('id', LOTE));
  await supabase.from('lotes').update({ descripcion: null }).eq('id', LOTE);
  // Ventas: comprador raro.
  r.ventaCompradorRaro = resumen(
    await supabase.rpc('registrar_venta', { lote: LOTE, fecha: haceDias(1), comprador: `${P} <script>`, precio_kg: 8000, destare: 0, recomendacion: null, notas: null, animales: [{ animal_id: a, peso_kg: 300, costo_cop: 0 }] }),
  );
  // 016 · R3: bajas.
  r.bajaFutura = resumen(await supabase.from('animales').update({ estado: 'muerto', fecha_baja: enDias(2) }).eq('id', a));
  r.bajaAntesIngreso = resumen(await supabase.from('animales').update({ estado: 'muerto', fecha_baja: '2026-08-15' }).eq('id', a));
  r.muertoSinFecha = resumen(await supabase.from('animales').update({ estado: 'muerto' }).eq('id', a));
  r.perdidoSinFecha = resumen(await supabase.from('animales').update({ estado: 'perdido' }).eq('id', a));
  r.motivo201 = resumen(await supabase.from('animales').update({ estado: 'muerto', fecha_baja: haceDias(1), motivo_baja: 'm'.repeat(201) }).eq('id', a));
  // 016 · R5, R8: categorías por especie y datos obligatorios del ganado.
  const reg = (datos) => supabase.rpc('registrar_animal', { datos: { origen: 'compra', fecha_ingreso: haceDias(1), ...datos } });
  r.bovinoSinChapeta = resumen(await reg({ numero_interno: `${P}-SINCH`, sexo: 'Macho', categoria: 'novillo', peso_ingreso_kg: 200, lote_id: LOTE }));
  r.bovinoSinLote = resumen(await reg({ numero_interno: `${P}-SINL`, chapeta_ica: `${P}-SINL`, sexo: 'Macho', categoria: 'novillo', peso_ingreso_kg: 200 }));
  r.bovinoYegua = resumen(await reg({ numero_interno: `${P}-YB`, chapeta_ica: `${P}-YB`, sexo: 'Hembra', categoria: 'yegua', peso_ingreso_kg: 200, lote_id: LOTE }));
  r.equinoNovillo = resumen(await reg({ especie: 'equino', numero_interno: `${P}-EQN`, sexo: 'Macho', categoria: 'novillo' }));
  r.vientreViejo = resumen(await reg({ numero_interno: `${P}-VV`, chapeta_ica: `${P}-VV`, sexo: 'Hembra', categoria: 'vientre', peso_ingreso_kg: 300, lote_id: LOTE }));
  r.vientreMacho = resumen(await reg({ numero_interno: `${P}-VM`, chapeta_ica: `${P}-VM`, sexo: 'Macho', categoria: 'vientre_menor', peso_ingreso_kg: 300, lote_id: LOTE }));
  // Ronda 2 (M6, migración 1800): un caballo no puede tener lote, pesajes ni gastos directos por API.
  r.caballoRegistradoConLote = resumen(await reg({ especie: 'equino', numero_interno: `${P}-CAB-LOTE`, sexo: 'Macho', categoria: 'caballo', lote_id: LOTE }));
  const cab = await reg({ especie: 'equino', numero_interno: `${P}-CAB`, sexo: 'Macho', categoria: 'caballo' });
  if (cab.error) throw cab.error;
  r.caballoConLote = resumen(await supabase.from('animales').update({ lote_id: LOTE }).eq('id', cab.data));
  const { count: pesajesCab } = await supabase.from('pesajes').select('id', { count: 'exact', head: true }).eq('animal_id', cab.data);
  r.caballoPesajesAlRegistrar = pesajesCab;
  r.caballoPesajeDirecto = resumen(await supabase.from('pesajes').insert({ animal_id: cab.data, fecha: haceDias(0), peso_kg: 400 }));
  r.caballoEnVentaDeGanado = resumen(
    await supabase.rpc('registrar_venta', { lote: LOTE, fecha: haceDias(0), comprador: `${P} C`, precio_kg: 8000, destare: 0, recomendacion: null, notas: null, animales: [{ animal_id: cab.data, peso_kg: 400, costo_cop: 0 }] }),
  );
  r.caballoGastoDirecto = resumen(await supabase.from('costos').insert({ lote_id: LOTE, animal_id: cab.data, categoria: 'otros', descripcion: `${P} gasto caballo`, monto_cop: 1000, fecha: haceDias(0) }));
  // vender_equino.
  const ve = (animal, extra = {}) => supabase.rpc('vender_equino', { animal, fecha: haceDias(0), comprador: `${P} Comprador`, precio_cop: 2_000_000, notas: null, ...extra });
  r.venderEquinoBovino = resumen(await ve(a));
  r.venderEquinoFutura = resumen(await ve(cab.data, { fecha: enDias(3) }));
  r.venderEquinoCompradorRaro = resumen(await ve(cab.data, { comprador: '<b>x</b>' }));
  r.venderEquinoPrecioCero = resumen(await ve(cab.data, { precio_cop: 0 }));
  r.venderEquinoAntesIngreso = resumen(await ve(cab.data, { fecha: haceDias(30) }));
  r.venderEquinoOk = resumen(await ve(cab.data));
  r.venderEquinoDosVeces = resumen(await ve(cab.data));
  r.eliminarCaballoVendido = resumen(await supabase.from('animales').delete().eq('id', cab.data).select('id'));
  // 020 · R4: gastos.
  r.gastoLoteYFinca = resumen(await supabase.from('costos').insert({ lote_id: LOTE, finca_id: finca.id, categoria: 'otros', descripcion: `${P} g1`, monto_cop: 1, fecha: haceDias(0) }));
  r.gastoSinNada = resumen(await supabase.from('costos').insert({ categoria: 'otros', descripcion: `${P} g2`, monto_cop: 1, fecha: haceDias(0) }));
  r.gastoFincaConAnimal = resumen(await supabase.from('costos').insert({ finca_id: finca.id, animal_id: a, categoria: 'otros', descripcion: `${P} g3`, monto_cop: 1, fecha: haceDias(0) }));
  r.gastoFincaNegativo = resumen(await supabase.from('costos').insert({ finca_id: finca.id, categoria: 'otros', descripcion: `${P} g4`, monto_cop: -5, fecha: haceDias(0) }));
  r.gastoFincaFuturo = resumen(await supabase.from('costos').insert({ finca_id: finca.id, categoria: 'otros', descripcion: `${P} g5`, monto_cop: 5, fecha: enDias(5) }));
  r.gastoFincaOk = resumen(await supabase.from('costos').insert({ finca_id: finca.id, categoria: 'otros', descripcion: `${P} g6`, monto_cop: 5, fecha: haceDias(0) }));
  // 021: precios de referencia.
  const pr = (extra) => supabase.from('precios_referencia').insert({ categoria: 'gordo', precio_min_cop: 8000, precio_max_cop: 9000, fecha: haceDias(0), fuente: `${P} fuente`, ...extra });
  r.precioMinMayorQueMax = resumen(await pr({ precio_min_cop: 9500 }));
  r.precioFuturo = resumen(await pr({ fecha: enDias(2) }));
  r.precioCategoriaRara = resumen(await pr({ categoria: 'caballo' }));
  r.precioCero = resumen(await pr({ precio_min_cop: 0 }));
  r.precioFuenteVacia = resumen(await pr({ fuente: '  ' }));
  // 016 · R2: un animal en una venta no se puede eliminar.
  const vendido = await bovino(supabase, `${P}-BD-VEND`);
  const venta = await supabase.rpc('registrar_venta', { lote: LOTE, fecha: haceDias(0), comprador: `${P} Comprador BD`, precio_kg: 8000, destare: 0, recomendacion: null, notas: null, animales: [{ animal_id: vendido, peso_kg: 300, costo_cop: 0 }] });
  r.ventaBovino = resumen(venta);
  r.eliminarVendido = resumen(await supabase.from('animales').delete().eq('id', vendido).select('id'));
  // Sin sesión: ventas_equinos y precios_referencia.
  const { createClient } = await import('@supabase/supabase-js');
  const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const le = await anon.from('ventas_equinos').select('id');
  const lp = await anon.from('precios_referencia').select('id');
  r.anon = { ventasEquinos: le.error?.code ?? `${le.data?.length} filas`, precios: lp.error?.code ?? `${lp.data?.length} filas`, venderEquino: resumen(await anon.rpc('vender_equino', { animal: cab.data, fecha: haceDias(0), comprador: 'x', precio_cop: 1, notas: null })) };
  registrar('BD', r);

  const rechazado = /^(23514|23502|22001|P0001)/;
  for (const k of ['numero31', 'numeroScript', 'duenoEmoji', 'duenoPuntoYComa', 'color41', 'chapetaRara', 'fincaRara', 'fincaPropietarioRaro', 'tenedorRaro', 'potreroRaro', 'loteNombreRaro', 'loteCodigo31', 'loteDescripcion301', 'bajaFutura', 'bajaAntesIngreso', 'muertoSinFecha', 'perdidoSinFecha', 'motivo201', 'bovinoSinChapeta', 'bovinoSinLote', 'bovinoYegua', 'equinoNovillo', 'vientreViejo', 'vientreMacho', 'venderEquinoBovino', 'venderEquinoFutura', 'venderEquinoCompradorRaro', 'venderEquinoAntesIngreso', 'venderEquinoDosVeces', 'gastoLoteYFinca', 'gastoSinNada', 'gastoFincaConAnimal', 'gastoFincaNegativo', 'gastoFincaFuturo', 'precioMinMayorQueMax', 'precioFuturo', 'precioCategoriaRara', 'precioCero', 'precioFuenteVacia', 'ventaCompradorRaro', 'caballoEnVentaDeGanado', 'caballoRegistradoConLote', 'caballoConLote', 'caballoPesajeDirecto', 'caballoGastoDirecto']) {
    expect.soft(r[k], k).toMatch(rechazado);
  }
  expect.soft(r.duenoValido).toBe('ACEPTADO');
  expect.soft(r.loteDescripcion300).toBe('ACEPTADO');
  expect.soft(r.venderEquinoOk).toBe('ACEPTADO');
  expect.soft(r.gastoFincaOk).toBe('ACEPTADO');
  expect.soft(r.eliminarVendido).toMatch(/^23503/);
  expect.soft(r.eliminarCaballoVendido).toMatch(/^23503/);
  expect.soft(r.caballoPesajesAlRegistrar).toBe(0);
});

// ───────────────────────────── Celular 375 ─────────────────────────────
test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('VRF5 016 R1/R2/R3: editar (campos), baja con validaciones y reparto, eliminar un vendido', async ({ page }) => {
    test.setTimeout(150_000);
    const supabase = await clientePrueba();
    const r = {};
    // Lote propio para que el reparto no dependa de los animales de otras pruebas.
    const { data: l4 } = await supabase.from('lotes').insert({ codigo: `${P}-L4`, nombre: `${P} Lote reparto`, tipo: 'ceba', fecha_inicio: '2026-08-01' }).select('id').single();
    const a = await bovino(supabase, `${P}-A`, { lote_id: l4.id });
    const b = await bovino(supabase, `${P}-B`, { lote_id: l4.id });
    const v = await bovino(supabase, `${P}-V`, { lote_id: l4.id });
    await iniciarSesion(page);

    // R1: campos del formulario de edición de un bovino.
    await page.goto(`/#/animales/${a}`);
    await page.getByRole('button', { name: 'Editar' }).click();
    const hoja = page.getByRole('dialog', { name: `Editar ${P}-A` });
    await expect(hoja).toBeVisible();
    const campos = {};
    for (const c of ['Número interno', 'Chapeta ICA', 'Sexo', 'Categoría', 'Origen', 'Fecha de nacimiento', 'Peso objetivo', 'Dueño', 'Color', 'Peso de ingreso', 'Lote']) {
      campos[c] = await hoja.getByLabel(c, { exact: false }).count();
    }
    campos.compra = await hoja.getByText('Precio de compra').count();
    r.camposEdicionBovino = campos;
    // Chapeta duplicada al editar.
    await hoja.getByLabel('Chapeta ICA').fill(`${P}-B-CH`);
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    await page.waitForTimeout(1500);
    r.chapetaDuplicada = (await hoja.getByRole('alert').count()) ? await hoja.getByRole('alert').innerText() : 'sin alerta';
    // Peso objetivo menor que el ingreso y texto en el número.
    await hoja.getByLabel('Chapeta ICA').fill(`${P}-A-CH`);
    await hoja.getByLabel('Peso objetivo').fill('100');
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    r.objetivoMenor = await hoja.getByRole('alert').innerText().catch(() => 'sin alerta');
    await hoja.getByLabel('Peso objetivo').fill('abc');
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    r.objetivoTexto = await hoja.getByRole('alert').innerText().catch(() => 'sin alerta');
    await hoja.getByLabel('Peso objetivo').fill('');
    await hoja.getByRole('button', { name: 'Cancelar' }).click();

    // R3: baja con fecha futura y anterior al ingreso (UI).
    await page.getByRole('button', { name: 'Dar de baja' }).click();
    const baja = page.getByRole('dialog', { name: /Dar de baja/ });
    await baja.getByLabel('Fecha').fill(enDias(2));
    await baja.getByRole('button', { name: 'Dar de baja' }).click();
    r.bajaFuturaUI = await baja.getByRole('alert').innerText().catch(() => 'sin alerta');
    await baja.getByLabel('Fecha').fill('2026-08-20');
    await baja.getByRole('button', { name: 'Dar de baja' }).click();
    r.bajaAntesIngresoUI = await baja.getByRole('alert').innerText().catch(() => 'sin alerta');
    await baja.getByLabel('Motivo').selectOption('perdido');
    await baja.getByLabel('Fecha').fill('2026-09-15');
    await baja.getByLabel('Detalle').fill('Se salió por la cerca');
    await baja.getByRole('button', { name: 'Dar de baja' }).dblclick();
    await expect(baja).toHaveCount(0);
    const { data: fa } = await supabase.from('animales').select('estado, fecha_baja, motivo_baja').eq('id', a).single();
    r.bajaGuardada = fa;
    await page.screenshot({ path: `${DIR}/ficha-baja-375.png`, fullPage: true });
    r.botonesTrasBaja = { darDeBaja: await page.getByRole('button', { name: 'Dar de baja' }).count(), vender: await page.getByRole('link', { name: 'Vender este animal' }).count() };

    // R3 + 020: reparto. Gasto de lote de $300.000 hoy: A (perdido el 15-09) no lo recibe; B y V se lo reparten.
    await supabase.from('costos').insert({ lote_id: l4.id, categoria: 'otros', descripcion: `${P} gasto lote`, monto_cop: 300_000, fecha: haceDias(0) });
    // y uno de antes de la baja (10-09): lo reparten A, B y V.
    await supabase.from('costos').insert({ lote_id: l4.id, categoria: 'otros', descripcion: `${P} gasto antes`, monto_cop: 90_000, fecha: '2026-09-10' });
    // y uno de la finca: no lo recibe nadie.
    const { data: fp } = await supabase.from('fincas').select('id').eq('tipo', 'propia').limit(1).single();
    await supabase.from('costos').insert({ finca_id: fp.id, categoria: 'otros', descripcion: `${P} gasto finca`, monto_cop: 5_000_000, fecha: haceDias(0) });
    const parteDe = async (id) => {
      await page.goto(`/#/animales/${id}`);
      await page.reload();
      const stat = page.getByText('Parte de los gastos del lote', { exact: true }).locator('..');
      await expect(stat).toBeVisible();
      return num((await stat.innerText()).replace('Parte de los gastos del lote', ''));
    };
    r.reparto = { A: await parteDe(a), B: await parteDe(b), V: await parteDe(v) };

    // R2: eliminar un animal vendido.
    await supabase.rpc('registrar_venta', { lote: l4.id, fecha: haceDias(0), comprador: `${P} Comprador`, precio_kg: 8000, destare: 0, recomendacion: null, notas: null, animales: [{ animal_id: v, peso_kg: 300, costo_cop: 0 }] });
    await page.goto(`/#/animales/${v}`);
    await page.getByRole('button', { name: 'Eliminar' }).click();
    const elim = page.getByRole('dialog', { name: /Eliminar/ });
    await elim.getByRole('button', { name: 'Sí, eliminar' }).click();
    await expect(elim.getByRole('alert')).toBeVisible();
    r.eliminarVendidoUI = { alerta: await elim.getByRole('alert').innerText(), botones: await elim.getByRole('button').allInnerTexts() };
    await page.screenshot({ path: `${DIR}/eliminar-vendido-375.png` });
    const { count } = await supabase.from('animales').select('id', { count: 'exact', head: true }).eq('id', v);
    r.vendidoSigue = count;
    registrar('animales', r);

    expect.soft(campos.Color, 'R1: el color se puede editar').toBeGreaterThan(0);
    expect.soft(campos['Peso de ingreso'], 'R1: el peso de ingreso NO se edita').toBe(0);
    expect.soft(r.bajaFuturaUI).toMatch(/futura/);
    expect.soft(r.bajaAntesIngresoUI).toMatch(/anterior al ingreso/);
    expect.soft(fa).toMatchObject({ estado: 'perdido', fecha_baja: '2026-09-15' });
    expect.soft(r.reparto.A).toBe(30_000);
    expect.soft(r.reparto.B).toBe(30_000 + 150_000);
    expect.soft(r.vendidoSigue).toBe(1);
    expect.soft(r.eliminarVendidoUI.alerta).toMatch(/venta/);
  });

  test('VRF5 019: asistente de 3 pasos, precio de la zona precargado, doble toque en Siguiente y resumen = guardado', async ({ page }) => {
    test.setTimeout(150_000);
    const supabase = await clientePrueba();
    const r = {};
    const id = await bovino(supabase, `${P}-VTA`, { peso_ingreso_kg: 400 });
    const { data: rangos } = await supabase.from('precios_referencia').select('categoria, precio_min_cop, precio_max_cop, fecha, created_at').eq('categoria', 'gordo').order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(1);
    const esperado = Math.round((rangos[0].precio_min_cop + rangos[0].precio_max_cop) / 2);
    await iniciarSesion(page);
    await page.goto(`/#/animales/${id}`);
    await page.getByRole('link', { name: 'Vender este animal' }).click();
    await expect(page.getByRole('heading', { name: /^Animales \(1 de / })).toBeVisible();
    r.pasos = await page.getByRole('list', { name: 'Pasos' }).getByRole('listitem').allInnerTexts();
    await page.screenshot({ path: `${DIR}/venta-paso1-375.png`, fullPage: true });
    r.desbordePaso1 = (await page.evaluate(medirDesborde)).scrollWidth;
    // Paso 1: Ninguno → no avanza.
    await page.getByRole('button', { name: 'Ninguno' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    r.sinAnimales = await page.getByRole('alert').innerText().catch(() => 'sin alerta');
    await page.getByRole('checkbox', { name: `Vender ${P}-VTA` }).check();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    // Paso 2: precio precargado (gordo, 400 kg).
    const precio = page.getByLabel('Precio por kilo');
    r.precioPrecargado = await precio.inputValue();
    r.precioEsperado = esperado;
    await page.getByRole('button', { name: 'Atrás' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByLabel('Comprador').fill(`${P} Comprador asistente`);
    await page.getByLabel('Destare (%)').fill('20');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    r.destare20 = await page.getByRole('alert').innerText().catch(() => 'sin alerta');
    await page.getByLabel('Destare (%)').fill('3');
    await page.getByLabel('Fecha de la venta').fill(enDias(1));
    await page.getByRole('button', { name: 'Siguiente' }).click();
    r.fechaFutura = await page.getByRole('alert').innerText().catch(() => 'sin alerta');
    await page.getByLabel('Fecha de la venta').fill(haceDias(0));
    await page.screenshot({ path: `${DIR}/venta-paso2-375.png`, fullPage: true });
    // Doble toque en Siguiente: ¿se guarda la venta sin ver el resumen?
    await page.getByRole('button', { name: 'Siguiente' }).dblclick();
    await page.waitForTimeout(3000);
    const { data: ventas } = await supabase.from('ventas').select('id').like('comprador', `${P} Comprador asistente`);
    r.ventasTrasDobleToque = ventas.length;
    r.urlTrasDobleToque = page.url().replace(/^.*#/, '#');
    await page.screenshot({ path: `${DIR}/venta-doble-toque-375.png`, fullPage: true });
    if (ventas.length === 0) {
      const resultado = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Resultado de esta venta' }) });
      r.resumen = await resultado.innerText();
      r.desbordePaso3 = (await page.evaluate(medirDesborde)).scrollWidth;
      await page.getByRole('button', { name: 'Guardar venta' }).click();
      await expect(page.getByRole('heading', { name: /^Venta de / })).toBeVisible();
    }
    const { data: guardada } = await supabase.from('ventas').select('precio_kg_cop, destare_pct, venta_animales ( peso_kg )').like('comprador', `${P} Comprador asistente`).single();
    r.guardada = guardada;
    registrar('asistente', r);

    expect.soft(r.pasos.length).toBe(3);
    expect.soft(r.sinAnimales).toMatch(/al menos un animal/);
    expect.soft(num(r.precioPrecargado)).toBe(esperado);
    expect.soft(r.destare20).toMatch(/destare/i);
    expect.soft(r.fechaFutura).toMatch(/futura/);
    expect.soft(r.ventasTrasDobleToque, 'un doble toque en Siguiente no debe guardar la venta').toBe(0);
    expect.soft(Number(guardada.venta_animales[0].peso_kg)).toBe(400);
  });

  test('VRF5 016 R8: caballos fuera de ganado (lista, lotes, pesaje, venta, inicio)', async ({ page }) => {
    test.setTimeout(120_000);
    const supabase = await clientePrueba();
    const r = {};
    await iniciarSesion(page);
    const contar = async () => num(await page.getByRole('link', { name: /Reses activas/ }).locator('.cifra').innerText());
    r.resesAntes = await contar();
    await page.goto('/#/animales?ver=caballos');
    await page.getByRole('button', { name: 'Registrar caballo' }).click();
    const hoja = page.getByRole('dialog', { name: 'Registrar caballo' });
    r.camposCaballo = {};
    for (const c of ['Chapeta ICA', 'Peso de ingreso', 'Lote', 'Peso objetivo', 'Color', 'Dueño', 'Precio del animal', 'Número o nombre']) r.camposCaballo[c] = await hoja.getByLabel(c).count();
    await hoja.getByLabel('Número o nombre').fill(`${P} Lucero`);
    await hoja.getByLabel('Sexo').selectOption('Hembra');
    await hoja.getByLabel('Categoría').selectOption('yegua');
    await hoja.getByLabel('Dueño').fill(`${P} Juan`);
    await hoja.getByRole('button', { name: 'Guardar' }).dblclick();
    await expect(hoja).toHaveCount(0);
    await page.waitForTimeout(1500);
    const { data: cabs } = await supabase.from('animales').select('id, especie, categoria, lote_id').eq('numero_interno', `${P} Lucero`);
    r.caballosCreados = cabs.length;
    await page.screenshot({ path: `${DIR}/caballos-375.png`, fullPage: true });
    r.desbordeCaballos = (await page.evaluate(medirDesborde)).scrollWidth;
    // No sale en la lista de ganado ni en el buscador del ganado.
    await page.goto('/#/animales');
    await page.getByPlaceholder('Buscar por número, chapeta o dueño').fill(`${P} Lucero`);
    r.enGanado = await page.getByRole('link', { name: new RegExp(`${P} Lucero`) }).count();
    // Búsqueda por dueño en caballos.
    await page.goto('/#/animales?ver=caballos');
    await page.getByPlaceholder('Buscar por número, chapeta o dueño').fill(`${P} Juan`);
    r.buscaDuenoCaballos = await page.getByRole('link', { name: new RegExp(`${P} Lucero`) }).count();
    // Inicio: reses activas no cambia.
    await page.goto('/#/');
    r.resesDespues = await contar();
    // Ficha del caballo: sin pesaje ni "Vender este animal".
    await page.goto(`/#/animales/${cabs[0].id}`);
    await expect(page.getByRole('heading', { name: `${P} Lucero` })).toBeVisible();
    r.fichaCaballo = {
      pesar: await page.getByRole('button', { name: /pesaje|Pesar/i }).count(),
      venderGanado: await page.getByRole('link', { name: 'Vender este animal' }).count(),
      venderCaballo: await page.getByRole('button', { name: 'Vender caballo' }).count(),
      foto: await page.getByRole('button', { name: /Agregar foto/ }).count(),
    };
    r.desbordeFichaCaballo = (await page.evaluate(medirDesborde)).scrollWidth;
    // Un caballo con lote por API (VRF5-CAB-LOTE del test de BD puede no existir): crear uno.
    const cab2 = await supabase.rpc('registrar_animal', { datos: { especie: 'equino', numero_interno: `${P}-CAB2`, sexo: 'Macho', categoria: 'potro', origen: 'compra', fecha_ingreso: haceDias(1), lote_id: LOTE } });
    await page.goto(`/#/ventas/nueva?lote=${LOTE}`);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Registrar venta' })).toBeVisible();
    r.caballoEnAsistente = await page.getByRole('checkbox', { name: new RegExp(`${P}-CAB2|${P} Lucero`) }).count();
    await page.goto('/#/lotes');
    r.caballoEnLotes = await page.getByText(`${P}-CAB2`).count();
    await page.goto('/#/pesaje');
    r.caballoEnPesaje = await page.getByText(`${P}-CAB2`).count();
    r.cab2 = cab2.error ? cab2.error.message : 'creado';
    registrar('caballos', r);

    expect.soft(r.camposCaballo['Chapeta ICA']).toBe(0);
    expect.soft(r.camposCaballo['Peso de ingreso']).toBe(0);
    expect.soft(r.caballosCreados, 'doble toque en Guardar no duplica').toBe(1);
    expect.soft(r.enGanado).toBe(0);
    expect.soft(r.resesDespues).toBe(r.resesAntes);
    expect.soft(r.caballoEnAsistente).toBe(0);
    expect.soft(r.fichaCaballo.venderGanado).toBe(0);
    expect.soft(r.desbordeCaballos).toBeLessThanOrEqual(375);
  });

  test('VRF5 017: foto ilegible, cambiar y quitar sin huérfanos, eliminar con foto, subida directa', async ({ page }) => {
    test.setTimeout(180_000);
    const supabase = await clientePrueba();
    const r = {};
    const id = await bovino(supabase, `${P}-FOTO`);
    await iniciarSesion(page);
    await page.goto(`/#/animales/${id}`);
    const input = page.getByLabel('Foto del animal');
    // Primera foto (4000×3000 con ruido: el peor caso de tamaño).
    await input.setInputFiles({ name: 'vaca.png', mimeType: 'image/png', buffer: png(4000, 3000) });
    await expect(page.getByRole('img', { name: `Foto de ${P}-FOTO` })).toBeVisible({ timeout: 60_000 });
    const { data: f1 } = await supabase.from('animales').select('foto_path').eq('id', id).single();
    const { data: blob1 } = await supabase.storage.from('fotos-animales').download(f1.foto_path);
    r.foto1 = { ruta: f1.foto_path, bytes: blob1?.size, tipo: blob1?.type };
    r.lado1 = await page.getByRole('img', { name: `Foto de ${P}-FOTO` }).evaluate((el) => [el.naturalWidth, el.naturalHeight]);
    // Archivo que no es imagen y una "imagen" corrupta: la foto anterior se conserva.
    await input.setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') });
    r.noImagen = await page.getByRole('alert').first().innerText().catch(() => 'sin alerta');
    await input.setInputFiles({ name: 'rota.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('esto no es un jpeg') });
    await page.waitForTimeout(1500);
    r.corrupta = await page.getByRole('alert').first().innerText().catch(() => 'sin alerta');
    const { data: f1b } = await supabase.from('animales').select('foto_path').eq('id', id).single();
    r.conservaFoto = f1b.foto_path === f1.foto_path;
    // Cambiar foto: la vieja se borra del bucket.
    await input.setInputFiles({ name: 'vaca2.png', mimeType: 'image/png', buffer: png(1200, 900) });
    await expect.poll(async () => (await supabase.from('animales').select('foto_path').eq('id', id).single()).data.foto_path, { timeout: 60_000 }).not.toBe(f1.foto_path);
    await page.waitForTimeout(1500);
    r.objetosTrasCambiar = await listarFotos(supabase, id);
    await page.screenshot({ path: `${DIR}/foto-375.png`, fullPage: true });
    // Quitar foto.
    await page.getByRole('button', { name: 'Quitar foto' }).click();
    await expect(page.getByText('Sin foto')).toBeVisible();
    await page.waitForTimeout(1500);
    r.objetosTrasQuitar = await listarFotos(supabase, id);
    // Eliminar un animal con foto: su archivo se borra.
    const id2 = await bovino(supabase, `${P}-FOTO2`);
    await page.reload();
    await page.goto(`/#/animales/${id2}`);
    await page.getByLabel('Foto del animal').setInputFiles({ name: 'v.png', mimeType: 'image/png', buffer: png(800, 600) });
    await expect(page.getByRole('img', { name: `Foto de ${P}-FOTO2` })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('dialog', { name: /Eliminar/ }).getByRole('button', { name: 'Sí, eliminar' }).click();
    await expect(page).toHaveURL(/#\/animales$/);
    await page.waitForTimeout(1500);
    r.objetosTrasEliminar = await listarFotos(supabase, id2);
    // Subidas directas a la API de Storage.
    const { data: ses } = await supabase.auth.getSession();
    const base = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/fotos-animales`;
    const cab = (extra) => ({ apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY, ...extra });
    const sube = async (nombre, cuerpo, tipo, token = ses.session.access_token) =>
      (await fetch(`${base}/${id}/${nombre}`, { method: 'POST', headers: cab({ 'Content-Type': tipo, ...(token ? { Authorization: `Bearer ${token}` } : {}) }), body: cuerpo })).status;
    r.directo = {
      sinSesion: await sube('anon.jpg', Buffer.alloc(1000, 1), 'image/jpeg', null),
      texto: await sube('x.txt', Buffer.from('hola'), 'text/plain'),
      png: await sube('x.png', png(10, 10), 'image/png'),
      grande: await sube('grande.jpg', Buffer.alloc(1_100_000, 7), 'image/jpeg'),
      jpegValido: await sube('ok.jpg', Buffer.alloc(2000, 7), 'image/jpeg'),
    };
    const pub = await fetch(`${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/fotos-animales/${id}/ok.jpg`);
    r.urlPublica = pub.status;
    r.objetosTrasDirecto = await listarFotos(supabase, id);
    registrar('fotos', r);

    expect.soft(r.foto1.bytes).toBeLessThanOrEqual(1024 * 1024);
    expect.soft(Math.max(...r.lado1)).toBeLessThanOrEqual(1280);
    expect.soft(r.corrupta).toMatch(/foto/i);
    expect.soft(r.conservaFoto).toBe(true);
    expect.soft(r.objetosTrasCambiar.length, 'al cambiar la foto queda un solo archivo').toBe(1);
    expect.soft(r.objetosTrasQuitar.length, 'al quitar la foto no queda archivo').toBe(0);
    expect.soft(r.objetosTrasEliminar.length).toBe(0);
    expect.soft(r.directo.sinSesion).toBeGreaterThanOrEqual(400);
    expect.soft(r.directo.texto).toBeGreaterThanOrEqual(400);
    expect.soft(r.directo.grande).toBeGreaterThanOrEqual(400);
    expect.soft(r.urlPublica).toBeGreaterThanOrEqual(400);
  });

  test('VRF5 020: finca con tenedor existente o nuevo, doble toque, marca Al partir en Lotes y Gastos', async ({ page }) => {
    test.setTimeout(150_000);
    const supabase = await clientePrueba();
    const r = {};
    // Un tenedor que ya tiene su finca.
    const { data: fa } = await supabase.from('fincas').insert({ nombre: `${P} Finca A`, tipo: 'tenedor' }).select('id').single();
    const { data: ten } = await supabase.from('tenedores').insert({ nombre: `${P} Pedro`, finca_id: fa.id }).select('id').single();
    await iniciarSesion(page);
    await page.goto('/#/fincas');
    await page.getByRole('button', { name: 'Nueva finca' }).click();
    let hoja = page.getByRole('dialog', { name: 'Nueva finca' });
    await hoja.getByLabel('Nombre de la finca').fill(`${P} Finca B`);
    await hoja.getByLabel('Tipo').selectOption('tenedor');
    // Ronda 2 (M2): un tenedor que ya tiene finca no se ofrece; no se le quita la suya.
    await page.screenshot({ path: `${DIR}/finca-tenedor-375.png`, fullPage: true });
    r.opcionesTenedor = await hoja.getByLabel(/^Tenedor/).evaluate((s) => [...s.options].map((o) => o.text));
    r.pedroOfrecido = r.opcionesTenedor.includes(`${P} Pedro`);
    await hoja.getByRole('button', { name: 'Cancelar' }).click();
    const { data: tenDespues } = await supabase.from('tenedores').select('finca_id').eq('id', ten.id).single();
    r.tenedorExistente = { fincaDespues: tenDespues.finca_id === fa.id ? 'A' : '?' };
    r.tarjetaA = await page.locator('article').filter({ hasText: `${P} Finca A` }).getByText(/A nombre de/).innerText();
    // Tenedor nuevo con doble toque en Guardar.
    await page.getByRole('button', { name: 'Nueva finca' }).click();
    hoja = page.getByRole('dialog', { name: 'Nueva finca' });
    await hoja.getByLabel('Nombre de la finca').fill(`${P} Finca C`);
    await hoja.getByLabel('Tipo').selectOption('tenedor');
    await hoja.getByLabel(/^Tenedor/).selectOption('nuevo');
    await hoja.getByLabel('Nombre del tenedor nuevo').fill(`${P} Rosa<`);
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    r.tenedorNuevoRaro = await hoja.getByRole('alert').innerText().catch(() => 'sin alerta');
    await hoja.getByLabel('Nombre del tenedor nuevo').fill(`${P} Rosa`);
    await hoja.getByRole('button', { name: 'Guardar' }).dblclick();
    await page.waitForTimeout(3000);
    r.trasDobleToque = (await hoja.count()) ? await hoja.getByRole('alert').innerText().catch(() => 'abierto sin alerta') : 'cerrado';
    await page.screenshot({ path: `${DIR}/finca-doble-toque-375.png`, fullPage: true });
    if (await hoja.count()) await hoja.getByRole('button', { name: 'Cancelar' }).click();
    const { data: rosas } = await supabase.from('tenedores').select('id, finca_id').eq('nombre', `${P} Rosa`);
    r.tenedoresRosa = rosas;
    const { data: fc } = await supabase.from('fincas').select('id, propietario, tenedores ( nombre )').eq('nombre', `${P} Finca C`);
    r.fincaCDobleToque = fc.map((f) => ({ propietario: f.propietario, tenedores: f.tenedores.map((t) => t.nombre) }));
    r.desbordeFincas = (await page.evaluate(medirDesborde)).scrollWidth;

    // R3: marca "Al partir" (datos de ejemplo: lotes con animales de tenedores).
    const { data: ap } = await supabase.from('animales').select('lote_id, lote:lotes ( nombre ), contrato:contratos_al_partir ( tenedor:tenedores ( nombre ) )').eq('estado', 'activo').eq('especie', 'bovino').not('contrato_id', 'is', null).limit(1);
    if (ap?.length) {
      const lote = ap[0].lote.nombre;
      const tenedor = ap[0].contrato.tenedor.nombre;
      await page.goto('/#/lotes');
      await expect(page.getByRole('heading', { name: lote, exact: true })).toBeVisible();
      const tarjeta = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: lote, exact: true }) });
      r.marcaLotes = await tarjeta.getByText(`Al partir · ${tenedor}`).count();
      await page.goto(`/#/costos?lote=${ap[0].lote_id}`);
      r.marcaGastosSelect = await page.getByLabel('Ver gastos de').locator('option:checked').innerText();
      r.marcaGastosBadge = await page.getByText(`Al partir · ${tenedor}`).count();
      await page.screenshot({ path: `${DIR}/gastos-al-partir-375.png`, fullPage: true });
      r.desbordeGastos = (await page.evaluate(medirDesborde)).scrollWidth;
    } else r.marca = 'sin animales Al partir en la base';
    // R2: descripción de lote de 301 caracteres en la UI.
    await page.goto('/#/lotes');
    await page.getByRole('button', { name: 'Nuevo lote' }).click();
    hoja = page.getByRole('dialog', { name: 'Nuevo lote' });
    await hoja.getByLabel('Código').fill(`${P}-L2`);
    await hoja.getByLabel('Nombre').first().fill(`${P} Lote dos`);
    await hoja.getByLabel('Descripción').fill('x'.repeat(320));
    r.descripcionLargo = (await hoja.getByLabel('Descripción').inputValue()).length;
    await hoja.getByRole('button', { name: 'Cancelar' }).click();
    registrar('fincas', r);

    expect.soft(r.pedroOfrecido, 'M2: un tenedor con finca no se ofrece').toBe(false);
    expect.soft(r.tenedorExistente.fincaDespues).toBe('A');
    expect.soft(r.tenedorNuevoRaro).toMatch(/solo puede tener/);
    expect.soft(r.trasDobleToque, 'M3: sin error falso tras el doble toque').toBe('cerrado');
    expect.soft(r.fincaCDobleToque.length, 'doble toque no duplica la finca').toBe(1);
    expect.soft(r.marcaLotes ?? 1).toBeGreaterThan(0);
    expect.soft(r.marcaGastosBadge ?? 1).toBeGreaterThan(0);
    expect.soft(r.tarjetaA, 'la finca A del tenedor no debe quedar sin dueño sin aviso').not.toMatch(/sin registrar/);
  });

  test('VRF5 018: CampoPesos (miles, cursor, coma decimal, pegar)', async ({ page }) => {
    const r = {};
    await iniciarSesion(page);
    await page.goto('/#/costos?ver=finca');
    await page.getByRole('button', { name: 'Anotar gasto' }).first().click();
    const hoja = page.getByRole('dialog', { name: 'Anotar gasto' });
    const monto = hoja.getByLabel('Monto');
    r.inputmode = await monto.getAttribute('inputmode');
    await monto.pressSequentially('1000000');
    r.miles = await monto.inputValue();
    // Cursor: después del primer dígito escribir 2 → "12.000.000" y el cursor queda tras el 2.
    await monto.evaluate((el) => el.setSelectionRange(1, 1));
    await monto.press('2');
    await page.waitForTimeout(100);
    r.insertarEnMedio = { valor: await monto.inputValue(), cursor: await monto.evaluate((el) => el.selectionStart) };
    // Borrar con retroceso justo después de un punto.
    await monto.fill('');
    await monto.pressSequentially('8500,5');
    r.comaDecimal = await monto.inputValue();
    await monto.fill('');
    await monto.pressSequentially('abc-12');
    r.letras = await monto.inputValue();
    await monto.fill('$1.500.000,00');
    r.pegarConCentavos = await monto.inputValue();
    await monto.fill('0000');
    r.ceros = await monto.inputValue();
    await hoja.getByLabel('Descripción').fill(`${P} ceros`);
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    r.guardarCero = await hoja.getByRole('alert').innerText().catch(() => 'sin alerta');
    registrar('campoPesos', r);
    expect.soft(r.miles).toBe('1.000.000');
    expect.soft(r.insertarEnMedio.valor).toBe('12.000.000');
    expect.soft(r.letras).toBe('12');
    expect.soft(r.guardarCero).toMatch(/monto/);
  });

  test('VRF5 015/021: ¿Vendo? plegado, precio por categoría (umbral 350 kg) y simulación', async ({ page }) => {
    test.setTimeout(120_000);
    const supabase = await clientePrueba();
    const r = {};
    // Lote propio con dos novillos: 300 kg (levante) y 400 kg (gordo). Sin gastos.
    const { data: lote } = await supabase.from('lotes').insert({ codigo: `${P}-L3`, nombre: `${P} Lote precio`, tipo: 'ceba', fecha_inicio: '2026-08-01' }).select('id').single();
    for (const [n, peso] of [['P300', 300], ['P400', 400], ['P349', 349.9]]) {
      await supabase.rpc('registrar_animal', { datos: { numero_interno: `${P}-${n}`, chapeta_ica: `${P}-${n}`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: '2026-09-01', peso_ingreso_kg: peso, lote_id: lote.id, costo_compra_cop: 1_000_000 } });
    }
    const { data: rangos } = await supabase.from('precios_referencia').select('categoria, precio_min_cop, precio_max_cop, fecha, created_at').order('fecha', { ascending: false }).order('created_at', { ascending: false });
    const vig = {};
    for (const x of rangos) vig[x.categoria] ??= Math.round((x.precio_min_cop + x.precio_max_cop) / 2);
    const { data: par } = await supabase.from('parametros').select('destare_pct').single();
    const d = 1 - Number(par.destare_pct) / 100;
    const esperado = Math.round(((300 * vig.levante + 349.9 * vig.levante + 400 * vig.gordo) * d) / ((300 + 349.9 + 400) * d));
    r.vigentes = vig;
    r.precioEsperado = esperado;
    await iniciarSesion(page);
    await page.goto('/#/recomendacion');
    await page.getByLabel('Lote a evaluar').selectOption({ label: `${P} Lote precio` });
    const detalles = page.locator('details');
    await expect(detalles).toHaveCount(1);
    r.detallesAbiertos = await detalles.evaluate((el) => el.open);
    r.margenVisible = await page.getByText('Margen para Santa Rita hoy').isVisible();
    const precioStat = page.getByText('Precio del kilo', { exact: true }).locator('..');
    r.precioMostrado = await precioStat.innerText();
    await page.screenshot({ path: `${DIR}/vendo-375.png`, fullPage: true });
    r.desborde = (await page.evaluate(medirDesborde)).scrollWidth;
    await page.getByText('Ver detalles').click();
    r.trasAbrir = await detalles.evaluate((el) => el.open);
    r.escenarios = await page.getByRole('table').count();
    await page.getByLabel('Probar con otro precio por kilo').pressSequentially('9000');
    await page.waitForTimeout(300);
    r.simulado = await precioStat.innerText();
    r.textoClima = await page.getByText(/clima|lluvia|TRM|pronóstico/i).count();
    registrar('vendo', r);
    expect.soft(r.detallesAbiertos).toBe(false);
    expect.soft(r.margenVisible).toBe(true);
    expect.soft(num(r.precioMostrado.split('/kg')[0])).toBe(esperado);
    expect.soft(r.simulado).toMatch(/9\.000/);
    expect.soft(r.simulado).toMatch(/simulado/i);
    expect.soft(r.textoClima).toBe(0);
  });

  test('VRF5 015/014: recorrido 375 (desborde, botones ≥ 56 px, contraste, consola y red) y base vacía simulada', async ({ page }) => {
    test.setTimeout(240_000);
    const r = { pantallas: {} };
    const consola = [];
    const red = [];
    page.on('console', (m) => m.type() === 'error' && consola.push(`${page.url().replace(/^.*#/, '#')} ${m.text().slice(0, 160)}`));
    page.on('pageerror', (e) => consola.push(`pageerror ${e.message.slice(0, 160)}`));
    page.on('response', (res) => res.status() >= 400 && red.push(`${res.status()} ${res.request().method()} ${res.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 120)}`));
    await iniciarSesion(page);
    const rutas = ['/', '/animales', '/animales?ver=caballos', '/costos', '/costos?ver=finca', '/recomendacion', '/pesaje', '/lotes', '/fincas', '/al-partir', '/ventas', '/ventas/nueva', '/mercado', '/reporte', '/indicadores'];
    for (const ruta of rutas) {
      await page.goto(`/#${ruta}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
      const desb = await page.evaluate(medirDesborde);
      const chicos = await page.evaluate(() =>
        [...document.querySelectorAll('main button, main input:not([type=checkbox]):not([type=radio]):not(.sr-only), main select, nav[aria-label="Principal"] a, nav[aria-label="Principal"] button')]
          .filter((el) => el.checkVisibility())
          .map((el) => ({ t: (el.getAttribute('aria-label') || el.innerText || el.placeholder || el.tagName).trim().slice(0, 30), h: Math.round(el.getBoundingClientRect().height) }))
          .filter((c) => c.h < 55.5),
      );
      const contraste = await page.evaluate(medirContraste);
      const letraChica = await page.evaluate(() => {
        const tam = [...document.querySelectorAll('main *')].filter((el) => el.checkVisibility() && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((el) => parseFloat(getComputedStyle(el).fontSize));
        return { textos: tam.length, menos18: tam.filter((x) => x < 17.9).length, menos15: tam.filter((x) => x < 15).length };
      });
      r.pantallas[ruta] = { scrollWidth: desb.scrollWidth, fuera: desb.fuera.slice(0, 3), controlesBajos: chicos.slice(0, 6), nControlesBajos: chicos.length, contrasteFalla: contraste.fallan.slice(0, 4), letraChica };
    }
    await page.goto('/#/');
    await page.screenshot({ path: `${DIR}/inicio-375.png`, fullPage: true });
    r.inicio = {
      accesos: await page.getByRole('navigation', { name: 'Accesos rápidos' }).getByRole('link').allInnerTexts(),
      paraRevisar: await page.getByText('Para revisar').count(),
    };
    r.consola = consola;
    r.red = red;

    // 014 · criterio: base vacía simulada (las tablas de datos devuelven 0 filas).
    const vacias = ['animales', 'lotes', 'fincas', 'potreros', 'costos', 'ventas', 'ventas_equinos', 'venta_animales', 'pesajes', 'jornadas_pesaje', 'movimientos', 'tenedores', 'contratos_al_partir', 'visitas_verificacion', 'visita_animales', 'condicion_pasto', 'precios_mercado', 'eventos_sanitarios'];
    await page.route(/\/rest\/v1\/([a-z_]+)/, async (route) => {
      const tabla = route.request().url().match(/\/rest\/v1\/([a-z_]+)/)[1];
      if (route.request().method() !== 'GET' || !vacias.includes(tabla)) return route.fallback();
      if ((route.request().headers().accept ?? '').includes('vnd.pgrst.object')) {
        return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows', hint: null }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' });
    });
    const consolaVacia = [];
    page.on('console', (m) => m.type() === 'error' && consolaVacia.push(`${page.url().replace(/^.*#/, '#')} ${m.text().slice(0, 160)}`));
    page.on('pageerror', (e) => consolaVacia.push(`pageerror ${e.message.slice(0, 160)}`));
    r.vacia = {};
    for (const ruta of rutas) {
      await page.goto(`/#${ruta}`);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      const texto = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
      r.vacia[ruta] = { texto: texto.slice(0, 220), error: /No se pudo|Error|error|undefined|NaN/.test(texto) };
      await page.screenshot({ path: `${DIR}/vacia${ruta.replace(/[/?=]/g, '_')}.png`, fullPage: true });
    }
    // Registrar animal sin lotes: el formulario lo explica.
    await page.goto('/#/animales?nuevo=1');
    await page.reload();
    r.vacia.registrarSinLotes = await page.getByRole('dialog').innerText().catch(() => 'sin diálogo');
    r.consolaVacia = consolaVacia.filter((x) => !/406|PGRST116/.test(x));
    registrar('recorrido', r);

    for (const [ruta, p] of Object.entries(r.pantallas)) expect.soft(p.scrollWidth, `desborde ${ruta}`).toBeLessThanOrEqual(375);
    expect.soft(r.consola, 'consola').toEqual([]);
    expect.soft(r.red, 'red ≥ 400').toEqual([]);
    for (const [ruta, p] of Object.entries(r.vacia)) if (typeof p === 'object') expect.soft(p.error, `base vacía ${ruta}`).toBe(false);
  });
});
