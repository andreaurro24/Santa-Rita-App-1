import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Spec 001 · R4/R8: el hato se lee de Supabase y se entrega a las páginas con la MISMA forma
// que tenía en el MVP con localStorage (camelCase, pesos y sanidad embebidos), para mantener
// la paridad sin reescribir las pantallas.

const HATO_KEY = ['hato'];

const SELECT_ANIMALES = `
  id, numero_interno, chapeta_ica, marca_finca, sexo, categoria, origen, fecha_ingreso,
  fecha_nacimiento, peso_ingreso_kg, peso_objetivo_kg, costo_compra_cop, estado,
  lote:lotes ( id, codigo, nombre, tipo ),
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
    numeroInterno: row.numero_interno,
    chapetaICA: row.chapeta_ica,
    marcaFinca: row.marca_finca,
    sexo: row.sexo,
    categoria: row.categoria,
    origen: capitalizar(row.origen),
    fechaIngreso: row.fecha_ingreso,
    pesoIngreso: Number(row.peso_ingreso_kg),
    pesoObjetivo: Number(row.peso_objetivo_kg),
    costoCompra: row.costo_compra_cop != null ? Number(row.costo_compra_cop) : null,
    lote: row.lote?.codigo,
    loteId: row.lote?.id,
    loteNombre: row.lote?.nombre,
    loteTipo: row.lote?.tipo,
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

async function fetchHato() {
  const { data, error } = await supabase.from('animales').select(SELECT_ANIMALES).order('numero_interno');
  if (error) throw error;
  const animales = data.map(mapAnimal);
  return { animales, lotes: agruparLotes(animales) };
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
        etiqueta: `${c.tenedor?.nombre} – ${c.tenedor?.finca?.nombre ?? 'sin finca'} (${Number(c.porcentaje_ganancia)} %)`,
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
export function useAddAnimal() {
  return useMutacionHato(async (nuevo) => {
    const fincaId = nuevo.contratoId ? nuevo.fincaId : await fincaPropiaId();
    // Animal + pesaje de ingreso en una sola transacción (función SQL registrar_animal).
    const { data, error } = await supabase.rpc('registrar_animal', {
      datos: {
        numero_interno: nuevo.numeroInterno.trim(),
        chapeta_ica: nuevo.chapetaICA.trim().toUpperCase(),
        sexo: nuevo.sexo,
        categoria: nuevo.categoria,
        origen: 'compra',
        fecha_ingreso: nuevo.fechaIngreso,
        peso_ingreso_kg: nuevo.pesoIngreso,
        peso_objetivo_kg: nuevo.pesoObjetivo,
        costo_compra_cop: nuevo.costoCompra,
        lote_id: nuevo.loteId,
        finca_id: fincaId,
        contrato_id: nuevo.contratoId ?? null,
      },
    });
    if (error) throw error;
    return data;
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
