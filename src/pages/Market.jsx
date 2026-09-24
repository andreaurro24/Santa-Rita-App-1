import { useEffect, useState } from 'react';
import { CloudSun, Droplets, Banknote, DollarSign, Plus } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import PriceChart from '../components/PriceChart';
import { fetchClimaFinca, describeWeatherCode } from '../api/weather';
import { fetchTRM } from '../api/trm';
import { formatCOP } from '../utils/breakeven';
import { formatFecha } from '../utils/format';
import { UBICACION_FINCA, PERDIDA_REVALUACION_COP_POR_KG } from '../data/seedMercado';

export default function Market() {
  const { precios, precioActual, addPrecio } = useData();
  const { user } = useAuth();
  const [clima, setClima] = useState(null);
  const [trm, setTrm] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const puedeEditar = user?.rol === 'administrador' || user?.rol === 'dueno';

  useEffect(() => {
    const controller = new AbortController();
    setCargando(true);
    Promise.all([fetchClimaFinca({ signal: controller.signal }), fetchTRM({ signal: controller.signal })]).then(
      ([c, t]) => {
        setClima(c);
        setTrm(t);
        setCargando(false);
      },
    );
    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Mercado y clima</h1>
        <p className="text-sm text-gray-500">
          Consulta centralizada de variables externas para la decisión de venta — {UBICACION_FINCA.nombre}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
            <CloudSun size={16} className="text-brand-600" /> Clima — pronóstico 7 días
            {clima && !clima.isFallback && (
              <span className="ml-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700">
                En vivo · Open-Meteo
              </span>
            )}
            {clima?.isFallback && (
              <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                Respaldo sin conexión
              </span>
            )}
          </h2>
          {cargando || !clima ? (
            <p className="text-sm text-gray-400">Consultando pronóstico…</p>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-4">
                <p className="text-4xl font-semibold text-gray-900">{Math.round(clima.actual.temperaturaC)}°C</p>
                <div>
                  <p className="text-sm font-medium text-gray-700">{describeWeatherCode(clima.actual.codigo)}</p>
                  <p className="flex items-center gap-1 text-xs text-gray-500">
                    <Droplets size={12} /> {clima.resumenLluvia7d} mm acumulados en 7 días
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {clima.diario.map((d) => (
                  <div key={d.fecha} className="rounded-lg bg-gray-50 p-1.5">
                    <p className="text-gray-400">{formatFecha(d.fecha).slice(0, 6)}</p>
                    <p className="font-semibold text-gray-700">{Math.round(d.tempMaxC)}°</p>
                    <p className="text-gray-400">{Math.round(d.tempMinC)}°</p>
                    {d.precipitacionMm > 0 && <p className="text-blue-500">{Math.round(d.precipitacionMm)}mm</p>}
                  </div>
                ))}
              </div>
              {clima.resumenLluvia7d < 2 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Precipitación muy baja pronosticada: posible riesgo de escasez de pasto (patrón de alerta similar a El Niño).
                </p>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
            <DollarSign size={16} className="text-brand-600" /> TRM (peso / dólar)
            {trm && !trm.isFallback && (
              <span className="ml-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700">
                En vivo · datos.gov.co
              </span>
            )}
            {trm?.isFallback && (
              <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                Respaldo sin conexión
              </span>
            )}
          </h2>
          {cargando || !trm ? (
            <p className="text-sm text-gray-400">Consultando TRM…</p>
          ) : (
            <>
              <p className="text-4xl font-semibold text-gray-900">${formatCOP(trm.valor)}</p>
              <p className="text-xs text-gray-500">{trm.fecha ? `Vigente desde ${formatFecha(trm.fecha)}` : 'Valor de referencia'}</p>
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                La revaluación del peso frente al dólar le ha costado a la finca ≈ ${formatCOP(PERDIDA_REVALUACION_COP_POR_KG)} COP
                por kilo vendido (línea base documentada en el Project Charter, Cap. 1.2).
              </p>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <Banknote size={16} className="text-brand-600" /> Precio del kilo en pie (ganado gordo)
          </h2>
          {puedeEditar && (
            <button
              onClick={() => setShowForm((s) => !s)}
              className="flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Plus size={14} /> Actualizar precio
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-gray-500">
          SIPSA (DANE) y Fedegán no publican una API pública formal, así que este valor se actualiza manualmente a partir de sus
          boletines — igual que hoy, pero centralizado para todos.
        </p>
        {showForm && (
          <PrecioForm
            onCancel={() => setShowForm(false)}
            onSave={(registro) => {
              addPrecio(registro);
              setShowForm(false);
            }}
          />
        )}
        <div className="mb-3 flex items-baseline gap-2">
          <p className="text-3xl font-semibold text-gray-900">${precioActual ? formatCOP(precioActual.precioCOP) : '—'}</p>
          <p className="text-sm text-gray-400">COP/kg · {precioActual ? formatFecha(precioActual.fecha) : ''}</p>
        </div>
        <PriceChart precios={precios} />
      </div>
    </div>
  );
}

function PrecioForm({ onSave, onCancel }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [precioCOP, setPrecioCOP] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!precioCOP) return;
        onSave({ fecha, precioCOP: Number(precioCOP), fuente: 'Registro manual (Fedegán/SIPSA)' });
      }}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3"
    >
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Fecha del boletín</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Precio (COP/kg)</span>
        <input type="number" value={precioCOP} onChange={(e) => setPrecioCOP(e.target.value)} className="input" required />
      </label>
      <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Guardar
      </button>
      <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
        Cancelar
      </button>
    </form>
  );
}
