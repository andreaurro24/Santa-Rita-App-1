-- Correcciones de las verificaciones 007 y 008 (ronda 1).

-- 008 · Alto: un gasto directo sigue siendo del animal aunque este cambie de lote. La regla
-- "el animal es del lote del gasto" solo se valida al crear el gasto o al reasignarlo.
create or replace function private.validar_costo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: el gasto tiene fecha %', new.fecha using errcode = '23514';
  end if;
  if new.animal_id is not null
     and (tg_op = 'INSERT' or new.animal_id is distinct from old.animal_id or new.lote_id is distinct from old.lote_id)
     and not exists (select 1 from public.animales a where a.id = new.animal_id and a.lote_id = new.lote_id) then
    raise exception 'animal_de_otro_lote: el animal no pertenece al lote del gasto' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- 007 · Medio: un animal que sale de la finca de su tenedor deja de estar "Al partir".
create or replace function private.soltar_contrato_al_mover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contrato_id is not null and new.finca_id is distinct from old.finca_id
     and not exists (
       select 1 from public.contratos_al_partir c join public.tenedores t on t.id = c.tenedor_id
       where c.id = new.contrato_id and t.finca_id = new.finca_id
     ) then
    new.contrato_id := null;
  end if;
  return new;
end;
$$;
create trigger animales_soltar_contrato
  before update of finca_id on public.animales
  for each row execute function private.soltar_contrato_al_mover();

-- 007 · Medio: la asignación rechaza fechas anteriores al ingreso y animales de otro contrato.
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
  if exists (select 1 from public.animales a where a.id = any (ids) and a.contrato_id is not null and a.contrato_id <> contrato) then
    raise exception 'animal_en_otro_contrato: un animal ya está Al partir con otro tenedor; sácalo primero de ese contrato' using errcode = '23514';
  end if;
  if exists (select 1 from public.animales a where a.id = any (ids) and fecha < a.fecha_ingreso) then
    raise exception 'fecha_antes_del_ingreso: la asignación no puede ser anterior al ingreso del animal' using errcode = '23514';
  end if;

  insert into public.movimientos (animal_id, fecha, motivo, desde_finca_id, desde_potrero_id, desde_lote_id, hacia_finca_id, hacia_potrero_id, hacia_lote_id)
  select a.id, fecha, trim(motivo), a.finca_id, a.potrero_id, a.lote_id, finca_tenedor, null, a.lote_id
  from public.animales a where a.id = any (ids) and a.estado = 'activo';

  -- finca primero y contrato después en el mismo UPDATE: el trigger ve la finca del tenedor.
  update public.animales a set finca_id = finca_tenedor, potrero_id = null, contrato_id = contrato
  where a.id = any (ids) and a.estado = 'activo';
  get diagnostics asignados = row_count;

  if asignados <> array_length(ids, 1) then
    raise exception 'animales_no_asignables: solo se pueden asignar animales activos (% de %)', asignados, array_length(ids, 1) using errcode = '23514';
  end if;
  return asignados;
end;
$$;

-- 007 · Medio: las reglas de las visitas también valen para escrituras directas.
create or replace function private.validar_visita()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: la visita tiene fecha %', new.fecha using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger visitas_validar
  before insert or update on public.visitas_verificacion
  for each row execute function private.validar_visita();

create or replace function private.validar_visita_animal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.visitas_verificacion v join public.animales a on a.contrato_id = v.contrato_id
    where v.id = new.visita_id and a.id = new.animal_id
  ) then
    raise exception 'animal_fuera_del_contrato: un animal de la visita no pertenece a este contrato' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger visita_animales_validar
  before insert or update on public.visita_animales
  for each row execute function private.validar_visita_animal();
