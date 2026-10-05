import { useState } from 'react';
import { Tags, Pencil } from 'lucide-react';
import { usePreciosReferencia, useAddPrecioReferencia } from '../data/precios';
import { ConDatos } from '../components/EstadoCarga';
import { mensajeError } from '../lib/errores';
import { useAuth } from '../context/AuthContext';
import { EstadoPasto, ParametrosVenta } from '../components/PastoYParametros';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import CampoPesos from '../components/ui/CampoPesos';
import { Field, Input, FormError } from '../components/ui/Field';
import { formatCOP } from '../domain/breakeven';
import { CATEGORIAS_PRECIO, puntoMedio, rangosVigentes } from '../domain/precios';
import { formatFecha, hoyISO } from '../utils/format';
import { numeroAPesos, pesosANumero } from '../utils/validar';

// Spec 021 · precio del ganado en Cesar y La Guajira por categoría, y (spec 009) pasto y destare.
// Spec 015 · R1: sin clima ni TRM.
export default function Market() {
  const referencia = usePreciosReferencia();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Precio y pasto</h1>
        <p className="text-base text-gray-600">El precio del kilo en pie en la zona y el estado de los potreros.</p>
      </div>
      <ConDatos queries={referencia}>{() => <PreciosZona rangos={referencia.data} />}</ConDatos>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EstadoPasto />
        <ParametrosVenta />
      </div>
    </div>
  );
}

function PreciosZona({ rangos }) {
  const { user } = useAuth();
  const puedeEditar = Boolean(user?.rol);
  const vigentes = rangosVigentes(rangos);
  const [editando, setEditando] = useState(null);
  const fuentes = [...new Set([...vigentes.values()].map((r) => r.fuente))];

  return (
    <Card titulo="Precio del kilo en Cesar y La Guajira" icono={Tags}>
      <p className="mb-3 text-base text-gray-700">No hay un precio fijo: se negocia en un rango que depende de la edad y el tipo de animal. La recomendación usa la mitad del rango.</p>
      <ul className="divide-y divide-gray-100">
        {CATEGORIAS_PRECIO.map((c) => {
          const r = vigentes.get(c.valor);
          return (
            <li key={c.valor} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-gray-900">{c.label}</p>
                <p className="text-sm text-gray-600">{r ? `Actualizado el ${formatFecha(r.fecha)}` : 'Sin precio registrado'}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="cifra text-right text-xl font-bold text-gray-900">
                  {r ? `$${formatCOP(r.precioMin)} – $${formatCOP(r.precioMax)}` : '—'}
                  {r && <span className="block text-sm font-normal text-gray-600">Mitad: ${formatCOP(puntoMedio(r))}/kg</span>}
                </p>
                {puedeEditar && (
                  <Button variante="secundario" tamano="sm" icono={Pencil} aria-label={`Actualizar ${c.label}`} onClick={() => setEditando({ categoria: c, actual: r })}>
                    <span className="hidden sm:inline">Actualizar</span>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {fuentes.length > 0 && <p className="mt-3 text-sm text-gray-600">Fuente: {fuentes.join(' · ')}</p>}
      {editando && <RangoForm {...editando} onClose={() => setEditando(null)} />}
    </Card>
  );
}

// R2: nuevo rango (queda en el historial; vale el más reciente).
function RangoForm({ categoria, actual, onClose }) {
  const guardar = useAddPrecioReferencia();
  const [form, setForm] = useState({
    min: actual ? numeroAPesos(actual.precioMin) : '',
    max: actual ? numeroAPesos(actual.precioMax) : '',
    fecha: hoyISO(),
    fuente: '',
  });
  const [error, setError] = useState('');
  const set = (c, v) => setForm((f) => ({ ...f, [c]: v }));

  function enviar(e) {
    e.preventDefault();
    const min = pesosANumero(form.min);
    const max = pesosANumero(form.max);
    if (!(min > 0) || !(max > 0)) return setError('Escribe el precio mínimo y el máximo por kilo.');
    if (min > max) return setError('El mínimo no puede ser mayor que el máximo.');
    if (max > 100_000) return setError('Revisa el precio: parece tener un cero de más.');
    if (!form.fecha || form.fecha > hoyISO()) return setError('La fecha no puede ser futura.');
    if (!form.fuente.trim()) return setError('Escribe de dónde sale el precio (por ejemplo: subasta de Valledupar, comprador).');
    guardar.mutate({ categoria: categoria.valor, precioMin: min, precioMax: max, fecha: form.fecha, fuente: form.fuente }, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) });
  }

  return (
    <Modal
      titulo={`Precio de ${categoria.label.split(' (')[0].toLowerCase()}`}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-rango" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-rango" onSubmit={enviar} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Mínimo por kilo" required>
          <CampoPesos value={form.min} onChange={(v) => set('min', v)} />
        </Field>
        <Field label="Máximo por kilo" required>
          <CampoPesos value={form.max} onChange={(v) => set('max', v)} />
        </Field>
        <Field label="Fecha">
          <Input type="date" max={hoyISO()} value={form.fecha} onChange={(e) => set('fecha', e.target.value)} />
        </Field>
        <Field label="Fuente" required>
          <Input value={form.fuente} maxLength={300} onChange={(e) => set('fuente', e.target.value)} placeholder="Subasta, comprador, Fedegán…" />
        </Field>
        <div className="sm:col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  );
}
