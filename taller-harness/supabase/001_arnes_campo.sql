-- Taller Harness · Capítulos 3 (memoria) y 5 (guardarraíles) en la base de datos.
-- Aplicar SOLO en el proyecto de desarrollo de Supabase (nunca en producción sin aprobarlo).
-- No vive en supabase/migrations a propósito: no es parte de la app, es la pieza del taller.
--
-- Idea: el flujo de n8n se conecta con un rol propio, `arnes_campo`, que
--   · puede LEER el censo (una vista con lo mínimo),
--   · puede ESCRIBIR solo borradores y bitácora,
--   · NO tiene permiso sobre public.pesajes ni public.eventos_sanitarios.
-- La única puerta hacia esas tablas es campo.cargar_borrador(), y solo abre si una persona
-- autorizada confirmó el borrador con campo.confirmar_borrador(). El bloqueo vive en los
-- permisos de Postgres, no en el prompt del modelo.

create schema if not exists campo;
revoke all on schema campo from public, anon, authenticated;

-- Rol del flujo. La clave la pone el equipo en el panel (SQL editor) y en las credenciales
-- de n8n; nunca en este archivo:  alter role arnes_campo with password '...';
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'arnes_campo') then
    create role arnes_campo login noinherit;
  end if;
end $$;
grant usage on schema campo to arnes_campo;

-- Quién puede mandar reportes y quién puede confirmar (ids de usuario de Telegram).
-- Solo el dueño lo edita desde el panel; el flujo solo lo lee.
create table campo.telegram_autorizados (
  telegram_user_id bigint primary key,
  nombre text not null check (length(trim(nombre)) > 0),
  puede_enviar boolean not null default true,
  puede_confirmar boolean not null default false,
  created_at timestamptz not null default now()
);

-- Capítulo 3: un borrador por mensaje, con su estado.
create table campo.borradores_campo (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint not null,
  telegram_user_id bigint not null,
  telegram_message_id bigint,
  fecha_mensaje date not null,
  tipo_reporte text not null check (tipo_reporte in ('pesaje', 'sanidad', 'otro')),
  extraccion jsonb not null,               -- salida del extractor (IA)
  resultado jsonb not null,                -- salida del validador: validos, dudosos, ilegibles
  revision jsonb,                          -- preguntas del revisor (IA)
  intentos smallint not null default 1 check (intentos between 1 and 3),
  estado text not null default 'borrador'
    check (estado in ('borrador', 'confirmado', 'rechazado', 'cargado')),
  confirmado_por bigint references campo.telegram_autorizados (telegram_user_id),
  confirmado_en timestamptz,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(resultado -> 'validos') = 'array' and jsonb_typeof(resultado -> 'dudosos') = 'array')
);
create index borradores_campo_estado_idx on campo.borradores_campo (estado, created_at desc);

-- Capítulo 3 y 7: bitácora de todo lo que pasa (mensajes ignorados, reintentos, correcciones).
create table campo.bitacora_jornadas (
  id bigint generated always as identity primary key,
  momento timestamptz not null default now(),
  tipo text not null check (length(trim(tipo)) > 0),
  borrador_id uuid references campo.borradores_campo (id) on delete set null,
  telegram_user_id bigint,
  detalle jsonb not null default '{}'::jsonb
);
create index bitacora_jornadas_borrador_idx on campo.bitacora_jornadas (borrador_id);

-- Contexto mínimo para el validador: animales activos con su último peso.
create view campo.censo_arnes as
select a.numero_interno, a.chapeta_ica, l.codigo as lote, a.fecha_ingreso, a.estado,
       ult.fecha as fecha_ultimo_peso, ult.peso_kg as ultimo_peso_kg
from public.animales a
join public.lotes l on l.id = a.lote_id
left join lateral (
  select p.fecha, p.peso_kg from public.pesajes p
  where p.animal_id = a.id order by p.fecha desc limit 1
) ult on true
where a.estado = 'activo';

-- Lotes con el potrero donde está la mayoría de sus animales (para "los de El Mango").
create view campo.lotes_arnes as
select l.codigo, l.nombre,
  (select p.nombre from public.animales a join public.potreros p on p.id = a.potrero_id
   where a.lote_id = l.id and a.estado = 'activo'
   group by p.nombre order by count(*) desc limit 1) as potrero
from public.lotes l
where l.estado = 'activo';

-- RLS: el rol del flujo ve y escribe solo lo suyo.
alter table campo.telegram_autorizados enable row level security;
alter table campo.borradores_campo enable row level security;
alter table campo.bitacora_jornadas enable row level security;
create policy autorizados_lectura on campo.telegram_autorizados for select to arnes_campo using (true);
create policy borradores_lectura on campo.borradores_campo for select to arnes_campo using (true);
create policy borradores_insercion on campo.borradores_campo for insert to arnes_campo
  with check (estado = 'borrador' and confirmado_por is null);
create policy borradores_revision on campo.borradores_campo for update to arnes_campo
  using (estado = 'borrador') with check (estado = 'borrador');
create policy bitacora_insercion on campo.bitacora_jornadas for insert to arnes_campo with check (true);
create policy bitacora_lectura on campo.bitacora_jornadas for select to arnes_campo using (true);

grant select on campo.telegram_autorizados, campo.censo_arnes, campo.lotes_arnes to arnes_campo;
grant select, insert on campo.borradores_campo to arnes_campo;
-- Solo puede cambiar la revisión y el número de intentos; el estado lo cambian las funciones.
grant update (revision, intentos) on campo.borradores_campo to arnes_campo;
grant select, insert on campo.bitacora_jornadas to arnes_campo;
-- Guardarraíl: ningún permiso directo sobre las tablas de la app.
revoke all on public.pesajes, public.eventos_sanitarios, public.animales from arnes_campo;

-- Paso 4 (humano): confirmar. Solo un usuario de Telegram con puede_confirmar.
-- p_descartar: números internos dudosos que la persona decide no cargar.
create or replace function campo.confirmar_borrador(p_id uuid, p_telegram_user_id bigint, p_descartar text[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b campo.borradores_campo;
  pendientes int;
begin
  if not exists (select 1 from campo.telegram_autorizados t where t.telegram_user_id = p_telegram_user_id and t.puede_confirmar) then
    insert into campo.bitacora_jornadas (tipo, borrador_id, telegram_user_id, detalle)
      values ('confirmacion_rechazada', p_id, p_telegram_user_id, '{"motivo":"usuario no autorizado"}');
    raise exception 'El usuario % no puede confirmar borradores', p_telegram_user_id;
  end if;
  select * into b from campo.borradores_campo where id = p_id for update;
  if b.id is null or b.estado <> 'borrador' then
    raise exception 'Solo se confirma un borrador (estado actual: %)', coalesce(b.estado, 'no existe');
  end if;
  -- Segregación de funciones: quien envió el reporte no lo confirma.
  if b.telegram_user_id = p_telegram_user_id then
    raise exception 'Quien envió el reporte no puede confirmarlo; lo confirma otra persona autorizada';
  end if;
  select count(*) into pendientes
    from jsonb_array_elements(b.resultado -> 'dudosos') d
    where not (d ->> 'numero_interno' = any (p_descartar));
  if pendientes > 0 then
    raise exception 'Quedan % dudosos sin resolver: corrígelos con un mensaje nuevo o descártalos', pendientes;
  end if;
  update campo.borradores_campo
    set estado = 'confirmado', confirmado_por = p_telegram_user_id, confirmado_en = now()
    where id = p_id;
  insert into campo.bitacora_jornadas (tipo, borrador_id, telegram_user_id, detalle)
    values ('borrador_confirmado', p_id, p_telegram_user_id, jsonb_build_object('descartados', p_descartar));
end;
$$;

create or replace function campo.rechazar_borrador(p_id uuid, p_telegram_user_id bigint, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from campo.telegram_autorizados t where t.telegram_user_id = p_telegram_user_id and t.puede_confirmar) then
    raise exception 'El usuario % no puede rechazar borradores', p_telegram_user_id;
  end if;
  update campo.borradores_campo set estado = 'rechazado' where id = p_id and estado = 'borrador';
  insert into campo.bitacora_jornadas (tipo, borrador_id, telegram_user_id, detalle)
    values ('borrador_rechazado', p_id, p_telegram_user_id, jsonb_build_object('motivo', p_motivo));
end;
$$;

-- Paso 5 (fijo): cargar. La única puerta hacia pesajes y eventos_sanitarios.
-- Los disparadores de la app vuelven a revisar fechas (RN-14) al insertar.
create or replace function campo.cargar_borrador(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  b campo.borradores_campo;
  v jsonb;
  animal uuid;
  n int := 0;
begin
  select * into b from campo.borradores_campo where id = p_id for update;
  if b.id is null or b.estado <> 'confirmado' or b.confirmado_por is null then
    insert into campo.bitacora_jornadas (tipo, borrador_id, detalle)
      values ('carga_bloqueada', p_id, jsonb_build_object('estado', b.estado));
    raise exception 'Bloqueado: solo se carga un borrador confirmado por una persona autorizada';
  end if;
  for v in select * from jsonb_array_elements(b.resultado -> 'validos') loop
    select a.id into animal from public.animales a where a.numero_interno = v ->> 'numero_interno' and a.estado = 'activo';
    if animal is null then
      raise exception 'La % no está activa en el censo', v ->> 'numero_interno';
    end if;
    if b.tipo_reporte = 'pesaje' then
      if exists (select 1 from public.pesajes p where p.animal_id = animal and p.fecha = (v ->> 'fecha')::date) then
        raise exception 'La % ya tiene pesaje el %', v ->> 'numero_interno', v ->> 'fecha';
      end if;
      insert into public.pesajes (animal_id, fecha, peso_kg, notas)
        values (animal, (v ->> 'fecha')::date, (v ->> 'peso_kg')::numeric, 'Telegram (arnés) borrador ' || p_id);
    else
      insert into public.eventos_sanitarios (animal_id, tipo, descripcion, estado, fecha_aplicada)
        values (animal, v -> 'evento_sanitario' ->> 'tipo', v -> 'evento_sanitario' ->> 'descripcion', 'aplicado', (v ->> 'fecha')::date);
    end if;
    n := n + 1;
  end loop;
  update campo.borradores_campo set estado = 'cargado' where id = p_id;
  insert into campo.bitacora_jornadas (tipo, borrador_id, detalle) values ('borrador_cargado', p_id, jsonb_build_object('registros', n));
  return n;
end;
$$;

-- Lo que llama el botón de Telegram: confirma y carga en una sola transacción.
-- p_descartar_dudosos = true cuando la persona pulsa "Confirmar sin los dudosos".
create or replace function campo.confirmar_y_cargar(p_id uuid, p_telegram_user_id bigint, p_descartar_dudosos boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  descartar text[] := '{}';
begin
  if p_descartar_dudosos then
    select coalesce(array_agg(d ->> 'numero_interno'), '{}') into descartar
      from campo.borradores_campo b, jsonb_array_elements(b.resultado -> 'dudosos') d
      where b.id = p_id;
  end if;
  perform campo.confirmar_borrador(p_id, p_telegram_user_id, descartar);
  return campo.cargar_borrador(p_id);
end;
$$;

revoke all on function campo.confirmar_y_cargar(uuid, bigint, boolean) from public, anon, authenticated;
grant execute on function campo.confirmar_y_cargar(uuid, bigint, boolean) to arnes_campo;
revoke all on function campo.confirmar_borrador(uuid, bigint, text[]) from public, anon, authenticated;
revoke all on function campo.rechazar_borrador(uuid, bigint, text) from public, anon, authenticated;
revoke all on function campo.cargar_borrador(uuid) from public, anon, authenticated;
grant execute on function campo.confirmar_borrador(uuid, bigint, text[]) to arnes_campo;
grant execute on function campo.rechazar_borrador(uuid, bigint, text) to arnes_campo;
grant execute on function campo.cargar_borrador(uuid) to arnes_campo;
