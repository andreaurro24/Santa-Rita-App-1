-- Verificación 002 ronda 1 · residuo de la 001: '-infinity' pasaba el trigger de fecha futura
-- (compara "> hoy") y la app mostraba "Invalid Date". Ninguna fecha del negocio es anterior a
-- 2000, así que se acotan en la base de datos.
alter table public.animales
  add constraint animales_fecha_ingreso_razonable check (fecha_ingreso >= date '2000-01-01'),
  add constraint animales_fecha_nacimiento_razonable check (fecha_nacimiento is null or fecha_nacimiento >= date '2000-01-01');
alter table public.pesajes add constraint pesajes_fecha_razonable check (fecha >= date '2000-01-01');
alter table public.eventos_sanitarios
  add constraint eventos_fecha_aplicada_razonable check (fecha_aplicada is null or fecha_aplicada >= date '2000-01-01'),
  add constraint eventos_fecha_programada_razonable check (fecha_programada is null or fecha_programada between date '2000-01-01' and date '2100-12-31');
alter table public.precios_mercado add constraint precios_fecha_razonable check (fecha >= date '2000-01-01');
alter table public.lotes add constraint lotes_fecha_inicio_razonable check (fecha_inicio is null or fecha_inicio between date '2000-01-01' and date '2100-12-31');
alter table public.contratos_al_partir add constraint contratos_fecha_inicio_razonable check (fecha_inicio is null or fecha_inicio between date '2000-01-01' and date '2100-12-31');
alter table public.jornadas_pesaje add constraint jornadas_fecha_razonable check (fecha >= date '2000-01-01');
alter table public.movimientos add constraint movimientos_fecha_razonable check (fecha >= date '2000-01-01');
