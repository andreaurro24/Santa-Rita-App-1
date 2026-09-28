import { useState } from 'react';
import { Info } from 'lucide-react';
import { useAnalisisLotes, useAnalisisLote } from '../data/analisis';
import { ConDatos } from '../components/EstadoCarga';
import AnalisisVenta from '../components/AnalisisVenta';
import Card from '../components/ui/Card';
import { Field, Input, Select } from '../components/ui/Field';

// Spec 010 · recomendación de venta v2.
export default function SaleRecommendation() {
  const datos = useAnalisisLotes();
  return <ConDatos queries={datos.queries}>{() => <RecomendacionContenido datos={datos} />}</ConDatos>;
}

function RecomendacionContenido({ datos }) {
  const lotes = datos.lotes.data.filter((l) => l.estado !== 'vendido' && l.estado !== 'cerrado');
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '');
  const [precioManual, setPrecioManual] = useState('');
  const analisis = useAnalisisLote(datos, loteId, precioManual);
  const precioActual = datos.precios.data.precioActual;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Recomendación de venta</h1>
        <p className="text-sm text-gray-500">¿Vender hoy o esperar? Con el costo real del lote, la parte de los tenedores, el pasto y el clima.</p>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr]">
          <Field label="Lote a evaluar">
            <Select value={loteId} onChange={(e) => setLoteId(e.target.value)}>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Precio de mercado (COP/kg)">
            <Input
              type="text"
              inputMode="numeric"
              placeholder={precioActual ? String(precioActual.precioCOP) : 'Sin precio registrado'}
              value={precioManual}
              onChange={(e) => setPrecioManual(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-500">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> Si lo dejas vacío usa el último precio registrado. Cámbialo para simular otro escenario.
        </p>
      </Card>

      {analisis && (
        <Card titulo={analisis.lote.nombre}>
          <AnalisisVenta analisis={analisis} />
        </Card>
      )}
    </div>
  );
}
