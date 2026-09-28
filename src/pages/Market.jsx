import { useState } from 'react';
import { CloudSun, Droplets, Banknote, DollarSign, Plus, AlertTriangle } from 'lucide-react';
import { usePrecios, useAddPrecio } from '../data/precios';
import { useClima, useTRM } from '../data/externos';
import { ConDatos } from '../components/EstadoCarga';
import { mensajeError } from '../lib/errores';
import { useAuth } from '../context/AuthContext';
import PriceChart from '../components/PriceChart';
import { EstadoPasto, ParametrosVenta } from '../components/PastoYParametros';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';
import { Field, Input, FormError } from '../components/ui/Field';
import { describeWeatherCode } from '../api/weather';
import { formatCOP } from '../domain/breakeven';
import { formatFecha, hoyISO, formatNumero } from '../utils/format';
import { UBICACION_FINCA, PERDIDA_REVALUACION_COP_POR_KG } from '../data/seedMercado';

export default function Market() {
  const preciosQuery = usePrecios();
  return <ConDatos queries={preciosQuery}>{() => <MercadoContenido {...preciosQuery.data} />}</ConDatos>;
}

function Fuente({ dato, enVivo }) {
  if (!dato) return null;
  return dato.isFallback ? <Badge>Respaldo sin conexión</Badge> : <Badge tono="ok">En vivo, {enVivo}</Badge>;
}

function MercadoContenido({ precios, precioActual }) {
  const { user } = useAuth();
  const { data: clima } = useClima();
  const { data: trm } = useTRM();
  const [showForm, setShowForm] = useState(false);

  const puedeEditar = user?.rol === 'administrador' || user?.rol === 'dueno';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mercado y clima</h1>
        <p className="text-sm text-gray-500">Lo que hoy se consulta a mano para decidir la venta, en un solo lugar. {UBICACION_FINCA.nombre}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card titulo="Clima, próximos 7 días" icono={CloudSun} accion={<Fuente dato={clima} enVivo="Open-Meteo" />}>
          {!clima ? (
            <Skeleton lineas={4} />
          ) : (
            <>
              <div className="mb-4 flex items-center gap-4">
                <p className="cifra text-5xl font-bold text-gray-900">{Math.round(clima.actual.temperaturaC)}°</p>
                <div>
                  <p className="font-medium text-gray-800">{describeWeatherCode(clima.actual.codigo)}</p>
                  <p className="flex items-center gap-1 text-sm text-gray-600">
                    <Droplets size={14} aria-hidden="true" /> {formatNumero(clima.resumenLluvia7d)} mm de lluvia en 7 días
                  </p>
                </div>
              </div>
              <ol className="grid grid-cols-7 gap-1 text-center text-xs">
                {clima.diario.map((d) => (
                  <li key={d.fecha} className="rounded-lg bg-gray-50 px-0.5 py-1.5">
                    <p className="text-gray-500">{new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short' })}</p>
                    <p className="cifra text-sm font-bold text-gray-900">{Math.round(d.tempMaxC)}°</p>
                    <p className="text-gray-500">{Math.round(d.tempMinC)}°</p>
                    <p className={d.precipitacionMm > 0 ? 'font-medium text-brand-700' : 'text-gray-400'}>{Math.round(d.precipitacionMm)} mm</p>
                  </li>
                ))}
              </ol>
              {clima.resumenLluvia7d < 2 && (
                <p className="mt-3 flex gap-2 rounded-lg bg-alerta-50 px-3 py-2 text-sm text-alerta-900">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Casi no se pronostica lluvia: puede escasear el pasto, como en los episodios de El Niño.
                </p>
              )}
            </>
          )}
        </Card>

        <Card titulo="TRM, peso frente al dólar" icono={DollarSign} accion={<Fuente dato={trm} enVivo="datos.gov.co" />}>
          {!trm ? (
            <Skeleton lineas={3} />
          ) : (
            <>
              <p className="cifra text-5xl font-bold text-gray-900">${formatCOP(trm.valor)}</p>
              <p className="text-sm text-gray-600">{trm.fecha ? `Vigente desde ${formatFecha(trm.fecha)}` : 'Valor de referencia'}</p>
              <p className="mt-4 rounded-lg bg-peligro-50 px-3 py-2 text-sm text-peligro">
                La revaluación del peso le costó a la finca unos ${formatCOP(PERDIDA_REVALUACION_COP_POR_KG)} por kilo vendido en la última venta.
              </p>
            </>
          )}
        </Card>
      </div>

      <Card
        titulo="Precio del kilo en pie"
        icono={Banknote}
        accion={
          puedeEditar && (
            <Button variante="suave" tamano="sm" icono={Plus} onClick={() => setShowForm(true)}>
              Actualizar precio
            </Button>
          )
        }
      >
        <p className="mb-3 text-sm text-gray-600">
          SIPSA (DANE) y Fedegán no tienen una API pública, así que el precio se copia de sus boletines. Queda guardado para todos.
        </p>
        {showForm && <PrecioForm onCancel={() => setShowForm(false)} onSaved={() => setShowForm(false)} />}
        <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
          <p className="cifra text-4xl font-bold text-gray-900">${precioActual ? formatCOP(precioActual.precioCOP) : '—'}</p>
          <p className="text-sm text-gray-600">por kilo{precioActual ? `, boletín del ${formatFecha(precioActual.fecha)}` : ''}</p>
        </div>
        <PriceChart precios={precios} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EstadoPasto />
        <ParametrosVenta />
      </div>
    </div>
  );
}

function PrecioForm({ onSaved, onCancel }) {
  const [fecha, setFecha] = useState(hoyISO());
  const [precioCOP, setPrecioCOP] = useState('');
  const [error, setError] = useState('');
  const addPrecio = useAddPrecio();

  function handleSubmit(e) {
    e.preventDefault();
    const precio = Number(precioCOP);
    if (!Number.isInteger(precio) || precio <= 0) return setError('El precio debe ser un número entero mayor que cero.');
    if (!fecha || fecha > hoyISO()) return setError('La fecha del boletín no puede ser futura.');
    setError('');
    addPrecio.mutate(
      { fecha, precioCOP: precio, fuente: 'Registro manual (Fedegán/SIPSA)' },
      { onSuccess: onSaved, onError: (err) => setError(mensajeError(err)) },
    );
  }

  // R9 (spec 002): hoja inferior en celular, con Guardar siempre visible.
  return (
    <Modal
      titulo="Actualizar precio del kilo en pie"
      onClose={onCancel}
      pie={
        <>
          <Button variante="fantasma" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" form="form-precio" disabled={addPrecio.isPending}>
            {addPrecio.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-precio" onSubmit={handleSubmit} noValidate className="grid grid-cols-2 gap-3">
        <Field label="Precio (COP/kg)">
          <Input type="number" min="1" step="1" inputMode="numeric" value={precioCOP} onChange={(e) => setPrecioCOP(e.target.value)} />
        </Field>
        <Field label="Fecha del boletín">
          <Input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <div className="col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  );
}
