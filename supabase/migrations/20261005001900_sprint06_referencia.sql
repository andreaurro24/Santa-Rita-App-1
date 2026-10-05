-- Sprint 06 · migración 1900.
-- Parte A (spec 023): raza, nacimiento por mes y año, registro con fecha de ingreso pasada y peso actual.
-- Parte B (spec 025): una venta puede llevar animales de varios lotes y guarda comisiones y transporte.
-- Producción no tiene animales ni ventas al aplicarla (revisado el 2026-10-05).

-- ───────────── Parte A ─────────────

-- 023 · R2/R8: raza opcional, con la misma validación de nombres de la spec 018.
alter table public.animales
  add column raza text,
  add column nacimiento_mes_conocido boolean;

alter table public.animales
  add constraint animales_raza_valida check (raza is null or private.texto_valido(raza, 40)),
  -- 023 · R3: fecha_nacimiento guarda el día 1 del mes (o el 1 de enero si no se sabe el mes).
  add constraint animales_nacimiento_coherente check (
    (fecha_nacimiento is null and nacimiento_mes_conocido is null)
    or (fecha_nacimiento is not null and nacimiento_mes_conocido is not null
        and extract(day from fecha_nacimiento) = 1
        and (nacimiento_mes_conocido or extract(month from fecha_nacimiento) = 1))
  );

-- 023 · R4/R5/R8: registrar con fecha de ingreso (puede ser pasada) y peso actual opcional.
-- Si el peso actual es distinto del inicial y el ingreso fue antes de hoy, se guarda un segundo
-- pesaje con la fecha de hoy, en la misma transacción.
create or replace function public.registrar_animal(datos jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nuevo_id uuid;
  especie_nueva text := coalesce(datos ->> 'especie', 'bovino');
  hoy date := (now() at time zone 'America/Bogota')::date;
  ingreso date := coalesce((datos ->> 'fecha_ingreso')::date, hoy);
  peso_inicial numeric := (datos ->> 'peso_ingreso_kg')::numeric;
  peso_hoy numeric := (datos ->> 'peso_actual_kg')::numeric;
begin
  if ingreso > hoy then
    raise exception 'ingreso_futuro: la fecha de ingreso no puede ser futura' using errcode = '23514';
  end if;
  if peso_hoy is not null and not (peso_hoy > 0 and peso_hoy < 1500) then
    raise exception 'peso_actual_invalido: el peso actual debe estar entre 1 y 1.499 kg' using errcode = '23514';
  end if;
  if peso_hoy is not null and ingreso = hoy and peso_hoy <> peso_inicial then
    raise exception 'peso_actual_mismo_dia: si el animal entró hoy, el peso actual es el inicial' using errcode = '23514';
  end if;

  insert into public.animales (
    especie, numero_interno, chapeta_ica, sexo, categoria, origen, fecha_ingreso, fecha_nacimiento,
    nacimiento_mes_conocido, peso_ingreso_kg, peso_objetivo_kg, costo_compra_cop, precio_compra_kg_cop,
    lote_id, finca_id, contrato_id, dueno, color, raza
  ) values (
    especie_nueva,
    trim(datos ->> 'numero_interno'),
    nullif(upper(trim(coalesce(datos ->> 'chapeta_ica', ''))), ''),
    datos ->> 'sexo',
    coalesce(datos ->> 'categoria', 'novillo'),
    coalesce(datos ->> 'origen', 'compra'),
    ingreso,
    (datos ->> 'fecha_nacimiento')::date,
    (datos ->> 'nacimiento_mes_conocido')::boolean,
    peso_inicial,
    (datos ->> 'peso_objetivo_kg')::numeric,
    (datos ->> 'costo_compra_cop')::bigint,
    (datos ->> 'precio_compra_kg_cop')::integer,
    (datos ->> 'lote_id')::uuid,
    (datos ->> 'finca_id')::uuid,
    (datos ->> 'contrato_id')::uuid,
    nullif(trim(coalesce(datos ->> 'dueno', '')), ''),
    nullif(trim(coalesce(datos ->> 'color', '')), ''),
    nullif(trim(coalesce(datos ->> 'raza', '')), '')
  )
  returning id into nuevo_id;

  if especie_nueva = 'bovino' then
    insert into public.pesajes (animal_id, fecha, peso_kg) values (nuevo_id, ingreso, peso_inicial);
    if peso_hoy is not null and peso_hoy <> peso_inicial and ingreso < hoy then
      insert into public.pesajes (animal_id, fecha, peso_kg) values (nuevo_id, hoy, peso_hoy);
    end if;
  end if;

  return nuevo_id;
end;
$$;

-- ───────────── Parte B ─────────────

-- 025 · R6: la venta ya no es de un lote; cada animal vendido guarda el lote en que estaba.
alter table public.ventas
  alter column lote_id drop not null,
  add column gastos_venta_cop bigint not null default 0 check (gastos_venta_cop >= 0 and gastos_venta_cop < 10000000000);

alter table public.venta_animales
  add column lote_id uuid references public.lotes (id) on delete restrict;
update public.venta_animales va set lote_id = v.lote_id from public.ventas v where v.id = va.venta_id;
alter table public.venta_animales alter column lote_id set not null;
create index venta_animales_lote_idx on public.venta_animales (lote_id);

drop function public.registrar_venta(uuid, date, text, integer, numeric, jsonb, text, jsonb);

-- 025 · R5/R6: registra una venta de uno o varios lotes en una transacción.
-- animales: [{ "animal_id": uuid, "peso_kg": number, "costo_cop": number }]
create or replace function public.registrar_venta(
  fecha date,
  comprador text,
  precio_kg integer,
  destare numeric,
  gastos_venta bigint,
  recomendacion jsonb,
  notas text,
  animales jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nueva uuid;
  a jsonb;
  fila record;
  ids uuid[] := '{}';
  lotes_venta uuid[] := '{}';
  l uuid;
begin
  if jsonb_array_length(coalesce(animales, '[]'::jsonb)) = 0 then
    raise exception 'sin_animales: la venta debe incluir al menos un animal' using errcode = '23514';
  end if;
  if fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: la venta tiene fecha %', fecha using errcode = '23514';
  end if;
  if coalesce(gastos_venta, 0) < 0 then
    raise exception 'gastos_negativos: las comisiones y el transporte no pueden ser negativos' using errcode = '23514';
  end if;

  insert into public.ventas (fecha, comprador, precio_kg_cop, destare_pct, gastos_venta_cop, recomendacion_sistema, notas)
  values (fecha, trim(comprador), precio_kg, coalesce(destare, 0), coalesce(gastos_venta, 0), recomendacion, nullif(trim(coalesce(notas, '')), ''))
  returning id into nueva;

  for a in select * from jsonb_array_elements(animales)
  loop
    select an.id, an.categoria, an.especie, an.estado, an.lote_id, an.fecha_ingreso, an.contrato_id, c.porcentaje_ganancia, lo.estado as estado_lote
      into fila
      from public.animales an
      left join public.contratos_al_partir c on c.id = an.contrato_id
      left join public.lotes lo on lo.id = an.lote_id
      where an.id = (a ->> 'animal_id')::uuid;
    if fila.id is null or fila.lote_id is null then
      raise exception 'animal_sin_lote: un animal de la venta no existe o no tiene lote' using errcode = '23514';
    end if;
    if fila.estado_lote in ('vendido', 'cerrado') then
      raise exception 'lote_cerrado: el lote ya se vendió o se cerró' using errcode = '23514';
    end if;
    if fila.estado <> 'activo' then
      raise exception 'animal_no_activo: solo se pueden vender animales activos' using errcode = '23514';
    end if;
    if fecha < fila.fecha_ingreso then
      raise exception 'fecha_antes_del_ingreso: la venta no puede ser anterior al ingreso del animal' using errcode = '23514';
    end if;
    -- Vientres y caballos los rechaza el trigger venta_animales_permitida (D2, spec 016).
    insert into public.venta_animales (venta_id, animal_id, lote_id, peso_kg, costo_acumulado_cop, contrato_id, porcentaje_tenedor)
    values (nueva, fila.id, fila.lote_id, (a ->> 'peso_kg')::numeric, round((a ->> 'costo_cop')::numeric), fila.contrato_id, fila.porcentaje_ganancia);
    ids := ids || fila.id;
    if not fila.lote_id = any (lotes_venta) then
      lotes_venta := lotes_venta || fila.lote_id;
    end if;
  end loop;

  -- Los animales quedan vendidos y cada lote también si ya no le quedan activos.
  update public.animales set estado = 'vendido' where id = any (ids);
  foreach l in array lotes_venta
  loop
    if not exists (select 1 from public.animales an where an.lote_id = l and an.estado = 'activo') then
      update public.lotes set estado = 'vendido' where id = l;
    end if;
  end loop;
  return nueva;
end;
$$;

revoke all on function public.registrar_venta(date, text, integer, numeric, bigint, jsonb, text, jsonb) from public, anon;
grant execute on function public.registrar_venta(date, text, integer, numeric, bigint, jsonb, text, jsonb) to authenticated;
