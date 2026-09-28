import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { useHato } from '../data/hato';
import { usePrecios } from '../data/precios';
import { useClima } from '../data/externos';
import { ConDatos } from '../components/EstadoCarga';
import { analizarLote, formatCOP } from '../domain/breakeven';
import RecomendacionBadge from '../components/RecomendacionBadge';
import Card from '../components/ui/Card';
import Stat from '../components/ui/Stat';
import { Field, Input, Select } from '../components/ui/Field';

export default function SaleRecommendation() {
  const hato = useHato();
  const precios = usePrecios();
  return (
    <ConDatos queries={[hato, precios]}>
      {() => <RecomendacionContenido lotes={hato.data.lotes} precioActual={precios.data.precioActual} />}
    </ConDatos>
  );
}

function RecomendacionContenido({ lotes, precioActual }) {
  const [loteCodigo, setLoteCodigo] = useState(lotes[0]?.codigo ?? '');
  const [precioManual, setPrecioManual] = useState('');
  const { data: clima } = useClima();

  const lote = lotes.find((l) => l.codigo === loteCodigo) ?? lotes[0];
  const precioMercadoCOP = Number(precioManual) || precioActual?.precioCOP || 0;

  const analisis = useMemo(() => {
    if (!lote) return null;
    return analizarLote(lote.animales, { precioMercadoCOP, clima });
  }, [lote, precioMercadoCOP, clima]);

  const tono = (n) => (n > 0 ? 'ok' : n < 0 ? 'peligro' : 'neutro');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Recomendación de venta</h1>
        <p className="text-sm text-gray-500">Compara el peso y el costo del lote contra su meta pactada y el precio de hoy.</p>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr]">
          <Field label="Lote a evaluar">
            <Select value={loteCodigo} onChange={(e) => setLoteCodigo(e.target.value)}>
              {lotes.map((l) => (
                <option key={l.codigo} value={l.codigo}>
                  {l.nombre} ({l.animales.length} reses)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Precio de mercado (COP/kg)">
            <Input
              type="number"
              inputMode="numeric"
              placeholder={precioActual ? String(precioActual.precioCOP) : '0'}
              value={precioManual}
              onChange={(e) => setPrecioManual(e.target.value)}
            />
          </Field>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-500">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> Si lo dejas vacío usa el último precio registrado. Cámbialo para simular otro escenario.
        </p>
      </Card>

      {analisis && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-gray-900">{lote.nombre}</h2>
              <RecomendacionBadge recomendacion={analisis.recomendacion} size="lg" />
            </div>

            <div className="mb-5">
              <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-gray-600">Avance hacia la meta de peso</span>
                <span className="font-semibold text-gray-900">
                  {analisis.pesoPromedioActual} de {analisis.pesoObjetivoPromedio} kg ({analisis.avancePct} %)
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, analisis.avancePct)}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
              <Stat label="Reses en el lote" value={analisis.nAnimales} />
              <Stat label="Costo promedio de compra" value={analisis.costoPromedioCompra ? `$${formatCOP(analisis.costoPromedioCompra)}` : '—'} />
              <Stat label="Punto de equilibrio" value={analisis.precioEquilibrioCOPkg ? `$${formatCOP(analisis.precioEquilibrioCOPkg)}/kg` : '—'} />
              <Stat label="Precio de mercado" value={`$${formatCOP(analisis.precioMercadoCOP)}/kg`} />
              <Stat
                label="Margen por kilo"
                value={analisis.margenPorKgCOP != null ? `$${formatCOP(analisis.margenPorKgCOP)}` : '—'}
                tono={tono(analisis.margenPorKgCOP)}
              />
              <Stat
                label="Margen del lote"
                value={analisis.margenTotalEstimadoCOP != null ? `$${formatCOP(analisis.margenTotalEstimadoCOP)}` : '—'}
                tono={tono(analisis.margenTotalEstimadoCOP)}
              />
            </div>
          </Card>

          <Card titulo="Por qué">
            <ul className="space-y-3">
              {analisis.razones.map((r) => (
                <li key={r} className="flex gap-2 text-sm text-gray-700">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                  {r}
                </li>
              ))}
            </ul>
            {clima?.isFallback && (
              <p className="mt-4 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
                El pronóstico usa datos de respaldo porque no hay conexión con Open-Meteo; la alerta de sequía no se aplica.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
