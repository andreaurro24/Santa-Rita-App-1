-- Spec 001 · hallazgos de la verificación ronda 2 (reports/verificacion/001-2026-09-28-ronda2.md).

-- [Medio] Un precio con fecha futura quedaría como "vigente" y taparía los precios reales.
-- [Bajo] Tampoco se aceptan fechas de ingreso o de nacimiento futuras.
-- Se amplía la misma función de fecha futura (hoy = día en Bogotá, D12).
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
  elsif tg_table_name = 'precios_mercado' then
    if new.fecha > hoy then
      raise exception 'fecha_futura: el precio tiene fecha % y hoy es %', new.fecha, hoy using errcode = '23514';
    end if;
  elsif tg_table_name = 'animales' then
    if new.fecha_ingreso > hoy or new.fecha_nacimiento > hoy then
      raise exception 'fecha_futura: el animal tiene fecha de ingreso o nacimiento futura (hoy es %)', hoy using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger precios_sin_fecha_futura
  before insert or update of fecha on public.precios_mercado
  for each row execute function private.rechazar_fecha_futura();

create trigger animales_sin_fecha_futura
  before insert or update of fecha_ingreso, fecha_nacimiento on public.animales
  for each row execute function private.rechazar_fecha_futura();

-- [Bajo] D2: la categoría debe corresponder al sexo. Un "vientre" (que nunca se vende) solo
-- puede ser hembra; novillo, ternero y reproductor son machos.
alter table public.animales add constraint animales_categoria_sexo_check check (
  (sexo = 'Hembra' and categoria in ('ternera', 'vientre'))
  or (sexo = 'Macho' and categoria in ('novillo', 'ternero', 'reproductor'))
);
