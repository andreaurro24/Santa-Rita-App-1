-- Verificación D8 acumulado ronda 2 · [Medio] DT-04-12: la tabla ventas aceptaba una fecha futura
-- si se insertaba directo por la API (solo registrar_venta la validaba). La regla va en la tabla,
-- como en pesajes, costos y visitas (hoy = día en Bogotá, D12). Aprobada por el humano el 2026-09-28.
create or replace function private.venta_fecha_no_futura()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: la venta tiene fecha %', new.fecha using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger ventas_sin_fecha_futura
  before insert or update of fecha on public.ventas
  for each row execute function private.venta_fecha_no_futura();
