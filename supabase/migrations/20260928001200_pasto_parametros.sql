-- Spec 009 · estado del pasto (D4) y parámetros de venta (D5: destare).

create table public.condicion_pasto (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  potrero_id uuid references public.potreros (id) on delete cascade,
  fecha date not null check (fecha >= date '2000-01-01'),
  nivel text not null check (nivel in ('verde', 'amarillo', 'rojo')),
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index condicion_pasto_finca_fecha_idx on public.condicion_pasto (finca_id, fecha desc);
create index condicion_pasto_potrero_idx on public.condicion_pasto (potrero_id);

-- R4: fecha no futura y, si hay potrero, que sea de esa finca.
create or replace function private.validar_condicion_pasto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: el estado del pasto tiene fecha %', new.fecha using errcode = '23514';
  end if;
  if new.potrero_id is not null and not exists (select 1 from public.potreros p where p.id = new.potrero_id and p.finca_id = new.finca_id) then
    raise exception 'potrero_de_otra_finca: el potrero no pertenece a esa finca' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger condicion_pasto_validar
  before insert or update on public.condicion_pasto
  for each row execute function private.validar_condicion_pasto();

-- R3: parámetros de la finca en una sola fila (id fijo = true).
create table public.parametros (
  id boolean primary key default true check (id),
  destare_pct numeric(4, 1) not null default 0 check (destare_pct between 0 and 15),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
insert into public.parametros (id) values (true);

do $$
declare
  t text;
begin
  foreach t in array array['condicion_pasto', 'parametros']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('create policy "%s: miembros leen" on public.%I for select to authenticated using ((select private.es_miembro()))', t, t);
    execute format('create policy "%s: miembros editan" on public.%I for update to authenticated using ((select private.es_miembro())) with check ((select private.es_miembro()))', t, t);
  end loop;
end
$$;
grant select, update on public.parametros to authenticated;
grant select, insert, update, delete on public.condicion_pasto to authenticated;
create policy "condicion_pasto: miembros crean" on public.condicion_pasto for insert to authenticated with check ((select private.es_miembro()));
create policy "condicion_pasto: dueño borra" on public.condicion_pasto for delete to authenticated using ((select private.es_dueno()));
