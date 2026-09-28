-- Spec 008 · T1: gastos por lote o por animal (M8, D9).

create table public.costos (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete restrict,
  animal_id uuid references public.animales (id) on delete cascade,
  categoria text not null check (categoria in ('suplemento', 'sal_mineral', 'medicamentos', 'jornales', 'transporte', 'arriendo_pasto', 'otros')),
  descripcion text not null check (length(trim(descripcion)) > 0),
  monto_cop bigint not null check (monto_cop > 0),
  fecha date not null check (fecha >= date '2000-01-01'),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index costos_lote_fecha_idx on public.costos (lote_id, fecha);
create index costos_animal_idx on public.costos (animal_id);

-- Fecha no futura (Bogotá) y, si el gasto es de un animal, el animal debe estar en ese lote.
create or replace function private.validar_costo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: el gasto tiene fecha %', new.fecha using errcode = '23514';
  end if;
  if new.animal_id is not null and not exists (
    select 1 from public.animales a where a.id = new.animal_id and a.lote_id = new.lote_id
  ) then
    raise exception 'animal_de_otro_lote: el animal no pertenece al lote del gasto' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger costos_validar
  before insert or update on public.costos
  for each row execute function private.validar_costo();

alter table public.costos enable row level security;
revoke all on public.costos from anon, authenticated;
grant select, insert, update, delete on public.costos to authenticated;
create policy "costos: miembros leen" on public.costos for select to authenticated using ((select private.es_miembro()));
create policy "costos: miembros crean" on public.costos for insert to authenticated with check ((select private.es_miembro()));
create policy "costos: miembros editan" on public.costos for update to authenticated using ((select private.es_miembro())) with check ((select private.es_miembro()));
create policy "costos: dueño borra" on public.costos for delete to authenticated using ((select private.es_dueno()));
