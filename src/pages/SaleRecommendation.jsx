import { useState } from 'react';
import { Info } from 'lucide-react';
import { useAnalisisLotes, useAnalisisLote } from '../data/analisis';
import { ConDatos } from '../components/EstadoCarga';
import AnalisisVenta from '../components/AnalisisVenta';
import Card from '../components/ui/Card';
import { Field, Select } from '../components/ui/Field';
import CampoPesos from '../components/ui/CampoPesos';
import { pesosANumero } from '../utils/validar';

// Spec 010 · recomendación de venta v2.
export default function SaleRecommendation() {
  const datos = useAnalisisLotes();
  return <ConDatos queries={datos.queries}>{() => <RecomendacionContenido datos={datos} />}</ConDatos>;
}

function RecomendacionContenido({ datos }) {
  const lotes = datos.lotes.data.filter((l) => l.estado !== 'vendido' && l.estado !== 'cerrado');
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '');
  const [precioManual, setPrecioManual] = useState('');
  const analisis = useAnalisisLote(datos, loteId, pesosANumero(precioManual));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">¿Vendo?</h1>
        <p className="text-base text-gray-600">¿Vender hoy o esperar? Con el costo real del lote, el precio de la zona y el pasto.</p>
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
          <Field label="Probar con otro precio por kilo">
            <CampoPesos placeholder="Precio de la zona" value={precioManual} onChange={setPrecioManual} />
          </Field>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-600">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Vacío: cada animal se calcula con el precio de la zona para su categoría. Escribe un precio para probar otro.
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
