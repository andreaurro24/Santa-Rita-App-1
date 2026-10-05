import { ChevronDown } from 'lucide-react';
import { formatCOP } from '../domain/breakeven';
import { formatFecha, formatKg, formatPct } from '../utils/format';
import RecomendacionBadge from './RecomendacionBadge';
import Stat from './ui/Stat';
import { ETIQUETA_PASTO } from '../domain/pasto';

const pesos = (n) => (n == null ? '—' : `${n < 0 ? '−' : ''}$${formatCOP(Math.round(Math.abs(n)))}`);
const kg = (n) => formatKg(Math.round(n));
const tono = (n) => (n > 0 ? 'ok' : n < 0 ? 'peligro' : 'neutro');
const cuando = (semanas) => (semanas === 0 ? 'Hoy' : `En ${semanas} semanas`);

// Spec 010 · el análisis v2 de un lote. Spec 015 · R5: primero la respuesta en grande (qué hacer,
// por qué en una frase, margen y precio); las cifras, escenarios y razones van en "Ver detalles".
// En el reporte imprimible (`detallesAbiertos`) todo sale abierto.
export default function AnalisisVenta({ analisis, detallesAbiertos = false }) {
  const { resultado: r, destarePct, pasto, precioSimulado } = analisis;
  if (r.recomendacion === 'SIN_DATOS') {
    return (
      <div className="space-y-3">
        <RecomendacionBadge recomendacion={r.recomendacion} size="lg" />
        <ul className="list-disc space-y-1 pl-5 text-base text-gray-800">
          {r.razones.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
    );
  }
  const mejor = r.escenarios.reduce((m, e) => (e.margenNeto > m.margenNeto ? e : m), r.escenarios[0]);
  const precioHoy = r.hoy.precioMedio;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <RecomendacionBadge recomendacion={r.recomendacion} size="lg" />
        <p className="max-w-prose text-lg font-semibold leading-snug text-gray-900">{r.razones[0]}</p>
        <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4">
          <Stat label="Margen para Santa Rita hoy" value={pesos(r.hoy.margenNeto)} tono={tono(r.hoy.margenNeto)} />
          <Stat label="Precio del kilo" value={`${pesos(precioHoy)}/kg`} sub={precioSimulado ? 'Precio simulado' : 'Precio de la zona (promedio)'} />
        </div>
      </div>

      <details open={detallesAbiertos} className="group rounded-xl border border-gray-200">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-4 text-base font-semibold text-brand-800 [&::-webkit-details-marker]:hidden">
          Ver detalles
          <ChevronDown size={20} className="transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-6 border-t border-gray-200 px-4 py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Reses para vender" value={r.nAnimales} sub={r.excluidos ? `${r.excluidos} ${r.excluidos === 1 ? 'vientre excluido' : 'vientres excluidos'}` : undefined} />
            <Stat
              label="Peso promedio"
              value={kg(r.pesoPromedio)}
              sub={r.meta ? `${formatPct(Math.round(r.avancePct))} de la meta (${kg(r.meta)})` : 'Sin peso objetivo'}
            />
            <Stat label="Punto de equilibrio real" value={`${pesos(r.hoy.equilibrioKg)}/kg`} sub={`Destare ${formatPct(destarePct)}`} />
            <Stat label="Parte de los tenedores" value={pesos(r.hoy.participacion)} />
            <Stat label="Costo acumulado" value={pesos(r.hoy.costo)} sub="Compra y gastos" />
            <Stat label="Gasto diario del lote" value={pesos(r.gastoDiario)} sub="Promedio de 90 días" />
          </div>

          <div>
            <h3 className="mb-2 text-lg font-bold text-gray-900">Vender hoy o esperar</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 text-left text-gray-600">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Cuándo</th>
                    <th className="py-2 pr-3 text-right font-medium">Peso a pagar</th>
                    <th className="hidden py-2 pr-3 text-right font-medium md:table-cell print:table-cell">Ingreso</th>
                    <th className="hidden py-2 pr-3 text-right font-medium md:table-cell print:table-cell">Costo</th>
                    <th className="py-2 text-right font-medium">Margen neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {r.escenarios.map((e) => (
                    <tr key={e.semanas} className={e === mejor ? 'bg-ok-50' : ''}>
                      <td className="py-2 pr-3 font-medium text-gray-900">
                        {cuando(e.semanas)}
                        {e === mejor && <span className="ml-1 text-xs font-normal text-gray-600">(el mejor)</span>}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-700">{kg(e.pesoVendible)}</td>
                      <td className="hidden py-2 pr-3 text-right text-gray-700 md:table-cell print:table-cell">{pesos(e.ingreso)}</td>
                      <td className="hidden py-2 pr-3 text-right text-gray-700 md:table-cell print:table-cell">{pesos(e.costo + e.participacion)}</td>
                      <td className={`cifra py-2 text-right text-base font-bold ${e.margenNeto >= 0 ? 'text-gray-900' : 'text-peligro'}`}>{pesos(e.margenNeto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              El peso futuro usa la ganancia diaria de cada animal y el costo suma el gasto diario del lote. El costo incluye la parte de los tenedores.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-bold text-gray-900">Si el precio cambia</h3>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {r.sensibilidad.map((s) => (
                <li key={s.variacion} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <p className="text-gray-600">
                    {s.variacion > 0 ? '+' : '−'}
                    {formatPct(Math.abs(s.variacion * 100))} ({pesos(s.precioKg)}/kg)
                  </p>
                  <p className={`cifra text-base font-bold ${s.margenNeto >= 0 ? 'text-gray-900' : 'text-peligro'}`}>{pesos(s.margenNeto)}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-bold text-gray-900">Por qué</h3>
            <ul className="space-y-2">
              {r.razones.slice(1).map((x) => (
                <li key={x} className="flex gap-2 text-sm text-gray-800">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                  {x}
                </li>
              ))}
              <li className="flex gap-2 text-sm text-gray-600">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden="true" />
                Pasto: {pasto ? `${ETIQUETA_PASTO[pasto.nivel].toLowerCase()} (registrado el ${formatFecha(pasto.fecha)})` : 'sin registro en los últimos 30 días'}.
              </li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}
