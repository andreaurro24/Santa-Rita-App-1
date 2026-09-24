import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Info } from 'lucide-react';
import { useData } from '../context/DataContext';
import { analizarLote, formatCOP } from '../utils/breakeven';
import { fetchClimaFinca } from '../api/weather';
import RecomendacionBadge from '../components/RecomendacionBadge';

export default function SaleRecommendation() {
  const { lotes, precioActual } = useData();
  const [loteCodigo, setLoteCodigo] = useState(lotes[0]?.codigo ?? '');
  const [precioManual, setPrecioManual] = useState('');
  const [clima, setClima] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchClimaFinca({ signal: controller.signal }).then(setClima);
    return () => controller.abort();
  }, []);

  const lote = lotes.find((l) => l.codigo === loteCodigo) ?? lotes[0];
  const precioMercadoCOP = Number(precioManual) || precioActual?.precioCOP || 0;

  const analisis = useMemo(() => {
    if (!lote) return null;
    return analizarLote(lote.animales, { precioMercadoCOP, clima });
  }, [lote, precioMercadoCOP, clima]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Recomendación de venta</h1>
        <p className="text-sm text-gray-500">
          Punto de equilibrio por lote: compara el peso y costo actual contra la meta pactada y el precio de mercado vigente.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Lote a evaluar</span>
          <select
            value={loteCodigo}
            onChange={(e) => setLoteCodigo(e.target.value)}
            className="input min-w-[260px]"
          >
            {lotes.map((l) => (
              <option key={l.codigo} value={l.codigo}>
                {l.nombre} ({l.animales.length} reses)
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Precio de mercado (COP/kg)</span>
          <input
            type="number"
            placeholder={precioActual ? String(precioActual.precioCOP) : '0'}
            value={precioManual}
            onChange={(e) => setPrecioManual(e.target.value)}
            className="input w-40"
          />
        </label>
        <p className="flex items-center gap-1 text-xs text-gray-400">
          <Info size={12} /> Por defecto usa el último precio registrado en Mercado y clima. Cámbialo para simular escenarios.
        </p>
      </div>

      {analisis && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <TrendingUp size={18} className="text-brand-600" /> {lote.nombre}
              </h2>
              <RecomendacionBadge recomendacion={analisis.recomendacion} size="lg" />
            </div>

            <div className="mb-5">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-gray-500">Avance hacia meta de peso</span>
                <span className="font-medium text-gray-700">
                  {analisis.pesoPromedioActual} kg / {analisis.pesoObjetivoPromedio} kg ({analisis.avancePct}%)
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.min(100, analisis.avancePct)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric label="Reses en el lote" value={analisis.nAnimales} />
              <Metric
                label="Costo promedio compra"
                value={analisis.costoPromedioCompra ? `$${formatCOP(analisis.costoPromedioCompra)}` : '—'}
              />
              <Metric
                label="Punto de equilibrio"
                value={analisis.precioEquilibrioCOPkg ? `$${formatCOP(analisis.precioEquilibrioCOPkg)}/kg` : '—'}
              />
              <Metric label="Precio de mercado" value={`$${formatCOP(analisis.precioMercadoCOP)}/kg`} />
              <Metric
                label="Margen por kg"
                value={analisis.margenPorKgCOP != null ? `$${formatCOP(analisis.margenPorKgCOP)}` : '—'}
                tone={analisis.margenPorKgCOP > 0 ? 'good' : analisis.margenPorKgCOP < 0 ? 'bad' : 'default'}
              />
              <Metric
                label="Margen estimado del lote"
                value={analisis.margenTotalEstimadoCOP != null ? `$${formatCOP(analisis.margenTotalEstimadoCOP)}` : '—'}
                tone={analisis.margenTotalEstimadoCOP > 0 ? 'good' : analisis.margenTotalEstimadoCOP < 0 ? 'bad' : 'default'}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 font-semibold text-gray-900">Por qué esta recomendación</h3>
            <ul className="space-y-3">
              {analisis.razones.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  {r}
                </li>
              ))}
            </ul>
            {clima?.isFallback && (
              <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Nota: el pronóstico de clima está usando datos de respaldo (sin conexión en este momento).
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone = 'default' }) {
  const toneClass = {
    default: 'text-gray-900',
    good: 'text-green-700',
    bad: 'text-red-700',
  }[tone];
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
