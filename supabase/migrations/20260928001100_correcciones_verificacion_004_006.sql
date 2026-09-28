-- Correcciones de las verificaciones 004 y 006 (ronda 1).

-- 004 · Medio 2: un pesaje de jornada debe ser de una jornada abierta, de un animal de ese lote
-- y con la fecha de la jornada; si no, el promedio de una jornada cerrada podría cambiar después.
create or replace function private.validar_pesaje_jornada()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  j record;
begin
  if new.jornada_id is null then
    return new;
  end if;
  select jp.estado, jp.fecha, jp.lote_id into j from public.jornadas_pesaje jp where jp.id = new.jornada_id;
  if j.estado <> 'abierta' then
    raise exception 'jornada_cerrada: la jornada ya se cerró y no acepta pesajes' using errcode = '23514';
  end if;
  if new.fecha <> j.fecha then
    raise exception 'fecha_distinta_jornada: el pesaje debe tener la fecha de la jornada (%)', j.fecha using errcode = '23514';
  end if;
  if not exists (select 1 from public.animales a where a.id = new.animal_id and a.lote_id = j.lote_id) then
    raise exception 'animal_de_otro_lote: el animal no pertenece al lote de la jornada' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger pesajes_validar_jornada
  before insert or update of jornada_id, fecha, animal_id on public.pesajes
  for each row execute function private.validar_pesaje_jornada();

-- 006 · Medio 3: el potrero de un animal siempre es de su finca, también en un UPDATE directo.
create or replace function private.validar_potrero_animal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.potrero_id is not null and not exists (
    select 1 from public.potreros p where p.id = new.potrero_id and p.finca_id is not distinct from new.finca_id
  ) then
    raise exception 'potrero_de_otra_finca: el potrero no pertenece a la finca del animal' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger animales_potrero_de_su_finca
  before insert or update of potrero_id, finca_id on public.animales
  for each row execute function private.validar_potrero_animal();

-- 006 · Bajo: potreros con el mismo nombre en la misma finca, sin importar mayúsculas.
create unique index potreros_nombre_normalizado_key on public.potreros (finca_id, upper(trim(nombre)));

-- 006 · Medio 3: mover_animales rechaza un lote de destino vendido o cerrado, animales que no
-- estén activos y fechas anteriores al ingreso del animal.
create or replace function public.mover_animales(
  ids uuid[],
  fecha date,
  motivo text,
  finca_destino uuid default null,
  potrero_destino uuid default null,
  lote_destino uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  finca_del_potrero uuid;
  movidos integer;
begin
  if coalesce(array_length(ids, 1), 0) = 0 then
    raise exception 'sin_animales: selecciona al menos un animal' using errcode = '23514';
  end if;
  if fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: el movimiento tiene fecha %', fecha using errcode = '23514';
  end if;
  if finca_destino is null and potrero_destino is null and lote_destino is null then
    raise exception 'sin_destino: indica una finca, un potrero o un lote de destino' using errcode = '23514';
  end if;
  if lote_destino is not null and exists (select 1 from public.lotes l where l.id = lote_destino and l.estado in ('vendido', 'cerrado')) then
    raise exception 'lote_cerrado: el lote de destino ya se vendió o se cerró' using errcode = '23514';
  end if;
  if exists (select 1 from public.animales a where a.id = any (ids) and a.estado <> 'activo') then
    raise exception 'animal_no_activo: solo se pueden mover animales activos' using errcode = '23514';
  end if;
  if exists (select 1 from public.animales a where a.id = any (ids) and fecha < a.fecha_ingreso) then
    raise exception 'fecha_antes_del_ingreso: el movimiento no puede ser anterior al ingreso del animal' using errcode = '23514';
  end if;
  if potrero_destino is not null then
    select p.finca_id into finca_del_potrero from public.potreros p where p.id = potrero_destino;
    if finca_del_potrero is null then
      raise exception 'potrero_inexistente' using errcode = '23503';
    end if;
    if finca_destino is not null and finca_destino <> finca_del_potrero then
      raise exception 'potrero_de_otra_finca: el potrero no pertenece a esa finca' using errcode = '23514';
    end if;
    finca_destino := finca_del_potrero;
  end if;

  insert into public.movimientos (
    animal_id, fecha, motivo,
    desde_finca_id, desde_potrero_id, desde_lote_id,
    hacia_finca_id, hacia_potrero_id, hacia_lote_id
  )
  select a.id, fecha, trim(motivo),
    a.finca_id, a.potrero_id, a.lote_id,
    coalesce(finca_destino, a.finca_id),
    case when potrero_destino is not null then potrero_destino
         when finca_destino is not null and finca_destino is distinct from a.finca_id then null
         else a.potrero_id end,
    coalesce(lote_destino, a.lote_id)
  from public.animales a
  where a.id = any (ids);

  update public.animales a set
    finca_id = coalesce(finca_destino, a.finca_id),
    potrero_id = case when potrero_destino is not null then potrero_destino
                      when finca_destino is not null and finca_destino is distinct from a.finca_id then null
                      else a.potrero_id end,
    lote_id = coalesce(lote_destino, a.lote_id)
  where a.id = any (ids);
  get diagnostics movidos = row_count;

  if movidos <> array_length(ids, 1) then
    raise exception 'animales_no_encontrados: se pidieron % y se encontraron %', array_length(ids, 1), movidos using errcode = '23503';
  end if;
  return movidos;
end;
$$;
