import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Spec 007 · tenedores, contratos "Al partir" y visitas de verificación (D8).

export function useContratos() {
  return useQuery({
    queryKey: ['contratos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos_al_partir')
        .select(
          `id, fecha_inicio, precio_animal_cop, precio_kg_cop, porcentaje_ganancia, estado,
           tenedor:tenedores ( id, nombre, telefono, finca_id, finca:fincas ( nombre ) ),
           visitas:visitas_verificacion ( id, fecha )`,
        )
        .order('estado', { ascending: false })
        .order('fecha_inicio', { ascending: false });
      if (error) throw error;
      return data.map((c) => ({
        id: c.id,
        fechaInicio: c.fecha_inicio,
        precioAnimalCop: c.precio_animal_cop != null ? Number(c.precio_animal_cop) : null,
        precioKgCop: c.precio_kg_cop,
        porcentaje: Number(c.porcentaje_ganancia),
        estado: c.estado,
        tenedor: {
          id: c.tenedor?.id,
          nombre: c.tenedor?.nombre,
          telefono: c.tenedor?.telefono,
          fincaId: c.tenedor?.finca_id,
          fincaNombre: c.tenedor?.finca?.nombre ?? null,
        },
        ultimaVisita: (c.visitas ?? []).map((v) => v.fecha).sort().at(-1) ?? null,
      }));
    },
  });
}

export function useTenedores() {
  return useQuery({
    queryKey: ['tenedores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenedores').select('id, nombre, telefono, finca_id').order('nombre');
      if (error) throw error;
      return data.map((t) => ({ id: t.id, nombre: t.nombre, telefono: t.telefono, fincaId: t.finca_id }));
    },
  });
}

function useInvalidar() {
  const queryClient = useQueryClient();
  return (...claves) => claves.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
}

// R1: crea o edita un tenedor. Si no tiene finca, se crea una finca de tipo "tenedor" con el nombre dado.
export function useGuardarTenedor() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ id, nombre, telefono, fincaId, fincaNueva }) => {
      let finca = fincaId || null;
      if (!finca && fincaNueva?.trim()) {
        const { data, error } = await supabase.from('fincas').insert({ nombre: fincaNueva.trim(), tipo: 'tenedor' }).select('id').single();
        if (error) throw error;
        finca = data.id;
      }
      const fila = { nombre: nombre.trim(), telefono: telefono?.trim() || null, finca_id: finca };
      const { data, error } = id
        ? await supabase.from('tenedores').update(fila).eq('id', id).select('id').single()
        : await supabase.from('tenedores').insert(fila).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => invalidar('tenedores', 'contratos', 'fincas'),
  });
}

// R2: crea o edita un contrato.
export function useGuardarContrato() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (c) => {
      const fila = {
        tenedor_id: c.tenedorId,
        fecha_inicio: c.fechaInicio || null,
        precio_animal_cop: c.precioAnimalCop === '' || c.precioAnimalCop == null ? null : Number(c.precioAnimalCop),
        precio_kg_cop: c.precioKgCop === '' || c.precioKgCop == null ? null : Number(c.precioKgCop),
        porcentaje_ganancia: Number(c.porcentaje),
        estado: c.estado,
      };
      const { data, error } = c.id
        ? await supabase.from('contratos_al_partir').update(fila).eq('id', c.id).select('id').single()
        : await supabase.from('contratos_al_partir').insert(fila).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => invalidar('contratos', 'contratos-vigentes', 'hato'),
  });
}

// R3: asigna animales a un contrato vigente (función SQL atómica).
export function useAsignarAContrato() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ ids, contratoId, fecha, motivo }) => {
      const { error } = await supabase.rpc('asignar_a_contrato', { ids, contrato: contratoId, fecha, motivo: motivo.trim() });
      if (error) throw error;
    },
    onSuccess: () => invalidar('hato', 'contratos', 'movimientos', 'historia-lotes'),
  });
}

// R5, R6: visitas de un contrato con lo revisado de cada animal.
export function useVisitas(contratoId) {
  return useQuery({
    queryKey: ['visitas', contratoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitas_verificacion')
        .select('id, fecha, notas, revisiones:visita_animales ( animal_id, encontrado, pesaje:pesajes ( peso_kg ) )')
        .eq('contrato_id', contratoId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((v) => ({
        id: v.id,
        fecha: v.fecha,
        notas: v.notas,
        revisiones: (v.revisiones ?? []).map((r) => ({
          animalId: r.animal_id,
          encontrado: r.encontrado,
          pesoKg: r.pesaje?.peso_kg != null ? Number(r.pesaje.peso_kg) : null,
        })),
      }));
    },
  });
}

export function useRegistrarVisita() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ contratoId, fecha, notas, revisiones }) => {
      const { error } = await supabase.rpc('registrar_visita', {
        contrato: contratoId,
        fecha,
        notas,
        revisiones: revisiones.map((r) => ({ animal_id: r.animalId, peso_kg: r.pesoKg })),
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar('visitas', 'contratos', 'hato'),
  });
}

// Visitas en las que se revisó un animal (para su ficha): fecha, tenedor y si se encontró.
export function useVisitasAnimal(animalId) {
  return useQuery({
    queryKey: ['visitas', 'animal', animalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visita_animales')
        .select('encontrado, pesaje:pesajes ( peso_kg ), visita:visitas_verificacion ( fecha, contrato:contratos_al_partir ( tenedor:tenedores ( nombre ) ) )')
        .eq('animal_id', animalId);
      if (error) throw error;
      return data
        .map((r) => ({
          fecha: r.visita?.fecha,
          tenedor: r.visita?.contrato?.tenedor?.nombre ?? null,
          encontrado: r.encontrado,
          pesoKg: r.pesaje?.peso_kg != null ? Number(r.pesaje.peso_kg) : null,
        }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
    },
  });
}
