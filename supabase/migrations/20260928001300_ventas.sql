-- Spec 011 · venta real de un lote y cierre del ciclo (M11).

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete restrict,
  fecha date not null check (fecha >= date '2000-01-01'),
  comprador text not null check (length(trim(comprador)) > 0),
  precio_kg_cop integer not null check (precio_kg_cop > 0),
  destare_pct numeric(4, 1) not null default 0 check (destare_pct between 0 and 15),
  -- R4: copia de lo que recomendó el sistema al momento de vender.
  recomendacion_sistema jsonb,
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index ventas_lote_idx on public.ventas (lote_id);

create table public.venta_animales (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas (id) on delete cascade,
  animal_id uuid not null unique references public.animales (id) on delete restrict,
  peso_kg numeric(6, 1) not null check (peso_kg > 0 and peso_kg < 1500),
  -- Copias al momento de la venta, para que la liquidación no cambie si luego se editan datos.
  costo_acumulado_cop bigint not null check (costo_acumulado_cop >= 0),
  contrato_id uuid references public.contratos_al_partir (id) on delete restrict,
  porcentaje_tenedor numeric(5, 2) check (porcentaje_tenedor between 0 and 100),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index venta_animales_venta_idx on public.venta_animales (venta_id);
create index venta_animales_contrato_idx on public.venta_animales (contrato_id);

do $$
declare
  t text;
begin
  foreach t in array array['ventas', 'venta_animales']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "%s: miembros leen" on public.%I for select to authenticated using ((select private.es_miembro()))', t, t);
    execute format('create policy "%s: miembros crean" on public.%I for insert to authenticated with check ((select private.es_miembro()))', t, t);
    execute format('create policy "%s: miembros editan" on public.%I for update to authenticated using ((select private.es_miembro())) with check ((select private.es_miembro()))', t, t);
    execute format('create policy "%s: dueño borra" on public.%I for delete to authenticated using ((select private.es_dueno()))', t, t);
  end loop;
end
$$;

-- R1–R4: registra la venta completa en una transacción.
-- animales: [{ "animal_id": uuid, "peso_kg": number, "costo_cop": number }]
create or replace function public.registrar_venta(
  lote uuid,
  fecha date,
  comprador text,
  precio_kg integer,
  destare numeric,
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
begin
  if jsonb_array_length(coalesce(animales, '[]'::jsonb)) = 0 then
    raise exception 'sin_animales: la venta debe incluir al menos un animal' using errcode = '23514';
  end if;
  if fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: la venta tiene fecha %', fecha using errcode = '23514';
  end if;
  if exists (select 1 from public.lotes l where l.id = lote and l.estado in ('vendido', 'cerrado')) then
    raise exception 'lote_cerrado: el lote ya se vendió o se cerró' using errcode = '23514';
  end if;

  insert into public.ventas (lote_id, fecha, comprador, precio_kg_cop, destare_pct, recomendacion_sistema, notas)
  values (lote, fecha, trim(comprador), precio_kg, coalesce(destare, 0), recomendacion, nullif(trim(coalesce(notas, '')), ''))
  returning id into nueva;

  for a in select * from jsonb_array_elements(animales)
  loop
    select an.id, an.categoria, an.estado, an.lote_id, an.fecha_ingreso, an.contrato_id, c.porcentaje_ganancia
      into fila
      from public.animales an
      left join public.contratos_al_partir c on c.id = an.contrato_id
      where an.id = (a ->> 'animal_id')::uuid;
    if fila.id is null or fila.lote_id <> lote then
      raise exception 'animal_de_otro_lote: un animal de la venta no pertenece al lote' using errcode = '23514';
    end if;
    -- R2 / D2: los vientres no se venden.
    if fila.categoria = 'vientre' then
      raise exception 'vientre_no_se_vende: un vientre no se puede vender (D2)' using errcode = '23514';
    end if;
    if fila.estado <> 'activo' then
      raise exception 'animal_no_activo: solo se pueden vender animales activos' using errcode = '23514';
    end if;
    if fecha < fila.fecha_ingreso then
      raise exception 'fecha_antes_del_ingreso: la venta no puede ser anterior al ingreso del animal' using errcode = '23514';
    end if;
    insert into public.venta_animales (venta_id, animal_id, peso_kg, costo_acumulado_cop, contrato_id, porcentaje_tenedor)
    values (nueva, fila.id, (a ->> 'peso_kg')::numeric, round((a ->> 'costo_cop')::numeric), fila.contrato_id, fila.porcentaje_ganancia);
    ids := ids || fila.id;
  end loop;

  -- R3: los animales quedan vendidos y el lote también si ya no le quedan activos.
  update public.animales set estado = 'vendido' where id = any (ids);
  if not exists (select 1 from public.animales an where an.lote_id = lote and an.estado = 'activo') then
    update public.lotes set estado = 'vendido' where id = lote;
  end if;
  return nueva;
end;
$$;

revoke all on function public.registrar_venta(uuid, date, text, integer, numeric, jsonb, text, jsonb) from public, anon;
grant execute on function public.registrar_venta(uuid, date, text, integer, numeric, jsonb, text, jsonb) to authenticated;
