-- Spec 001 · Esquema inicial de Finca Santa Rita.
-- Tablas base para la paridad con el MVP (hato, pesajes, sanidad, lotes, "Al partir", precios).
-- Las tablas de módulos futuros (costos, ventas, movimientos…) llegan en la spec de su sprint.
-- Reglas: docs/plan.md §3 (D6 identificación única, D8 "Al partir", D12 unidades).

create type public.rol_usuario as enum ('dueno', 'administrador');

-- Perfil de acceso. Solo un usuario con perfil activo puede ver o escribir datos (ver RLS).
-- El perfil NO se crea automáticamente al registrarse: lo crea un administrador, para que un
-- registro público en Auth no dé acceso a los datos de la finca.
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  rol public.rol_usuario not null default 'dueno',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.fincas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) > 0),
  tipo text not null check (tipo in ('propia', 'tenedor')),
  municipio text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.potreros (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete restrict,
  nombre text not null check (length(trim(nombre)) > 0),
  area_ha numeric(8, 2) check (area_ha > 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (finca_id, nombre)
);
create index potreros_finca_id_idx on public.potreros (finca_id);

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (length(trim(codigo)) > 0),
  nombre text not null check (length(trim(nombre)) > 0),
  tipo text not null check (tipo in ('ceba', 'cria')),
  fecha_inicio date,
  peso_meta_kg numeric(6, 1) check (peso_meta_kg > 0),
  estado text not null default 'activo' check (estado in ('activo', 'listo', 'vendido', 'cerrado')),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.tenedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  telefono text,
  finca_id uuid references public.fincas (id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index tenedores_finca_id_idx on public.tenedores (finca_id);

-- D8: contrato "Al partir". El tenedor recibe porcentaje_ganancia % de la ganancia neta.
create table public.contratos_al_partir (
  id uuid primary key default gen_random_uuid(),
  tenedor_id uuid not null references public.tenedores (id) on delete restrict,
  fecha_inicio date,
  precio_animal_cop bigint check (precio_animal_cop >= 0),
  precio_kg_cop integer check (precio_kg_cop >= 0),
  porcentaje_ganancia numeric(5, 2) not null check (porcentaje_ganancia between 0 and 100),
  estado text not null default 'vigente' check (estado in ('vigente', 'terminado')),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index contratos_al_partir_tenedor_id_idx on public.contratos_al_partir (tenedor_id);

create table public.animales (
  id uuid primary key default gen_random_uuid(),
  numero_interno text not null unique check (length(trim(numero_interno)) > 0),
  chapeta_ica text not null unique check (length(trim(chapeta_ica)) > 0),
  marca_finca text not null default 'Hierro Santa Rita (SR)',
  sexo text not null check (sexo in ('Macho', 'Hembra')),
  -- D2: 'vientre' nunca entra a un lote de venta (se hará cumplir en la spec de ventas).
  categoria text not null default 'novillo'
    check (categoria in ('novillo', 'ternero', 'ternera', 'vientre', 'reproductor')),
  origen text not null check (origen in ('compra', 'nacimiento')),
  fecha_ingreso date not null,
  fecha_nacimiento date,
  peso_ingreso_kg numeric(6, 1) not null check (peso_ingreso_kg > 0 and peso_ingreso_kg < 1500),
  peso_objetivo_kg numeric(6, 1) not null check (peso_objetivo_kg > 0 and peso_objetivo_kg < 1500),
  costo_compra_cop bigint check (costo_compra_cop >= 0),
  lote_id uuid not null references public.lotes (id) on delete restrict,
  finca_id uuid references public.fincas (id) on delete restrict,
  potrero_id uuid references public.potreros (id) on delete set null,
  contrato_id uuid references public.contratos_al_partir (id) on delete restrict,
  estado text not null default 'activo' check (estado in ('activo', 'vendido', 'muerto', 'trasladado')),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index animales_lote_id_idx on public.animales (lote_id);
create index animales_finca_id_idx on public.animales (finca_id);
create index animales_potrero_id_idx on public.animales (potrero_id);
create index animales_contrato_id_idx on public.animales (contrato_id);

create table public.pesajes (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animales (id) on delete cascade,
  fecha date not null,
  peso_kg numeric(6, 1) not null check (peso_kg > 0 and peso_kg < 1500),
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index pesajes_animal_fecha_idx on public.pesajes (animal_id, fecha);

create table public.eventos_sanitarios (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animales (id) on delete cascade,
  tipo text not null check (tipo in ('vacuna', 'tratamiento', 'desparasitacion')),
  descripcion text not null check (length(trim(descripcion)) > 0),
  estado text not null default 'aplicado' check (estado in ('aplicado', 'programado')),
  fecha_aplicada date,
  fecha_programada date,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (
    (estado = 'aplicado' and fecha_aplicada is not null)
    or (estado = 'programado' and fecha_programada is not null)
  )
);
create index eventos_sanitarios_animal_id_idx on public.eventos_sanitarios (animal_id);

create table public.precios_mercado (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  precio_kg_cop integer not null check (precio_kg_cop > 0),
  fuente text not null check (length(trim(fuente)) > 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (fecha, fuente)
);
