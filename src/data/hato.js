import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatPct } from '../utils/format';

// Spec 001 · R4/R8: el hato se lee de Supabase y se entrega a las páginas con la MISMA forma
// que tenía en el MVP con localStorage (camelCase, pesos y sanidad embebidos), para mantener
// la paridad sin reescribir las pantallas.

const HATO_KEY = ['hato'];

const SELECT_ANIMALES = `
  id, especie, numero_interno, chapeta_ica, marca_finca, sexo, categoria, origen, fecha_ingreso,
  fecha_nacimiento, peso_ingreso_kg, peso_objetivo_kg, costo_compra_cop, precio_compra_kg_cop, estado,
  dueno, color, foto_path, fecha_baja, motivo_baja,
  lote:lotes ( id, codigo, nombre, tipo ),
  finca:fincas ( id, nombre, tipo ),
  potrero:potreros ( id, nombre ),
  contrato:contratos_al_partir ( id, porcentaje_ganancia, tenedor:tenedores ( nombre, finca:fincas ( nombre ) ) ),
  pesajes ( fecha, peso_kg, created_at ),
  eventos_sanitarios ( id, tipo, descripcion, estado, fecha_aplicada, fecha_programada )
`;

const TIPO_SANIDAD = { vacuna: 'Vacuna', tratamiento: 'Tratamiento', desparasitacion: 'Desparasitación' };
const capitalizar = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function mapAnimal(row) {
  const tenedor = row.contrato?.tenedor;
  return {
    id: row.id,
    especie: row.especie ?? 'bovino',
    numeroInterno: row.numero_interno,
    chapetaICA: row.chapeta_ica ?? '',
    marcaFinca: row.marca_finca,
    sexo: row.sexo,
    categoria: row.categoria,
    origen: capitalizar(row.origen),
    fechaIngreso: row.fecha_ingreso,
    fechaNacimiento: row.fecha_nacimiento ?? null,
    pesoIngreso: row.peso_ingreso_kg != null ? Number(row.peso_ingreso_kg) : null,
    // Spec 016 · R6: el peso objetivo es opcional.
    pesoObjetivo: row.peso_objetivo_kg != null ? Number(row.peso_objetivo_kg) : null,
    costoCompra: row.costo_compra_cop != null ? Number(row.costo_compra_cop) : null,
    precioCompraKg: row.precio_compra_kg_cop ?? null,
    dueno: row.dueno ?? null,
    color: row.color ?? null,
    fotoPath: row.foto_path ?? null,
    // Spec 016 · R3: la baja (muerte o pérdida) cuenta como salida para el reparto de gastos.
    fechaBaja: row.fecha_baja ?? null,
    motivoBaja: row.motivo_baja ?? null,
    lote: row.lote?.codigo,
    loteId: row.lote?.id,
    loteNombre: row.lote?.nombre,
    loteTipo: row.lote?.tipo,
    fincaId: row.finca?.id ?? null,
    fincaNombre: row.finca?.nombre ?? null,
    potreroId: row.potrero?.id ?? null,
    potreroNombre: row.potrero?.nombre ?? null,
    contratoId: row.contrato?.id ?? null,
    esquema: row.contrato ? 'Al partir' : 'Propio',
    tenedor: tenedor ? `${tenedor.nombre} – ${tenedor.finca?.nombre ?? 'sin finca'}` : null,
    porcentajeTenedor: row.contrato ? Number(row.contrato.porcentaje_ganancia) : null,
    estado: capitalizar(row.estado),
    // `creado` desempata dos pesajes del mismo día: vale el último registrado.
    pesos: (row.pesajes ?? []).map((p) => ({ fecha: p.fecha, pesoKg: Number(p.peso_kg), creado: p.created_at })),
    sanidad: (row.eventos_sanitarios ?? []).map((e) =>
      e.estado === 'programado'
        ? { id: e.id, fecha: null, tipo: TIPO_SANIDAD[e.tipo], descripcion: e.descripcion, proximaFecha: e.fecha_programada, pendiente: true }
        : { id: e.id, fecha: e.fecha_aplicada, tipo: TIPO_SANIDAD[e.tipo], descripcion: e.descripcion },
    ),
  };
}

function agruparLotes(animales) {
  const map = new Map();
  for (const a of animales) {
    if (!map.has(a.lote)) map.set(a.lote, { codigo: a.lote, id: a.loteId, nombre: a.loteNombre, tipo: a.loteTipo, animales: [] });
    map.get(a.lote).animales.push(a);
  }
  // Primero los lotes de ceba (los que se venden), luego la cría; dentro de cada tipo, por código.
  const orden = (l) => (l.tipo === 'cria' ? 1 : 0);
  return [...map.values()].sort((x, y) => orden(x) - orden(y) || x.codigo.localeCompare(y.codigo));
}

// Spec 016 · R8: los caballos van aparte (`caballos`); `animales` y `lotes` son solo el ganado
// bovino, así los módulos de pesaje, lotes, costos y venta no cambian.
async function fetchHato() {
  const { data, error } = await supabase.from('animales').select(SELECT_ANIMALES).order('numero_interno');
  if (error) throw error;
  const todos = data.map(mapAnimal);
  const animales = todos.filter((a) => a.especie !== 'equino');
  const caballos = todos.filter((a) => a.especie === 'equino');
  return { animales, caballos, lotes: agruparLotes(animales) };
}

export function useHato() {
  return useQuery({ queryKey: HATO_KEY, queryFn: fetchHato });
}

export function useContratosVigentes() {
  return useQuery({
    queryKey: ['contratos-vigentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos_al_partir')
        .select('id, porcentaje_ganancia, tenedor:tenedores ( nombre, finca_id, finca:fincas ( nombre ) )')
        .eq('estado', 'vigente');
      if (error) throw error;
      return data.map((c) => ({
        id: c.id,
        porcentaje: Number(c.porcentaje_ganancia),
        fincaId: c.tenedor?.finca_id ?? null,
        etiqueta: `${c.tenedor?.nombre} – ${c.tenedor?.finca?.nombre ?? 'sin finca'} (${formatPct(c.porcentaje_ganancia)})`,
      }));
    },
  });
}

async function fincaPropiaId() {
  const { data, error } = await supabase.from('fincas').select('id').eq('tipo', 'propia').limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

function useMutacionHato(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HATO_KEY }),
  });
}

// Nuevo animal. `contratoId` y `fincaId` vienen de useContratosVigentes cuando es "Al partir".
// Spec 016: especie, dueño, color, compra por kilo y peso objetivo opcional.
export function useAddAnimal() {
  return useMutacionHato(async (nuevo) => {
    const fincaId = nuevo.contratoId ? nuevo.fincaId : await fincaPropiaId();
    // Animal + pesaje de ingreso en una sola transacción (función SQL registrar_animal).
    const { data, error } = await supabase.rpc('registrar_animal', {
      datos: {
        especie: nuevo.especie ?? 'bovino',
        numero_interno: nuevo.numeroInterno.trim(),
        chapeta_ica: nuevo.chapetaICA?.trim().toUpperCase() || null,
        sexo: nuevo.sexo,
        categoria: nuevo.categoria,
        origen: nuevo.origen ?? 'compra',
        fecha_ingreso: nuevo.fechaIngreso,
        fecha_nacimiento: nuevo.fechaNacimiento || null,
        peso_ingreso_kg: nuevo.pesoIngreso ?? null,
        peso_objetivo_kg: nuevo.pesoObjetivo ?? null,
        costo_compra_cop: nuevo.costoCompra ?? null,
        precio_compra_kg_cop: nuevo.precioCompraKg ?? null,
        lote_id: nuevo.loteId ?? null,
        finca_id: fincaId,
        contrato_id: nuevo.contratoId ?? null,
        dueno: nuevo.dueno?.trim() || null,
        color: nuevo.color?.trim() || null,
      },
    });
    if (error) throw error;
    return data;
  });
}

// Spec 016 · R1: editar los datos del animal (no el peso ni la fecha de ingreso: son el primer pesaje).
export function useEditarAnimal() {
  return useMutacionHato(async ({ id, cambios }) => {
    const fila = {
      numero_interno: cambios.numeroInterno.trim(),
      chapeta_ica: cambios.chapetaICA?.trim().toUpperCase() || null,
      sexo: cambios.sexo,
      categoria: cambios.categoria,
      origen: cambios.origen,
      fecha_nacimiento: cambios.fechaNacimiento || null,
      peso_objetivo_kg: cambios.pesoObjetivo ?? null,
      costo_compra_cop: cambios.costoCompra ?? null,
      precio_compra_kg_cop: cambios.precioCompraKg ?? null,
      dueno: cambios.dueno?.trim() || null,
      color: cambios.color?.trim() || null,
    };
    const { data, error } = await supabase.from('animales').update(fila).eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw Object.assign(new Error('sin_permiso'), { code: '42501' });
  });
}

// Spec 016 · R3: dar de baja por muerte o pérdida (conserva historial y costos).
export function useDarDeBaja() {
  return useMutacionHato(async ({ id, estado, fecha, motivo }) => {
    const { error } = await supabase
      .from('animales')
      .update({ estado, fecha_baja: fecha, motivo_baja: motivo?.trim() || null })
      .eq('id', id);
    if (error) throw error;
  });
}

// Verificación Sprint 05 (B8): un animal perdido que aparece vuelve a estar activo.
export function useReactivar() {
  return useMutacionHato(async ({ id }) => {
    const { error } = await supabase.from('animales').update({ estado: 'activo', fecha_baja: null, motivo_baja: null }).eq('id', id);
    if (error) throw error;
  });
}

// Spec 016 · R2: eliminar un animal registrado por error. La base de datos lo impide (23503) si
// ya está en una venta. La foto se borra después; si falla, solo queda un archivo huérfano.
export function useEliminarAnimal() {
  return useMutacionHato(async ({ id, fotoPath }) => {
    const { data, error } = await supabase.from('animales').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw Object.assign(new Error('sin_permiso'), { code: '42501' });
    if (fotoPath) {
      const { borrarFoto } = await import('../lib/fotos');
      await borrarFoto(fotoPath).catch(() => {});
    }
  });
}

// Spec 017: guarda (o quita) la ruta de la foto del animal.
export function useGuardarFoto() {
  return useMutacionHato(async ({ id, fotoPath }) => {
    const { error } = await supabase.from('animales').update({ foto_path: fotoPath }).eq('id', id);
    if (error) throw error;
  });
}

// Spec 016 · R8: venta de un caballo por precio del animal (función SQL vender_equino).
export function useVenderCaballo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fecha, comprador, precioCop, notas }) => {
      const { error } = await supabase.rpc('vender_equino', { animal: id, fecha, comprador: comprador.trim(), precio_cop: precioCop, notas: notas || null });
      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: HATO_KEY });
      queryClient.invalidateQueries({ queryKey: ['venta-caballo', id] });
    },
  });
}

export function useVentaCaballo(animalId, habilitado) {
  return useQuery({
    queryKey: ['venta-caballo', animalId],
    enabled: Boolean(habilitado),
    queryFn: async () => {
      const { data, error } = await supabase.from('ventas_equinos').select('fecha, comprador, precio_cop, notas').eq('animal_id', animalId).maybeSingle();
      if (error) throw error;
      return data ? { fecha: data.fecha, comprador: data.comprador, precioCop: Number(data.precio_cop), notas: data.notas } : null;
    },
  });
}

export function useAddPeso() {
  return useMutacionHato(async ({ animalId, fecha, pesoKg }) => {
    const { error } = await supabase.from('pesajes').insert({ animal_id: animalId, fecha, peso_kg: pesoKg });
    if (error) throw error;
  });
}

export function useAddSanidad() {
  return useMutacionHato(async ({ animalId, fecha, tipo, descripcion }) => {
    const { error } = await supabase.from('eventos_sanitarios').insert({
      animal_id: animalId,
      tipo,
      descripcion: descripcion.trim(),
      estado: 'aplicado',
      fecha_aplicada: fecha,
    });
    if (error) throw error;
  });
}

// Spec 013 · R4: importa animales uno por uno con registrar_animal (cada uno con su pesaje de
// ingreso, todo o nada por animal). Devuelve cuántos se crearon y los errores por número interno.
export function useImportarAnimales() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ animales, onProgreso }) => {
      const finca = await fincaPropiaId();
      let creados = 0;
      const fallidos = [];
      for (const a of animales) {
        const { error } = await supabase.rpc('registrar_animal', {
          datos: {
            numero_interno: a.numeroInterno,
            chapeta_ica: a.chapetaICA,
            sexo: a.sexo,
            categoria: a.categoria,
            origen: 'compra',
            fecha_ingreso: a.fechaIngreso,
            peso_ingreso_kg: a.pesoIngreso,
            peso_objetivo_kg: a.pesoObjetivo,
            costo_compra_cop: a.costoCompra,
            lote_id: a.loteId,
            finca_id: finca,
            contrato_id: null,
          },
        });
        if (error) fallidos.push({ numeroInterno: a.numeroInterno, error });
        else creados += 1;
        onProgreso?.(creados + fallidos.length);
      }
      return { creados, fallidos };
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: HATO_KEY }),
  });
}
