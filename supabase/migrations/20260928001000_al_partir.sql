-- Spec 007 · "Al partir" (D8): visitas de verificación y asignación de animales a contratos.

create table public.visitas_verificacion (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos_al_partir (id) on delete restrict,
  fecha date not null check (fecha >= date '2000-01-01'),
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index visitas_contrato_idx on public.visitas_verificacion (contrato_id, fecha desc);

create table public.visita_animales (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid not null references public.visitas_verificacion (id) on delete cascade,
  animal_id uuid not null references public.animales (id) on delete cascade,
  encontrado boolean not null,
  pesaje_id uuid references public.pesajes (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (visita_id, animal_id)
);
create index visita_animales_animal_idx on public.visita_animales (animal_id);
create index visita_animales_pesaje_idx on public.visita_animales (pesaje_id);

do $$
declare
  t text;
begin
  foreach t in array array['visitas_verificacion', 'visita_animales']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "%s: miembros leen" on public.%I for select to authenticated using ((select private.es_miembro()))', t, t);
    execute format('create policy "%s: miembros crean" on public.%I for insert to authenticated with check ((select private.es_miembro()))', t, t);
    execute format('create policy "%s: miembros editan" on public.%I for update to authenticated using ((select private.es_miembro())) with check ((select private.es_miembro()))', t, t);
    execute format('create policy "%s: dueño borra" on public.%I for delete to authenticated using ((select private.es_dueno()))', t, t);
  end loop;
end
$$;

-- R7: un animal no puede quedar ligado a un contrato terminado.
create or replace function private.validar_contrato_animal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contrato_id is not null
     and (tg_op = 'INSERT' or new.contrato_id is distinct from old.contrato_id)
     and exists (select 1 from public.contratos_al_partir c where c.id = new.contrato_id and c.estado <> 'vigente') then
    raise exception 'contrato_terminado: el contrato ya terminó y no acepta animales' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger animales_contrato_vigente
  before insert or update of contrato_id on public.animales
  for each row execute function private.validar_contrato_animal();

-- R3: asigna animales a un contrato vigente. Pasan a la finca del tenedor (sin potrero) y queda
-- un movimiento por animal. Atómica y con los permisos del usuario (RLS).
create or replace function public.asignar_a_contrato(ids uuid[], contrato uuid, fecha date, motivo text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  finca_tenedor uuid;
  estado_contrato text;
  asignados integer;
begin
  select t.finca_id, c.estado into finca_tenedor, estado_contrato
  from public.contratos_al_partir c join public.tenedores t on t.id = c.tenedor_id
  where c.id = contrato;
  if estado_contrato is null then
    raise exception 'contrato_inexistente' using errcode = '23503';
  end if;
  if estado_contrato <> 'vigente' then
    raise exception 'contrato_terminado: el contrato ya terminó y no acepta animales' using errcode = '23514';
  end if;
  if finca_tenedor is null then
    raise exception 'tenedor_sin_finca: registra la finca del tenedor antes de asignarle animales' using errcode = '23514';
  end if;
  if coalesce(array_length(ids, 1), 0) = 0 then
    raise exception 'sin_animales: selecciona al menos un animal' using errcode = '23514';
  end if;
  if fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: la asignación tiene fecha %', fecha using errcode = '23514';
  end if;
  if length(trim(coalesce(motivo, ''))) = 0 then
    raise exception 'sin_motivo: escribe el motivo de la asignación' using errcode = '23514';
  end if;

  insert into public.movimientos (animal_id, fecha, motivo, desde_finca_id, desde_potrero_id, desde_lote_id, hacia_finca_id, hacia_potrero_id, hacia_lote_id)
  select a.id, fecha, trim(motivo), a.finca_id, a.potrero_id, a.lote_id, finca_tenedor, null, a.lote_id
  from public.animales a where a.id = any (ids) and a.estado = 'activo';

  update public.animales a set contrato_id = contrato, finca_id = finca_tenedor, potrero_id = null
  where a.id = any (ids) and a.estado = 'activo';
  get diagnostics asignados = row_count;

  if asignados <> array_length(ids, 1) then
    raise exception 'animales_no_asignables: solo se pueden asignar animales activos (% de %)', asignados, array_length(ids, 1) using errcode = '23514';
  end if;
  return asignados;
end;
$$;

-- R5, R6: registra la visita con un peso por animal revisado o "no encontrado". Atómica.
-- revisiones: [{ "animal_id": uuid, "peso_kg": number | null }]; null = no encontrado.
create or replace function public.registrar_visita(contrato uuid, fecha date, notas text, revisiones jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nueva uuid;
  r jsonb;
  animal uuid;
  peso numeric;
  pesaje uuid;
begin
  if jsonb_array_length(coalesce(revisiones, '[]'::jsonb)) = 0 then
    raise exception 'sin_revisiones: la visita debe incluir al menos un animal' using errcode = '23514';
  end if;
  if fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: la visita tiene fecha %', fecha using errcode = '23514';
  end if;

  insert into public.visitas_verificacion (contrato_id, fecha, notas)
  values (contrato, fecha, nullif(trim(coalesce(notas, '')), ''))
  returning id into nueva;

  for r in select * from jsonb_array_elements(revisiones)
  loop
    animal := (r ->> 'animal_id')::uuid;
    if not exists (select 1 from public.animales a where a.id = animal and a.contrato_id = contrato) then
      raise exception 'animal_fuera_del_contrato: un animal de la visita no pertenece a este contrato' using errcode = '23514';
    end if;
    peso := (r ->> 'peso_kg')::numeric;
    pesaje := null;
    if peso is not null then
      insert into public.pesajes (animal_id, fecha, peso_kg, notas)
      values (animal, fecha, peso, 'Visita de verificación Al partir')
      returning id into pesaje;
    end if;
    insert into public.visita_animales (visita_id, animal_id, encontrado, pesaje_id)
    values (nueva, animal, peso is not null, pesaje);
  end loop;
  return nueva;
end;
$$;

revoke all on function public.asignar_a_contrato(uuid[], uuid, date, text) from public, anon;
revoke all on function public.registrar_visita(uuid, date, text, jsonb) from public, anon;
grant execute on function public.asignar_a_contrato(uuid[], uuid, date, text) to authenticated;
grant execute on function public.registrar_visita(uuid, date, text, jsonb) to authenticated;
