-- Sprint 05 · "La app de Miguel" (specs 016, 017, 018, 020 y 021).
-- Aprobado por el humano el 2026-10-04 (plan v2 del Sprint 05).

-- ── 018 R2 · texto válido: letras (con tildes y ñ), números, espacios y . , - – ' ( ) # / ───────────
create or replace function private.texto_valido(texto text, maximo integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select texto is null
    or (length(trim(texto)) between 1 and maximo
        and texto ~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,''()#/–-]+$');
$$;

-- ── 016 · animales: especie, dueño, color, compra por kilo, foto, baja ─────────────────────────────
alter table public.animales
  add column especie text not null default 'bovino' check (especie in ('bovino', 'equino')),
  add column dueno text,
  add column color text,
  add column precio_compra_kg_cop integer check (precio_compra_kg_cop > 0),
  add column foto_path text,
  add column fecha_baja date check (fecha_baja >= date '2000-01-01'),
  add column motivo_baja text check (motivo_baja is null or length(trim(motivo_baja)) between 1 and 200);

-- R6: peso objetivo opcional. R8: los caballos no tienen chapeta ICA, pesaje ni lote obligatorios.
alter table public.animales
  alter column peso_objetivo_kg drop not null,
  alter column chapeta_ica drop not null,
  alter column peso_ingreso_kg drop not null,
  alter column lote_id drop not null;

-- R5: tres tipos de vientre (los existentes pasan a vientre mayor). R8: categorías de caballos.
alter table public.animales
  drop constraint animales_categoria_check,
  drop constraint animales_categoria_sexo_check,
  drop constraint animales_estado_check;
update public.animales set categoria = 'vientre_mayor' where categoria = 'vientre';
alter table public.animales
  add constraint animales_categoria_check check (categoria in (
    'novillo', 'ternero', 'ternera', 'vientre_menor', 'vientre_mayor', 'vientre_parida', 'reproductor',
    'caballo', 'yegua', 'potro', 'potranca')),
  add constraint animales_categoria_sexo_check check (
    (especie = 'bovino' and (
      (sexo = 'Hembra' and categoria in ('ternera', 'vientre_menor', 'vientre_mayor', 'vientre_parida'))
      or (sexo = 'Macho' and categoria in ('novillo', 'ternero', 'reproductor'))))
    or (especie = 'equino' and (
      (sexo = 'Hembra' and categoria in ('yegua', 'potranca'))
      or (sexo = 'Macho' and categoria in ('caballo', 'potro'))))),
  add constraint animales_bovino_completo check (
    especie = 'equino' or (chapeta_ica is not null and peso_ingreso_kg is not null and lote_id is not null)),
  -- R3: muerto o perdido llevan fecha de baja.
  add constraint animales_estado_check check (estado in ('activo', 'vendido', 'muerto', 'perdido', 'trasladado')),
  add constraint animales_baja_con_fecha check (estado not in ('muerto', 'perdido') or fecha_baja is not null),
  -- 018 R2.
  add constraint animales_numero_valido check (private.texto_valido(numero_interno, 30)),
  add constraint animales_chapeta_valida check (private.texto_valido(chapeta_ica, 30)),
  add constraint animales_dueno_valido check (private.texto_valido(dueno, 80)),
  add constraint animales_color_valido check (private.texto_valido(color, 40));

create index animales_especie_idx on public.animales (especie);

-- R3: la fecha de baja no es futura ni anterior al ingreso.
create or replace function private.validar_baja()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fecha_baja is not null then
    if new.fecha_baja > (now() at time zone 'America/Bogota')::date then
      raise exception 'fecha_futura: la baja tiene fecha %', new.fecha_baja using errcode = '23514';
    end if;
    if new.fecha_baja < new.fecha_ingreso then
      raise exception 'fecha_antes_del_ingreso: la baja no puede ser anterior al ingreso del animal' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger animales_validar_baja
  before insert or update of fecha_baja, fecha_ingreso on public.animales
  for each row execute function private.validar_baja();

-- R1, R4–R8: registrar un animal (bovino con su pesaje de ingreso; equino sin pesaje).
create or replace function public.registrar_animal(datos jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nuevo_id uuid;
  especie_nueva text := coalesce(datos ->> 'especie', 'bovino');
begin
  insert into public.animales (
    especie, numero_interno, chapeta_ica, sexo, categoria, origen, fecha_ingreso, fecha_nacimiento,
    peso_ingreso_kg, peso_objetivo_kg, costo_compra_cop, precio_compra_kg_cop, lote_id, finca_id,
    contrato_id, dueno, color
  ) values (
    especie_nueva,
    trim(datos ->> 'numero_interno'),
    nullif(upper(trim(coalesce(datos ->> 'chapeta_ica', ''))), ''),
    datos ->> 'sexo',
    coalesce(datos ->> 'categoria', 'novillo'),
    coalesce(datos ->> 'origen', 'compra'),
    (datos ->> 'fecha_ingreso')::date,
    (datos ->> 'fecha_nacimiento')::date,
    (datos ->> 'peso_ingreso_kg')::numeric,
    (datos ->> 'peso_objetivo_kg')::numeric,
    (datos ->> 'costo_compra_cop')::bigint,
    (datos ->> 'precio_compra_kg_cop')::integer,
    (datos ->> 'lote_id')::uuid,
    (datos ->> 'finca_id')::uuid,
    (datos ->> 'contrato_id')::uuid,
    nullif(trim(coalesce(datos ->> 'dueno', '')), ''),
    nullif(trim(coalesce(datos ->> 'color', '')), '')
  )
  returning id into nuevo_id;

  if especie_nueva = 'bovino' then
    insert into public.pesajes (animal_id, fecha, peso_kg)
    values (nuevo_id, (datos ->> 'fecha_ingreso')::date, (datos ->> 'peso_ingreso_kg')::numeric);
  end if;

  return nuevo_id;
end;
$$;

-- D2 (016 R5): ningún vientre se vende; los caballos tienen su propia venta (R8).
create or replace function private.venta_animal_permitida()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  fila record;
begin
  select categoria, especie into fila from public.animales where id = new.animal_id;
  if fila.categoria like 'vientre%' then
    raise exception 'vientre_no_se_vende: un vientre no se puede vender (D2)' using errcode = '23514';
  end if;
  if fila.especie = 'equino' then
    raise exception 'equino_venta_aparte: los caballos se venden uno por uno con su precio' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger venta_animales_permitida
  before insert or update of animal_id on public.venta_animales
  for each row execute function private.venta_animal_permitida();

-- 016 R8: venta de un caballo, por precio del animal.
create table public.ventas_equinos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null unique references public.animales (id) on delete restrict,
  fecha date not null check (fecha >= date '2000-01-01'),
  comprador text not null check (private.texto_valido(comprador, 80)),
  precio_cop bigint not null check (precio_cop > 0),
  notas text check (notas is null or length(notas) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
alter table public.ventas_equinos enable row level security;
revoke all on public.ventas_equinos from anon, authenticated;
grant select, insert, update, delete on public.ventas_equinos to authenticated;
create policy "ventas_equinos: miembros leen" on public.ventas_equinos for select to authenticated using ((select private.es_miembro()));
create policy "ventas_equinos: miembros crean" on public.ventas_equinos for insert to authenticated with check ((select private.es_miembro()));
create policy "ventas_equinos: miembros editan" on public.ventas_equinos for update to authenticated using ((select private.es_miembro())) with check ((select private.es_miembro()));
create policy "ventas_equinos: dueño borra" on public.ventas_equinos for delete to authenticated using ((select private.es_dueno()));

create or replace function public.vender_equino(animal uuid, fecha date, comprador text, precio_cop bigint, notas text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fila record;
  nueva uuid;
begin
  select a.id, a.especie, a.estado, a.fecha_ingreso into fila from public.animales a where a.id = animal;
  if fila.id is null or fila.especie <> 'equino' then
    raise exception 'no_es_equino: solo se venden así los caballos' using errcode = '23514';
  end if;
  if fila.estado <> 'activo' then
    raise exception 'animal_no_activo: solo se pueden vender animales activos' using errcode = '23514';
  end if;
  if fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: la venta tiene fecha %', fecha using errcode = '23514';
  end if;
  if fecha < fila.fecha_ingreso then
    raise exception 'fecha_antes_del_ingreso: la venta no puede ser anterior al ingreso del animal' using errcode = '23514';
  end if;
  insert into public.ventas_equinos (animal_id, fecha, comprador, precio_cop, notas)
  values (animal, fecha, trim(comprador), precio_cop, nullif(trim(coalesce(notas, '')), ''))
  returning id into nueva;
  update public.animales set estado = 'vendido' where id = animal;
  return nueva;
end;
$$;
revoke all on function public.vender_equino(uuid, date, text, bigint, text) from public, anon;
grant execute on function public.vender_equino(uuid, date, text, bigint, text) to authenticated;

-- ── 020 · fincas, lotes y gastos de finca ─────────────────────────────────────────────────────────
alter table public.fincas
  add column propietario text,
  add constraint fincas_nombre_valido check (private.texto_valido(nombre, 80)),
  add constraint fincas_propietario_valido check (private.texto_valido(propietario, 80));
alter table public.potreros add constraint potreros_nombre_valido check (private.texto_valido(nombre, 80));
alter table public.tenedores add constraint tenedores_nombre_valido check (private.texto_valido(nombre, 80));
alter table public.lotes
  add column descripcion text check (descripcion is null or length(trim(descripcion)) between 1 and 300),
  add constraint lotes_nombre_valido check (private.texto_valido(nombre, 80)),
  add constraint lotes_codigo_valido check (private.texto_valido(codigo, 30));
alter table public.ventas add constraint ventas_comprador_valido check (private.texto_valido(comprador, 80));

-- R4: un gasto es de un lote (y quizá de un animal) o de la finca entera, nunca de los dos.
alter table public.costos
  alter column lote_id drop not null,
  add column finca_id uuid references public.fincas (id) on delete restrict,
  add constraint costos_lote_o_finca check (num_nonnulls(lote_id, finca_id) = 1),
  add constraint costos_animal_con_lote check (animal_id is null or lote_id is not null);
create index costos_finca_idx on public.costos (finca_id);

-- ── 021 · precios de referencia por zona y categoría ──────────────────────────────────────────────
create table public.precios_referencia (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('ternero', 'ternera', 'levante', 'gordo', 'vaca')),
  zona text not null default 'Cesar y La Guajira' check (private.texto_valido(zona, 80)),
  precio_min_cop integer not null check (precio_min_cop > 0),
  precio_max_cop integer not null check (precio_max_cop > 0),
  fecha date not null check (fecha >= date '2000-01-01'),
  fuente text not null check (length(trim(fuente)) between 1 and 300),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint precios_referencia_rango check (precio_min_cop <= precio_max_cop)
);
create index precios_referencia_categoria_idx on public.precios_referencia (categoria, fecha desc, created_at desc);
create or replace function private.precio_referencia_no_futuro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: el precio tiene fecha %', new.fecha using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger precios_referencia_sin_fecha_futura
  before insert or update of fecha on public.precios_referencia
  for each row execute function private.precio_referencia_no_futuro();
alter table public.precios_referencia enable row level security;
revoke all on public.precios_referencia from anon, authenticated;
grant select, insert, update, delete on public.precios_referencia to authenticated;
create policy "precios_referencia: miembros leen" on public.precios_referencia for select to authenticated using ((select private.es_miembro()));
create policy "precios_referencia: miembros crean" on public.precios_referencia for insert to authenticated with check ((select private.es_miembro()));
create policy "precios_referencia: miembros editan" on public.precios_referencia for update to authenticated using ((select private.es_miembro())) with check ((select private.es_miembro()));
create policy "precios_referencia: dueño borra" on public.precios_referencia for delete to authenticated using ((select private.es_dueno()));

-- R4: carga inicial, marcada como estimado por validar.
insert into public.precios_referencia (categoria, precio_min_cop, precio_max_cop, fecha, fuente) values
  ('ternero', 9000, 10500, date '2026-10-04', 'Estimado inicial, por validar con Miguel: promedios de subastas 2026 de Fedegán-FNG (Contexto Ganadero, Sectorial) ajustados a la Costa'),
  ('ternera', 8000, 9500, date '2026-10-04', 'Estimado inicial, por validar con Miguel: promedios de subastas 2026 de Fedegán-FNG (Contexto Ganadero, Sectorial) ajustados a la Costa'),
  ('levante', 8500, 10000, date '2026-10-04', 'Estimado inicial, por validar con Miguel: promedios de subastas 2026 de Fedegán-FNG (Contexto Ganadero, Sectorial) ajustados a la Costa'),
  ('gordo', 8000, 9400, date '2026-10-04', 'Estimado inicial, por validar con Miguel: promedios de subastas 2026 de Fedegán-FNG (Contexto Ganadero, Sectorial) ajustados a la Costa'),
  ('vaca', 7000, 8000, date '2026-10-04', 'Estimado inicial, por validar con Miguel: rango que dio Miguel para la zona (7.000–8.000 $/kg)');

-- ── 017 · bucket privado de fotos ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-animales', 'fotos-animales', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "fotos-animales: miembros leen" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-animales' and (select private.es_miembro()));
create policy "fotos-animales: miembros suben" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-animales' and (select private.es_miembro()));
create policy "fotos-animales: miembros reemplazan" on storage.objects for update to authenticated
  using (bucket_id = 'fotos-animales' and (select private.es_miembro()))
  with check (bucket_id = 'fotos-animales' and (select private.es_miembro()));
create policy "fotos-animales: miembros borran" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-animales' and (select private.es_miembro()));
