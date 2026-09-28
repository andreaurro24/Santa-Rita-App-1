// Spec 001 · R9: recarga los datos de ejemplo (140 reses, 4 lotes, precios) en el proyecto
// Supabase de DESARROLLO. Nunca corre contra otro proyecto.
//
//   npm run db:seed          borra y vuelve a insertar entrando como el usuario de prueba
//   npm run db:seed -- --sql escribe supabase/seed.sql para pegarlo en el SQL Editor
//
// No usa la llave service_role: entra con la llave pública (.env.local) y el usuario de prueba
// (.env.test, perfil rol 'dueno'), así que respeta RLS igual que la app.

import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import seedAnimals from '../src/data/seedAnimals.json' with { type: 'json' };
import { PRECIO_KILO_EN_PIE_HISTORICO } from '../src/data/seedMercado.js';

const PROYECTO_DEV = 'eiszvbwwpqcqognkcfew';

// Orden de borrado (hijos primero); el de inserción es el inverso. Incluye las tablas que la
// semilla no llena (jornadas, movimientos, costos…): hay que vaciarlas porque apuntan a lotes,
// fincas y animales, y sin eso la recarga falla por las llaves foráneas.
const TABLAS = [
  'condicion_pasto',
  'visita_animales',
  'visitas_verificacion',
  'costos',
  'movimientos',
  'pesajes',
  'jornadas_pesaje',
  'eventos_sanitarios',
  'animales',
  'contratos_al_partir',
  'tenedores',
  'lotes',
  'potreros',
  'fincas',
  'precios_mercado',
];

// UUID determinístico (formato v5) para que las filas se enlacen sin consultar ids.
function uuid(clave) {
  const h = createHash('sha1').update(`santa-rita:${clave}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function construirFilas(animales = seedAnimals, precios = PRECIO_KILO_EN_PIE_HISTORICO) {
  const santaRita = { id: uuid('finca:santa-rita'), nombre: 'Finca Santa Rita', tipo: 'propia', municipio: 'Badillo, Cesar' };
  const fincas = [santaRita];
  const tenedores = [];
  const contratos = [];
  const contratoPorTenedor = new Map();

  for (const a of animales.filter((x) => x.esquema === 'Al partir')) {
    if (contratoPorTenedor.has(a.tenedor)) continue;
    const [persona, nombreFinca] = a.tenedor.split(' – ');
    const finca = { id: uuid(`finca:${nombreFinca}`), nombre: nombreFinca, tipo: 'tenedor', municipio: 'Cesar' };
    const tenedor = { id: uuid(`tenedor:${persona}`), nombre: persona, telefono: null, finca_id: finca.id };
    const suyos = animales.filter((x) => x.tenedor === a.tenedor);
    const contrato = {
      id: uuid(`contrato:${persona}`),
      tenedor_id: tenedor.id,
      fecha_inicio: suyos.map((x) => x.fechaIngreso).sort()[0],
      precio_animal_cop: null,
      precio_kg_cop: null,
      porcentaje_ganancia: a.porcentajeTenedor,
      estado: 'vigente',
    };
    fincas.push(finca);
    tenedores.push(tenedor);
    contratos.push(contrato);
    contratoPorTenedor.set(a.tenedor, { contrato, finca });
  }

  const lotes = [];
  for (const codigo of [...new Set(animales.map((a) => a.lote))]) {
    const suyos = animales.filter((a) => a.lote === codigo);
    const promedioMeta = suyos.reduce((s, a) => s + a.pesoObjetivo, 0) / suyos.length;
    lotes.push({
      id: uuid(`lote:${codigo}`),
      codigo,
      nombre: suyos[0].loteNombre,
      tipo: codigo.startsWith('CRIA') ? 'cria' : 'ceba',
      fecha_inicio: suyos.map((a) => a.fechaIngreso).sort()[0],
      peso_meta_kg: Math.round(promedioMeta),
      estado: 'activo',
    });
  }

  const filasAnimales = [];
  const pesajes = [];
  const eventos = [];
  for (const a of animales) {
    const id = uuid(`animal:${a.numeroInterno}`);
    const partir = a.esquema === 'Al partir' ? contratoPorTenedor.get(a.tenedor) : null;
    const nacio = a.origen === 'Nacimiento';
    filasAnimales.push({
      id,
      numero_interno: a.numeroInterno,
      chapeta_ica: a.chapetaICA,
      marca_finca: a.marcaFinca,
      sexo: a.sexo,
      categoria: nacio ? (a.sexo === 'Hembra' ? 'ternera' : 'ternero') : 'novillo',
      origen: nacio ? 'nacimiento' : 'compra',
      fecha_ingreso: a.fechaIngreso,
      fecha_nacimiento: nacio ? a.fechaIngreso : null,
      peso_ingreso_kg: a.pesoIngreso,
      peso_objetivo_kg: a.pesoObjetivo,
      costo_compra_cop: a.costoCompra,
      lote_id: uuid(`lote:${a.lote}`),
      finca_id: partir ? partir.finca.id : santaRita.id,
      potrero_id: null,
      contrato_id: partir ? partir.contrato.id : null,
      estado: a.estado.toLowerCase(),
    });
    // created_at explícito y creciente: si hay dos pesajes el mismo día, vale el último de la lista.
    a.pesos.forEach((p, i) =>
      pesajes.push({
        id: uuid(`pesaje:${a.numeroInterno}:${i}`),
        animal_id: id,
        fecha: p.fecha,
        peso_kg: p.pesoKg,
        notas: null,
        created_at: `${p.fecha}T12:00:${String(i).padStart(2, '0')}Z`,
      }),
    );
    a.sanidad.forEach((s, i) =>
      eventos.push({
        id: uuid(`sanidad:${a.numeroInterno}:${i}`),
        animal_id: id,
        tipo: s.tipo === 'Vacuna' ? 'vacuna' : s.descripcion.startsWith('Desparasitación') ? 'desparasitacion' : 'tratamiento',
        descripcion: s.descripcion,
        estado: s.pendiente ? 'programado' : 'aplicado',
        fecha_aplicada: s.pendiente ? null : s.fecha,
        fecha_programada: s.pendiente ? s.proximaFecha : null,
      }),
    );
  }

  const filasPrecios = precios.map((p) => ({
    id: uuid(`precio:${p.fecha}`),
    fecha: p.fecha,
    precio_kg_cop: p.precioCOP,
    fuente: p.fuente,
  }));

  return {
    fincas,
    precios_mercado: filasPrecios,
    potreros: [],
    lotes,
    tenedores,
    contratos_al_partir: contratos,
    animales: filasAnimales,
    eventos_sanitarios: eventos,
    pesajes,
  };
}

function sqlValor(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replaceAll("'", "''")}'`;
}

function aSQL(filas) {
  const partes = ['-- Generado por scripts/seed-supabase.mjs --sql. No editar a mano.', 'begin;'];
  for (const t of TABLAS) partes.push(`delete from public.${t};`);
  for (const t of [...TABLAS].reverse()) {
    const rows = filas[t] ?? [];
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    partes.push(
      `insert into public.${t} (${cols.join(', ')}) values\n` +
        rows.map((r) => `  (${cols.map((c) => sqlValor(r[c])).join(', ')})`).join(',\n') +
        ';',
    );
  }
  partes.push('commit;');
  return partes.join('\n\n') + '\n';
}

async function aplicar(filas) {
  for (const f of ['.env.local', '.env.test']) if (existsSync(f)) process.loadEnvFile(f);
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key, TEST_USER_EMAIL: email, TEST_USER_PASSWORD: password } = process.env;
  if (!url || !key || !email || !password) {
    throw new Error(
      'Faltan variables: VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local, ' +
        'TEST_USER_EMAIL y TEST_USER_PASSWORD en .env.test (ver .env.example). ' +
        'Alternativa: `npm run db:seed -- --sql` y pegar supabase/seed.sql en el SQL Editor.',
    );
  }
  if (new URL(url).hostname !== `${PROYECTO_DEV}.supabase.co`) {
    throw new Error(`Por seguridad este script solo corre contra el proyecto de desarrollo (${PROYECTO_DEV}). URL recibida: ${url}`);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(`No se pudo entrar como ${email}: ${authError.message}`);
  for (const t of TABLAS) {
    const { error } = await supabase.from(t).delete().not('id', 'is', null);
    if (error) throw new Error(`Borrando ${t}: ${error.message}`);
  }
  for (const t of [...TABLAS].reverse()) {
    const rows = filas[t] ?? [];
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(t).insert(rows.slice(i, i + 500));
      if (error) throw new Error(`Insertando ${t}: ${error.message}`);
    }
  }
}

const filas = construirFilas();
const resumen = Object.entries(filas).map(([t, r]) => `${t}=${r.length}`).join(' ');

if (process.argv.includes('--sql')) {
  writeFileSync('supabase/seed.sql', aSQL(filas));
  console.log(`supabase/seed.sql generado (${resumen}).`);
} else {
  aplicar(filas)
    .then(() => console.log(`Datos de ejemplo cargados en ${PROYECTO_DEV}: ${resumen}`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
