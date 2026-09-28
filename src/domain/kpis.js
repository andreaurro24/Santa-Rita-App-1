// Spec 012 · R1: indicadores del proyecto frente a la línea base AS-IS (docs/plan.md §8).
import { fechaUltimoPesaje } from './breakeven';
import { diasEntre } from './gdp';
import { siguioRecomendacion } from './decision';

export const LINEA_BASE = {
  registroDigital: '0 % (papel y WhatsApp)',
  historialPeso: '0 % consultable',
  diasEstadoLote: '1 día de pesaje físico para reconstruirlo',
  fuentes: '0 (consulta manual dispersa)',
  ventasConReporte: 'No existe reporte',
};

export function calcularKpis({ animales, lotes, ventas, hoy, fuentes }) {
  const activos = animales.filter((a) => a.estado === 'Activo');
  const conRegistro = activos.filter((a) => a.numeroInterno && a.chapetaICA);
  const conHistorial = activos.filter((a) => new Set((a.pesos ?? []).map((p) => p.fecha)).size >= 2);

  const porLote = lotes
    .filter((l) => l.estado !== 'vendido' && l.estado !== 'cerrado')
    .map((l) => {
      const suyos = activos.filter((a) => a.loteId === l.id);
      const ultimo = suyos.map(fechaUltimoPesaje).filter(Boolean).sort().at(-1) ?? null;
      return { id: l.id, nombre: l.nombre, animales: suyos.length, ultimoPesaje: ultimo, dias: ultimo ? diasEntre(ultimo, hoy) : null };
    })
    .filter((l) => l.animales > 0);

  const conRecomendacion = ventas.filter((v) => v.recomendacion?.recomendacion);
  const siguieron = conRecomendacion.filter((v) => siguioRecomendacion(v.recomendacion.recomendacion));

  const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
  return {
    activos: activos.length,
    registroDigitalPct: pct(conRegistro.length, activos.length),
    historialPesoPct: pct(conHistorial.length, activos.length),
    conHistorial: conHistorial.length,
    porLote,
    fuentesActivas: fuentes.filter((f) => f.activa).length,
    fuentes,
    ventas: ventas.length,
    ventasConRecomendacion: conRecomendacion.length,
    ventasQueSiguieron: siguieron.length,
  };
}
