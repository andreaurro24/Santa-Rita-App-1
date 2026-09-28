-- Correcciones de fechas pendientes (verificaciones 008 r2, 007 r2 y residuos de 004/006).

-- 008 · Medio: un movimiento no puede ser anterior al último movimiento del animal; si no, el
-- historial de lotes (y el reparto de costos) queda en contra del lote real.
create or replace function private.validar_orden_movimiento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ultimo date;
begin
  select max(m.fecha) into ultimo from public.movimientos m where m.animal_id = new.animal_id;
  if ultimo is not null and new.fecha < ultimo then
    raise exception 'fecha_antes_del_ultimo_movimiento: el animal ya tiene un movimiento del % y este sería anterior', ultimo using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger movimientos_en_orden
  before insert on public.movimientos
  for each row execute function private.validar_orden_movimiento();

-- 007 · Medio: ni asignaciones ni visitas antes del inicio del contrato; la fecha de inicio de
-- un contrato o de un lote no puede ser futura (también residuo de 004/006).
create or replace function private.fecha_inicio_no_futura()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fecha_inicio > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: la fecha de inicio % es futura', new.fecha_inicio using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger contratos_inicio_no_futuro
  before insert or update of fecha_inicio on public.contratos_al_partir
  for each row execute function private.fecha_inicio_no_futura();
create trigger lotes_inicio_no_futuro
  before insert or update of fecha_inicio on public.lotes
  for each row execute function private.fecha_inicio_no_futura();

create or replace function private.validar_visita()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  inicio date;
begin
  if new.fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: la visita tiene fecha %', new.fecha using errcode = '23514';
  end if;
  select c.fecha_inicio into inicio from public.contratos_al_partir c where c.id = new.contrato_id;
  if inicio is not null and new.fecha < inicio then
    raise exception 'fecha_antes_del_contrato: la visita es anterior al inicio del contrato (%)', inicio using errcode = '23514';
  end if;
  return new;
end;
$$;

-- La asignación tampoco puede ser anterior al inicio del contrato.
create or replace function public.asignar_a_contrato(ids uuid[], contrato uuid, fecha date, motivo text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  finca_tenedor uuid;
  estado_contrato text;
  inicio_contrato date;
  asignados integer;
begin
  select t.finca_id, c.estado, c.fecha_inicio into finca_tenedor, estado_contrato, inicio_contrato
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
  if inicio_contrato is not null and fecha < inicio_contrato then
    raise exception 'fecha_antes_del_contrato: la asignación es anterior al inicio del contrato (%)', inicio_contrato using errcode = '23514';
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
