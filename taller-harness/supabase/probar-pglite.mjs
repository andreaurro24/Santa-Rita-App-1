// Prueba el SQL del arnés contra un Postgres embebido con tablas mínimas de la app.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const sql = readFileSync(process.argv[2], 'utf8');
const db = new PGlite();
const ok = (m) => console.log('OK  ', m);
const debeFallar = async (m, q, p) => {
  try { await db.query(q, p); console.log('FALLO (no bloqueó)', m); process.exitCode = 1; }
  catch (e) { ok(`${m} → bloqueado: ${e.message.split('\n')[0]}`); }
};

await db.exec(`
  create role anon; create role authenticated;
  create table public.lotes (id uuid primary key default gen_random_uuid(), codigo text unique, nombre text, estado text default 'activo');
  create table public.potreros (id uuid primary key default gen_random_uuid(), nombre text);
  create table public.animales (id uuid primary key default gen_random_uuid(), numero_interno text unique, chapeta_ica text unique,
    lote_id uuid references public.lotes, potrero_id uuid references public.potreros, fecha_ingreso date, estado text default 'activo');
  create table public.pesajes (id uuid primary key default gen_random_uuid(), animal_id uuid references public.animales, fecha date, peso_kg numeric(6,1), notas text);
  create table public.eventos_sanitarios (id uuid primary key default gen_random_uuid(), animal_id uuid references public.animales, tipo text, descripcion text, estado text, fecha_aplicada date);
  insert into public.lotes (codigo, nombre) values ('LOTE-2026-B', 'Lote 2026-B');
  insert into public.potreros (nombre) values ('Los Cocos');
  insert into public.animales (numero_interno, chapeta_ica, lote_id, potrero_id, fecha_ingreso)
    select '030' || g, 'COL-CES-29000' || g, (select id from public.lotes), (select id from public.potreros), '2026-08-12' from generate_series(1, 3) g;
  insert into public.pesajes (animal_id, fecha, peso_kg) select id, '2026-09-28', 190 from public.animales;
`);
await db.exec(sql);
ok('el SQL del arnés se aplica sin errores');

const censo = await db.query('select * from campo.censo_arnes order by numero_interno');
ok(`censo_arnes: ${censo.rows.length} animales, último peso ${censo.rows[0].ultimo_peso_kg}`);
const lotes = await db.query('select * from campo.lotes_arnes');
ok(`lotes_arnes: ${lotes.rows[0].codigo} en ${lotes.rows[0].potrero}`);

await db.exec(`insert into campo.telegram_autorizados values (111, 'Miguel (prueba)', true, true, now()), (222, 'Administrador (prueba)', true, false, now())`);

// Todo lo que sigue corre con el rol del flujo de n8n.
await db.exec('set role arnes_campo');
await debeFallar('el flujo escribe directo en pesajes', `insert into public.pesajes (animal_id, fecha, peso_kg) values (gen_random_uuid(), '2026-10-27', 200)`);
await debeFallar('el flujo lee la tabla animales', 'select * from public.animales');
await debeFallar('el flujo inserta un borrador ya confirmado', `insert into campo.borradores_campo (telegram_chat_id, telegram_user_id, fecha_mensaje, tipo_reporte, extraccion, resultado, estado)
  values (1, 222, '2026-10-28', 'pesaje', '{}', '{"validos":[],"dudosos":[]}', 'confirmado')`);

const resultado = { validos: [{ numero_interno: '0301', fecha: '2026-10-27', peso_kg: 209 }, { numero_interno: '0302', fecha: '2026-10-27', peso_kg: 218 }], dudosos: [{ numero_interno: '0303', peso_kg: 232, motivos: [{ regla: 'V5' }] }], ilegibles: [] };
const { rows: [b] } = await db.query(`insert into campo.borradores_campo (telegram_chat_id, telegram_user_id, fecha_mensaje, tipo_reporte, extraccion, resultado)
  values (1, 222, '2026-10-28', 'pesaje', '{}', $1) returning id`, [JSON.stringify(resultado)]);
ok(`el flujo crea el borrador ${b.id.slice(0, 8)}`);
await debeFallar('el flujo se cambia el estado a confirmado', `update campo.borradores_campo set estado = 'confirmado' where id = $1`, [b.id]);
await debeFallar('cargar sin confirmar', 'select campo.cargar_borrador($1)', [b.id]);
await debeFallar('confirma alguien sin permiso (el administrador)', 'select campo.confirmar_y_cargar($1, 222)', [b.id]);
await debeFallar('Miguel confirma con un dudoso pendiente', 'select campo.confirmar_y_cargar($1, 111)', [b.id]);
const { rows: [c] } = await db.query('select campo.confirmar_y_cargar($1, 111, true) as n', [b.id]);
ok(`Miguel confirma sin los dudosos: se cargan ${c.n} pesajes`);
await debeFallar('cargar dos veces', 'select campo.cargar_borrador($1)', [b.id]);
const { rows: [propio] } = await db.query(`insert into campo.borradores_campo (telegram_chat_id, telegram_user_id, fecha_mensaje, tipo_reporte, extraccion, resultado)
  values (1, 111, '2026-10-28', 'sanidad', '{}', '{"validos":[],"dudosos":[]}') returning id`);
await debeFallar('Miguel confirma un reporte que él mismo envió', 'select campo.confirmar_y_cargar($1, 111)', [propio.id]);

await db.exec('reset role');
const pes = await db.query(`select count(*)::int n from public.pesajes where fecha = '2026-10-27'`);
const bit = await db.query('select tipo from campo.bitacora_jornadas order by id');
ok(`pesajes nuevos en la app: ${pes.rows[0].n}; bitácora: ${bit.rows.map((r) => r.tipo).join(', ')}`);
