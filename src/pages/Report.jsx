import { useEffect, useMemo, useState } from 'react';
import { Printer, Sprout } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { analizarLote, formatCOP } from '../utils/breakeven';
import { fetchClimaFinca, describeWeatherCode } from '../api/weather';
import { fetchTRM } from '../api/trm';
import { formatFecha } from '../utils/format';
import RecomendacionBadge from '../components/RecomendacionBadge';

export default function Report() {
  const { lotes, precioActual } = useData();
  const { user } = useAuth();
  const [loteCodigo, setLoteCodigo] = useState(lotes[0]?.codigo ?? '');
  const [clima, setClima] = useState(null);
  const [trm, setTrm] = useState(null);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchClimaFinca({ signal: controller.signal }).then(setClima);
    fetchTRM({ signal: controller.signal }).then(setTrm);
    return () => controller.abort();
  }, []);

  const lote = lotes.find((l) => l.codigo === loteCodigo) ?? lotes[0];
  const analisis = useMemo(() => {
    if (!lote) return null;
    return analizarLote(lote.animales, { precioMercadoCOP: precioActual?.precioCOP ?? 0, clima });
  }, [lote, precioActual, clima]);

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reporte resumen de apoyo a la decisión</h1>
          <p className="text-sm text-gray-500">Genera un reporte imprimible/exportable a PDF para compartir con los dueños.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Printer size={16} /> Imprimir / Exportar PDF
        </button>
      </div>

      <div className="no-print flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Lote</span>
          <select value={loteCodigo} onChange={(e) => setLoteCodigo(e.target.value)} className="input min-w-[260px]">
            {lotes.map((l) => (
              <option key={l.codigo} value={l.codigo}>
                {l.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm flex-1 min-w-[260px]">
          <span className="mb-1 block font-medium text-gray-700">Notas adicionales (aparecen en el reporte)</span>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} className="input" placeholder="Ej. Comprador contactado, pendiente confirmar fecha de recogida…" />
        </label>
      </div>

      {lote && analisis && (
        <div className="print-area rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <header className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2">
              <Sprout className="text-brand-700" size={22} />
              <div>
                <p className="font-semibold text-gray-900">Finca Santa Rita — Badillo, Cesar</p>
                <p className="text-xs text-gray-500">Reporte de apoyo a la decisión de venta</p>
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>Generado: {formatFecha(hoy)}</p>
              <p>Por: {user?.nombre}</p>
            </div>
          </header>

          <h2 className="mb-1 text-lg font-semibold text-gray-900">{lote.nombre}</h2>
          <p className="mb-4 text-sm text-gray-500">{analisis.nAnimales} reses activas evaluadas</p>

          <div className="mb-6 flex items-center gap-4">
            <RecomendacionBadge recomendacion={analisis.recomendacion} size="lg" />
            <div className="text-sm text-gray-600">
              {analisis.avancePct}% de avance hacia la meta pactada ({analisis.pesoPromedioActual} kg / {analisis.pesoObjetivoPromedio} kg)
            </div>
          </div>

          <table className="mb-6 w-full text-sm">
            <tbody>
              <ReportRow label="Costo promedio de compra" value={analisis.costoPromedioCompra ? `$${formatCOP(analisis.costoPromedioCompra)} COP` : 'N/A (cría propia)'} />
              <ReportRow label="Punto de equilibrio" value={analisis.precioEquilibrioCOPkg ? `$${formatCOP(analisis.precioEquilibrioCOPkg)} COP/kg` : '—'} />
              <ReportRow label="Precio de mercado vigente" value={`$${formatCOP(analisis.precioMercadoCOP)} COP/kg (${precioActual ? formatFecha(precioActual.fecha) : '—'})`} />
              <ReportRow label="Margen estimado por kilo" value={analisis.margenPorKgCOP != null ? `$${formatCOP(analisis.margenPorKgCOP)} COP` : '—'} />
              <ReportRow label="Margen estimado del lote completo" value={analisis.margenTotalEstimadoCOP != null ? `$${formatCOP(analisis.margenTotalEstimadoCOP)} COP` : '—'} />
              <ReportRow label="TRM del día" value={trm ? `$${formatCOP(trm.valor)} COP/USD` : '—'} />
              <ReportRow
                label="Clima (7 días)"
                value={clima ? `${describeWeatherCode(clima.actual.codigo)}, ${clima.resumenLluvia7d}mm acumulados` : '—'}
              />
            </tbody>
          </table>

          <h3 className="mb-2 font-semibold text-gray-900">Justificación</h3>
          <ul className="mb-6 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {analisis.razones.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>

          {notas && (
            <>
              <h3 className="mb-2 font-semibold text-gray-900">Notas</h3>
              <p className="mb-6 text-sm text-gray-700">{notas}</p>
            </>
          )}

          <div className="mt-10 grid grid-cols-2 gap-8 border-t border-gray-100 pt-6 text-sm">
            <div>
              <p className="mb-8 border-b border-gray-300" />
              <p className="text-gray-500">Miguel Ángel Lacouture — Decisión final</p>
            </div>
            <div>
              <p className="mb-8 border-b border-gray-300" />
              <p className="text-gray-500">Fecha</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportRow({ label, value }) {
  return (
    <tr className="border-b border-gray-50">
      <td className="py-1.5 pr-4 text-gray-500">{label}</td>
      <td className="py-1.5 text-right font-medium text-gray-800">{value}</td>
    </tr>
  );
}
