import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { useHato } from '../data/hato';
import { usePrecios } from '../data/precios';
import { useClima, useTRM } from '../data/externos';
import { ConDatos } from '../components/EstadoCarga';
import { useAuth } from '../context/AuthContext';
import { analizarLote, formatCOP } from '../domain/breakeven';
import { describeWeatherCode } from '../api/weather';
import { formatFecha, hoyISO } from '../utils/format';
import RecomendacionBadge from '../components/RecomendacionBadge';
import MarcaSR from '../components/MarcaSR';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Field';

export default function Report() {
  const hato = useHato();
  const precios = usePrecios();
  return (
    <ConDatos queries={[hato, precios]}>
      {() => <ReporteContenido lotes={hato.data.lotes} precioActual={precios.data.precioActual} />}
    </ConDatos>
  );
}

function ReporteContenido({ lotes, precioActual }) {
  const { user } = useAuth();
  const [loteCodigo, setLoteCodigo] = useState(lotes[0]?.codigo ?? '');
  const [notas, setNotas] = useState('');
  const { data: clima } = useClima();
  const { data: trm } = useTRM();

  const lote = lotes.find((l) => l.codigo === loteCodigo) ?? lotes[0];
  const analisis = useMemo(() => {
    if (!lote) return null;
    return analizarLote(lote.animales, { precioMercadoCOP: precioActual?.precioCOP ?? 0, clima });
  }, [lote, precioActual, clima]);

  const hoy = hoyISO();

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reporte resumen de apoyo a la decisión</h1>
          <p className="text-sm text-gray-500">Un resumen para imprimir o guardar en PDF y compartir con los dueños.</p>
        </div>
        <Button icono={Printer} onClick={() => window.print()}>
          Imprimir o guardar PDF
        </Button>
      </div>

      <Card className="no-print">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Lote">
            <Select value={loteCodigo} onChange={(e) => setLoteCodigo(e.target.value)}>
              {lotes.map((l) => (
                <option key={l.codigo} value={l.codigo}>
                  {l.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notas para el reporte">
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Por ejemplo: comprador contactado, falta confirmar la fecha" />
          </Field>
        </div>
      </Card>

      {lote && analisis && (
        <article className="print-area rounded-xl border border-gray-200 bg-white p-5 md:p-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
            <div className="flex items-center gap-3">
              <MarcaSR className="size-10 text-brand-700" />
              <div>
                <p className="font-display text-lg font-bold text-gray-900">Finca Santa Rita, Badillo (Cesar)</p>
                <p className="text-sm text-gray-600">Apoyo a la decisión de venta</p>
              </div>
            </div>
            <div className="text-sm text-gray-600 md:text-right">
              <p>Generado el {formatFecha(hoy)}</p>
              <p>Por {user?.nombre}</p>
            </div>
          </header>

          <h2 className="text-2xl font-bold text-gray-900">{lote.nombre}</h2>
          <p className="mb-4 text-sm text-gray-600">{analisis.nAnimales} reses activas evaluadas</p>

          <div className="mb-6 flex flex-wrap items-center gap-4">
            <RecomendacionBadge recomendacion={analisis.recomendacion} size="lg" />
            <p className="text-sm text-gray-700">
              {analisis.avancePct} % de la meta pactada ({analisis.pesoPromedioActual} de {analisis.pesoObjetivoPromedio} kg)
            </p>
          </div>

          <table className="mb-6 w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <ReportRow label="Costo promedio de compra" value={analisis.costoPromedioCompra ? `$${formatCOP(analisis.costoPromedioCompra)}` : 'No aplica (cría propia)'} />
              <ReportRow label="Punto de equilibrio" value={analisis.precioEquilibrioCOPkg ? `$${formatCOP(analisis.precioEquilibrioCOPkg)} por kg` : '—'} />
              <ReportRow
                label="Precio de mercado"
                value={`$${formatCOP(analisis.precioMercadoCOP)} por kg${precioActual ? ` (${formatFecha(precioActual.fecha)})` : ''}`}
              />
              <ReportRow label="Margen por kilo" value={analisis.margenPorKgCOP != null ? `$${formatCOP(analisis.margenPorKgCOP)}` : '—'} />
              <ReportRow label="Margen del lote completo" value={analisis.margenTotalEstimadoCOP != null ? `$${formatCOP(analisis.margenTotalEstimadoCOP)}` : '—'} />
              <ReportRow label="TRM del día" value={trm ? `$${formatCOP(trm.valor)} por dólar` : '—'} />
              <ReportRow label="Clima (7 días)" value={clima ? `${describeWeatherCode(clima.actual.codigo)}, ${clima.resumenLluvia7d} mm de lluvia` : '—'} />
            </tbody>
          </table>

          <h3 className="mb-2 text-lg font-bold text-gray-900">Justificación</h3>
          <ul className="mb-6 list-disc space-y-1 pl-5 text-sm text-gray-800">
            {analisis.razones.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>

          {notas && (
            <>
              <h3 className="mb-2 text-lg font-bold text-gray-900">Notas</h3>
              <p className="mb-6 text-sm text-gray-800">{notas}</p>
            </>
          )}

          <div className="mt-10 grid grid-cols-2 gap-8 border-t border-gray-200 pt-8 text-sm">
            <div>
              <p className="mb-8 border-b border-gray-400" />
              <p className="text-gray-600">Miguel Ángel Lacouture, decisión final</p>
            </div>
            <div>
              <p className="mb-8 border-b border-gray-400" />
              <p className="text-gray-600">Fecha</p>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}

function ReportRow({ label, value }) {
  return (
    <tr>
      <td className="py-2 pr-4 text-gray-600">{label}</td>
      <td className="py-2 text-right font-semibold text-gray-900">{value}</td>
    </tr>
  );
}
