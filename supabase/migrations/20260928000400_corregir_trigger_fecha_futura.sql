-- Corrige private.rechazar_fecha_futura() tal como se aplicó primero en 0300: el AND no hace
-- cortocircuito en plpgsql y en `pesajes` fallaba al leer new.fecha_aplicada (error 42703).
-- El archivo 0300 ya contiene la versión corregida; esta migración refleja el historial remoto.
create or replace function private.rechazar_fecha_futura()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  hoy date := (now() at time zone 'America/Bogota')::date;
begin
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
