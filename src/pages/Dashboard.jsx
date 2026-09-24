import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PawPrint,
  Syringe,
  Banknote,
  CloudSun,
  DollarSign,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import { fetchClimaFinca, describeWeatherCode } from '../api/weather';
import { fetchTRM } from '../api/trm';
import { formatCOP } from '../utils/breakeven';
import { formatFecha, diasHasta } from '../utils/format';

export default function Dashboard() {
  const { animales, lotes, precioActual } = useData();
  const { user } = useAuth();
  const [clima, setClima] = useState(null);
  const [trm, setTrm] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchClimaFinca({ signal: controller.signal }).then(setClima);
    fetchTRM({ signal: controller.signal }).then(setTrm);
    return () => controller.abort();
  }, []);

  const activos = animales.filter((a) => a.estado === 'Activo');
  const conHistorial = activos.filter((a) => a.pesos?.length > 0).length;

  const alertas = activos
    .flatMap((a) =>
      (a.sanidad ?? [])
        .filter((s) => s.pendiente)
        .map((s) => ({ animal: a, ...s, diasRestantes: diasHasta(s.proximaFecha) })),
    )
    .sort((a, b) => a.diasRestantes - b.diasRestantes);

  const alertasVencidasOProximas = alertas.filter((a) => a.diasRestantes <= 15);

  const metas = [
    {
      metrica: '% del hato con registro digital individual',
      base: '0% (solo papel/WhatsApp)',
      meta: `${Math.round((conHistorial / (activos.length || 1)) * 100)}% de ${activos.length} reses`,
    },
    {
      metrica: 'Tiempo para obtener el estado actualizado de un lote',
      base: '≈ 1 día de pesaje físico',
      meta: 'Consulta inmediata en la plataforma (minutos)',
    },
    {
      metrica: 'Fuentes externas integradas en la decisión de venta',
      base: '0 (consulta manual dispersa)',
      meta: 'Clima (Open-Meteo) + Precio kilo en pie (Fedegán/SIPSA) + TRM',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Hola, {user?.nombre?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500">
          Panel general de trazabilidad — Finca Santa Rita, Badillo (Cesar). {formatFecha(new Date().toISOString().slice(0, 10))}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={PawPrint} label="Reses activas" value={activos.length} sub={`${lotes.length} lotes`} />
        <StatCard
          icon={Syringe}
          label="Alertas sanitarias"
          value={alertasVencidasOProximas.length}
          sub="Vencidas o en 15 días"
          tone={alertasVencidasOProximas.length > 0 ? 'warning' : 'default'}
        />
        <StatCard
          icon={Banknote}
          label="Precio kilo en pie"
          value={precioActual ? `$${formatCOP(precioActual.precioCOP)}` : '—'}
          sub={precioActual ? `Fedegán · ${formatFecha(precioActual.fecha)}` : ''}
        />
        <StatCard
          icon={CloudSun}
          label="Clima en Badillo"
          value={clima ? `${Math.round(clima.actual.temperaturaC)}°C` : 'Cargando…'}
          sub={clima ? describeWeatherCode(clima.actual.codigo) + (clima.isFallback ? ' (respaldo sin conexión)' : ' · en vivo') : ''}
        />
        <StatCard
          icon={DollarSign}
          label="TRM hoy"
          value={trm ? `$${formatCOP(trm.valor)}` : 'Cargando…'}
          sub={trm ? (trm.isFallback ? 'Valor de respaldo' : `datos.gov.co · en vivo`) : ''}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Alertas sanitarias próximas</h2>
            <Link to="/animales" className="text-xs font-medium text-brand-600 hover:underline flex items-center gap-1">
              Ver hato <ArrowRight size={12} />
            </Link>
          </div>
          {alertas.length === 0 ? (
            <p className="text-sm text-gray-500">No hay alertas registradas.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {alertas.slice(0, 6).map((a, i) => (
                <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      size={14}
                      className={a.diasRestantes < 0 ? 'text-red-500' : a.diasRestantes <= 15 ? 'text-amber-500' : 'text-gray-300'}
                    />
                    <div>
                      <Link to={`/animales/${a.animal.id}`} className="font-medium text-gray-800 hover:text-brand-700">
                        {a.animal.numeroInterno}
                      </Link>{' '}
                      <span className="text-gray-500">— {a.descripcion}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${a.diasRestantes < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {a.diasRestantes < 0 ? `Vencida hace ${Math.abs(a.diasRestantes)} d` : `En ${a.diasRestantes} d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-900">Lotes</h2>
          <ul className="space-y-2">
            {lotes.map((l) => (
              <li key={l.codigo}>
                <Link
                  to="/recomendacion"
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm hover:border-brand-200 hover:bg-brand-50 transition-colors"
                >
                  <span className="font-medium text-gray-700">{l.nombre}</span>
                  <span className="text-xs text-gray-400">{l.animales.length} reses</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-900">Métricas de éxito vs. línea base (Cap. 5.4 del proyecto)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-4">Métrica</th>
                <th className="pb-2 pr-4">Línea base (AS-IS)</th>
                <th className="pb-2">Estado con el MVP</th>
              </tr>
            </thead>
            <tbody>
              {metas.map((m) => (
                <tr key={m.metrica} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 pr-4 text-gray-700">{m.metrica}</td>
                  <td className="py-2 pr-4 text-gray-400">{m.base}</td>
                  <td className="py-2 font-medium text-brand-700">{m.meta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
