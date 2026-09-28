-- Spec 001 · correcciones de la verificación ronda 1 (reports/verificacion/001-2026-09-27.md).

-- [Medio] R5/D6: la chapeta y el número interno no se pueden repetir aunque cambien las
-- mayúsculas o los espacios ("col-ces-265093" = "COL-CES-265093").
create unique index animales_chapeta_ica_normalizada_key on public.animales (upper(trim(chapeta_ica)));
create unique index animales_numero_interno_normalizado_key on public.animales (upper(trim(numero_interno)));

-- [Medio] R5: la base de datos no acepta fechas futuras en pesajes ni en eventos aplicados.
-- Se compara con el día de hoy en Bogotá (D12), no en UTC.
create or replace function private.rechazar_fecha_futura()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  hoy date := (now() at time zone 'America/Bogota')::date;
begin
  -- IFs anidados: plpgsql no garantiza cortocircuito en AND, y cada tabla tiene su columna.
  if tg_table_name = 'pesajes' then
    if new.fecha > hoy then
      raise exception 'fecha_futura: el pesaje tiene fecha % y hoy es %', new.fecha, hoy using errcode = '23514';
    end if;
  elsif tg_table_name = 'eventos_sanitarios' then
    if new.fecha_aplicada > hoy then
      raise exception 'fecha_futura: el evento aplicado tiene fecha % y hoy es %', new.fecha_aplicada, hoy using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger pesajes_sin_fecha_futura
  before insert or update of fecha on public.pesajes
  for each row execute function private.rechazar_fecha_futura();

create trigger eventos_sin_fecha_futura
  before insert or update of fecha_aplicada on public.eventos_sanitarios
  for each row execute function private.rechazar_fecha_futura();

-- [Medio] Registrar un animal y su pesaje de ingreso en una sola transacción: o se crean los
-- dos o ninguno. SECURITY INVOKER: corre con los permisos del usuario, así que RLS aplica.
create or replace function public.registrar_animal(datos jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nuevo_id uuid;
begin
  insert into public.animales (
    numero_interno, chapeta_ica, sexo, categoria, origen, fecha_ingreso, fecha_nacimiento,
    peso_ingreso_kg, peso_objetivo_kg, costo_compra_cop, lote_id, finca_id, contrato_id
  ) values (
    trim(datos ->> 'numero_interno'),
    upper(trim(datos ->> 'chapeta_ica')),
    datos ->> 'sexo',
    coalesce(datos ->> 'categoria', 'novillo'),
    coalesce(datos ->> 'origen', 'compra'),
    (datos ->> 'fecha_ingreso')::date,
    (datos ->> 'fecha_nacimiento')::date,
    (datos ->> 'peso_ingreso_kg')::numeric,
    (datos ->> 'peso_objetivo_kg')::numeric,
    (datos ->> 'costo_compra_cop')::bigint,
    (datos ->> 'lote_id')::uuid,
    (datos ->> 'finca_id')::uuid,
    (datos ->> 'contrato_id')::uuid
  )
  returning id into nuevo_id;

  insert into public.pesajes (animal_id, fecha, peso_kg)
  values (nuevo_id, (datos ->> 'fecha_ingreso')::date, (datos ->> 'peso_ingreso_kg')::numeric);

  return nuevo_id;
end;
$$;

revoke all on function public.registrar_animal(jsonb) from public, anon;
grant execute on function public.registrar_animal(jsonb) to authenticated;
