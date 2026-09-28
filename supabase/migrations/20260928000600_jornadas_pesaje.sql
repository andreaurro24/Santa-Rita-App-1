-- Spec 004 · T1: jornada de pesaje por lote (M3). Cada peso capturado en la jornada es un
-- pesaje normal con jornada_id, así que la GDP y el peso actual no cambian de lógica.

create table public.jornadas_pesaje (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete restrict,
  fecha date not null,
  notas text,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  cerrada_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index jornadas_pesaje_lote_idx on public.jornadas_pesaje (lote_id, fecha desc);
-- Solo una jornada abierta por lote a la vez (R1: se retoma la abierta en vez de duplicarla).
create unique index jornadas_pesaje_una_abierta_por_lote on public.jornadas_pesaje (lote_id) where estado = 'abierta';

alter table public.pesajes add column jornada_id uuid references public.jornadas_pesaje (id) on delete set null;
create index pesajes_jornada_idx on public.pesajes (jornada_id);

-- Un animal se pesa una sola vez por jornada.
create unique index pesajes_uno_por_jornada on public.pesajes (jornada_id, animal_id) where jornada_id is not null;

-- La fecha de la jornada tampoco puede ser futura (misma regla que los pesajes).
create or replace function private.jornada_sin_fecha_futura()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: la jornada tiene fecha %', new.fecha using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger jornadas_sin_fecha_futura
  before insert or update of fecha on public.jornadas_pesaje
  for each row execute function private.jornada_sin_fecha_futura();

alter table public.jornadas_pesaje enable row level security;
revoke all on public.jornadas_pesaje from anon, authenticated;
grant select, insert, update, delete on public.jornadas_pesaje to authenticated;
create policy "jornadas_pesaje: miembros leen" on public.jornadas_pesaje for select to authenticated using ((select private.es_miembro()));
create policy "jornadas_pesaje: miembros crean" on public.jornadas_pesaje for insert to authenticated with check ((select private.es_miembro()));
create policy "jornadas_pesaje: miembros editan" on public.jornadas_pesaje for update to authenticated using ((select private.es_miembro())) with check ((select private.es_miembro()));
create policy "jornadas_pesaje: dueño borra" on public.jornadas_pesaje for delete to authenticated using ((select private.es_dueno()));
