import { useState } from 'react';
import { Printer } from 'lucide-react';
import { useAnalisisLotes, useAnalisisLote } from '../data/analisis';
import { ConDatos } from '../components/EstadoCarga';
import { useAuth } from '../context/AuthContext';
import { formatFecha, hoyISO } from '../utils/format';
import AnalisisVenta from '../components/AnalisisVenta';
import MarcaSR from '../components/MarcaSR';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Field';

// Spec 010 · R8: reporte imprimible con el motor v2.
export default function Report() {
  const datos = useAnalisisLotes();
  return <ConDatos queries={datos.queries}>{() => <ReporteContenido datos={datos} />}</ConDatos>;
}

function ReporteContenido({ datos }) {
  const { user } = useAuth();
  const lotes = datos.lotes.data.filter((l) => l.estado !== 'vendido' && l.estado !== 'cerrado');
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '');
  const [notas, setNotas] = useState('');
  const analisis = useAnalisisLote(datos, loteId, '');

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
            <Select value={loteId} onChange={(e) => setLoteId(e.target.value)}>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
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

      {analisis && (
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
              <p>Generado el {formatFecha(hoyISO())}</p>
              <p>Por {user?.nombre}</p>
            </div>
          </header>

          <h2 className="mb-4 text-2xl font-bold text-gray-900">{analisis.lote.nombre}</h2>
          <AnalisisVenta analisis={analisis} detallesAbiertos />

          {notas && (
            <>
              <h3 className="mb-2 mt-6 text-lg font-bold text-gray-900">Notas</h3>
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
