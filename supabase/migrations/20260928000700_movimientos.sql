-- Spec 006 · T1: historial de ubicación (D7) y movimiento atómico de animales.

create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animales (id) on delete cascade,
  fecha date not null,
  desde_finca_id uuid references public.fincas (id) on delete set null,
  desde_potrero_id uuid references public.potreros (id) on delete set null,
  desde_lote_id uuid references public.lotes (id) on delete set null,
  hacia_finca_id uuid references public.fincas (id) on delete set null,
  hacia_potrero_id uuid references public.potreros (id) on delete set null,
  hacia_lote_id uuid references public.lotes (id) on delete set null,
  motivo text not null check (length(trim(motivo)) > 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index movimientos_animal_idx on public.movimientos (animal_id, fecha desc);
create index movimientos_desde_finca_idx on public.movimientos (desde_finca_id);
create index movimientos_desde_potrero_idx on public.movimientos (desde_potrero_id);
create index movimientos_desde_lote_idx on public.movimientos (desde_lote_id);
create index movimientos_hacia_finca_idx on public.movimientos (hacia_finca_id);
create index movimientos_hacia_potrero_idx on public.movimientos (hacia_potrero_id);
create index movimientos_hacia_lote_idx on public.movimientos (hacia_lote_id);

alter table public.movimientos enable row level security;
revoke all on public.movimientos from anon, authenticated;
grant select, insert, update, delete on public.movimientos to authenticated;
create policy "movimientos: miembros leen" on public.movimientos for select to authenticated using ((select private.es_miembro()));
create policy "movimientos: miembros crean" on public.movimientos for insert to authenticated with check ((select private.es_miembro()));
create policy "movimientos: miembros editan" on public.movimientos for update to authenticated using ((select private.es_miembro())) with check ((select private.es_miembro()));
create policy "movimientos: dueño borra" on public.movimientos for delete to authenticated using ((select private.es_dueno()));

-- R6: mueve uno o varios animales y deja el movimiento de cada uno, todo en una transacción.
-- Destino: un potrero (su finca va implícita), o una finca sin potrero, y/o un lote. Lo que
-- venga en null no cambia. SECURITY INVOKER: RLS aplica igual que desde la app.
create or replace function public.mover_animales(
  ids uuid[],
  fecha date,
  motivo text,
  finca_destino uuid default null,
  potrero_destino uuid default null,
  lote_destino uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  finca_del_potrero uuid;
  movidos integer;
begin
  if coalesce(array_length(ids, 1), 0) = 0 then
    raise exception 'sin_animales: selecciona al menos un animal' using errcode = '23514';
  end if;
  if fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'fecha_futura: el movimiento tiene fecha %', fecha using errcode = '23514';
  end if;
  if finca_destino is null and potrero_destino is null and lote_destino is null then
    raise exception 'sin_destino: indica una finca, un potrero o un lote de destino' using errcode = '23514';
  end if;
  if potrero_destino is not null then
    select p.finca_id into finca_del_potrero from public.potreros p where p.id = potrero_destino;
    if finca_del_potrero is null then
      raise exception 'potrero_inexistente' using errcode = '23503';
    end if;
    if finca_destino is not null and finca_destino <> finca_del_potrero then
      raise exception 'potrero_de_otra_finca: el potrero no pertenece a esa finca' using errcode = '23514';
    end if;
    finca_destino := finca_del_potrero;
  end if;

  insert into public.movimientos (
    animal_id, fecha, motivo,
    desde_finca_id, desde_potrero_id, desde_lote_id,
    hacia_finca_id, hacia_potrero_id, hacia_lote_id
  )
  select a.id, fecha, trim(motivo),
    a.finca_id, a.potrero_id, a.lote_id,
    coalesce(finca_destino, a.finca_id),
    case when potrero_destino is not null then potrero_destino
         when finca_destino is not null and finca_destino is distinct from a.finca_id then null
         else a.potrero_id end,
    coalesce(lote_destino, a.lote_id)
  from public.animales a
  where a.id = any (ids);

  update public.animales a set
    finca_id = coalesce(finca_destino, a.finca_id),
    potrero_id = case when potrero_destino is not null then potrero_destino
                      when finca_destino is not null and finca_destino is distinct from a.finca_id then null
                      else a.potrero_id end,
    lote_id = coalesce(lote_destino, a.lote_id)
  where a.id = any (ids);
  get diagnostics movidos = row_count;

  if movidos <> array_length(ids, 1) then
    raise exception 'animales_no_encontrados: se pidieron % y se encontraron %', array_length(ids, 1), movidos using errcode = '23503';
  end if;
  return movidos;
end;
$$;

revoke all on function public.mover_animales(uuid[], date, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.mover_animales(uuid[], date, text, uuid, uuid, uuid) to authenticated;
