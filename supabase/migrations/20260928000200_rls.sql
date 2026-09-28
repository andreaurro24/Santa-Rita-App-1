-- Spec 001 · R4: RLS en todas las tablas.
-- Modelo de acceso: es una sola finca, así que los datos son compartidos entre los miembros.
-- Miembro = usuario autenticado con fila en public.perfiles y activo = true. Sin perfil, un
-- usuario autenticado no ve ni escribe nada. Borrar solo lo puede hacer el rol 'dueno'.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- SECURITY DEFINER para poder leer perfiles sin recursión de RLS. Vive en un esquema no
-- expuesto por la Data API, con search_path vacío, y solo mira la fila del propio usuario.
create or replace function private.es_miembro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo
  );
$$;

create or replace function private.es_dueno()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and p.rol = 'dueno'
  );
$$;

revoke all on function private.es_miembro() from public, anon;
revoke all on function private.es_dueno() from public, anon;
grant execute on function private.es_miembro() to authenticated;
grant execute on function private.es_dueno() to authenticated;

-- Perfiles: cada usuario solo ve su propio perfil; no se crean ni editan desde el cliente.
alter table public.perfiles enable row level security;
revoke all on public.perfiles from anon, authenticated;
grant select on public.perfiles to authenticated;
create policy "perfiles: ver el propio" on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()));

-- Tablas de datos de la finca: mismas políticas para todas.
do $$
declare
  t text;
begin
  foreach t in array array[
    'fincas', 'potreros', 'lotes', 'tenedores', 'contratos_al_partir',
    'animales', 'pesajes', 'eventos_sanitarios', 'precios_mercado'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy "%s: miembros leen" on public.%I for select to authenticated using ((select private.es_miembro()))',
      t, t);
    execute format(
      'create policy "%s: miembros crean" on public.%I for insert to authenticated with check ((select private.es_miembro()))',
      t, t);
    execute format(
      'create policy "%s: miembros editan" on public.%I for update to authenticated using ((select private.es_miembro())) with check ((select private.es_miembro()))',
      t, t);
    execute format(
      'create policy "%s: dueño borra" on public.%I for delete to authenticated using ((select private.es_dueno()))',
      t, t);
  end loop;
end
$$;
