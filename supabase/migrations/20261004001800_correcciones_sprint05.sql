-- Verificación del Sprint 05, ronda 1 (reports/verificacion/sprint05-2026-10-04.md).

-- M6: un caballo no tiene lote ni pesajes, tampoco por escritura directa en la API.
-- (Los gastos directos ya exigen que el animal esté en el lote del gasto: sin lote, no hay gasto.)
alter table public.animales add constraint animales_equino_sin_lote check (especie = 'bovino' or lote_id is null);

create or replace function private.pesaje_solo_bovinos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.animales a where a.id = new.animal_id and a.especie = 'equino') then
    raise exception 'equino_sin_pesaje: los caballos no se pesan en la app' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger pesajes_solo_bovinos
  before insert or update of animal_id on public.pesajes
  for each row execute function private.pesaje_solo_bovinos();

-- M2, M3 (spec 020 · R1): crear o editar una finca y enlazar su tenedor en una sola transacción.
-- Un tenedor que ya tiene OTRA finca no se reasigna en silencio: se rechaza.
create or replace function public.guardar_finca(
  finca uuid,
  nombre text,
  tipo text,
  municipio text,
  propietario text,
  tenedor uuid,
  tenedor_nuevo text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  id_finca uuid := finca;
  otra record;
begin
  if id_finca is null then
    insert into public.fincas (nombre, tipo, municipio, propietario)
    values (trim(nombre), tipo, nullif(trim(coalesce(municipio, '')), ''), nullif(trim(coalesce(propietario, '')), ''))
    returning id into id_finca;
  else
    update public.fincas f
       set nombre = trim(guardar_finca.nombre), tipo = guardar_finca.tipo,
           municipio = nullif(trim(coalesce(guardar_finca.municipio, '')), ''),
           propietario = nullif(trim(coalesce(guardar_finca.propietario, '')), '')
     where f.id = id_finca;
    if not found then
      raise exception 'finca_inexistente: la finca no existe o no tienes permiso' using errcode = '42501';
    end if;
  end if;

  if tipo = 'tenedor' then
    if nullif(trim(coalesce(tenedor_nuevo, '')), '') is not null then
      insert into public.tenedores (nombre, finca_id) values (trim(tenedor_nuevo), id_finca);
    elsif tenedor is not null then
      select t.nombre, fi.nombre as finca into otra
        from public.tenedores t join public.fincas fi on fi.id = t.finca_id
       where t.id = tenedor and t.finca_id is not null and t.finca_id <> id_finca;
      if found then
        raise exception 'tenedor_con_otra_finca: % ya tiene la finca %; edita esa finca en vez de crear otra', otra.nombre, otra.finca using errcode = '23514';
      end if;
      update public.tenedores t set finca_id = id_finca where t.id = tenedor;
    else
      raise exception 'sin_tenedor: elige el tenedor o crea uno nuevo' using errcode = '23514';
    end if;
  end if;
  return id_finca;
end;
$$;
revoke all on function public.guardar_finca(uuid, text, text, text, text, uuid, text) from public, anon;
grant execute on function public.guardar_finca(uuid, text, text, text, text, uuid, text) to authenticated;
