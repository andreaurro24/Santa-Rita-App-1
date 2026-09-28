import { Link } from 'react-router-dom';
import { PawPrint, Syringe, Banknote, CloudSun, DollarSign, AlertTriangle, ChevronRight } from 'lucide-react';
import { useHato } from '../data/hato';
import { usePrecios } from '../data/precios';
import { useClima, useTRM } from '../data/externos';
import { ConDatos } from '../components/EstadoCarga';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import Card from '../components/ui/Card';
import Chapeta from '../components/ui/Chapeta';
import EmptyState from '../components/ui/EmptyState';
import { describeWeatherCode } from '../api/weather';
import { formatCOP } from '../domain/breakeven';
import { formatFecha, diasHasta, hoyISO } from '../utils/format';

export default function Dashboard() {
  const hato = useHato();
  const precios = usePrecios();
  return (
    <ConDatos queries={[hato, precios]}>
      {() => <DashboardContenido {...hato.data} precioActual={precios.data.precioActual} />}
    </ConDatos>
  );
}

function DashboardContenido({ animales, lotes, precioActual }) {
  const { user } = useAuth();
  const { data: clima } = useClima();
  const { data: trm } = useTRM();

  const activos = animales.filter((a) => a.estado === 'Activo');
  const conHistorial = activos.filter((a) => a.pesos?.length > 0).length;

  const alertas = activos
    .flatMap((a) =>
      (a.sanidad ?? []).filter((s) => s.pendiente).map((s) => ({ animal: a, ...s, diasRestantes: diasHasta(s.proximaFecha) })),
    )
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
  const alertasVencidasOProximas = alertas.filter((a) => a.diasRestantes <= 15);

  const metas = [
    {
      metrica: 'Hato con registro digital individual',
      base: '0 % (papel y WhatsApp)',
      hoy: `${Math.round((conHistorial / (activos.length || 1)) * 100)} % de ${activos.length} reses`,
    },
    { metrica: 'Tiempo para conocer el estado de un lote', base: '1 día de pesaje', hoy: 'Minutos, en esta app' },
    { metrica: 'Fuentes externas en la decisión de venta', base: '0', hoy: 'Precio del kilo, clima y TRM' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Hola, {user?.nombre?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500">Finca Santa Rita, Badillo (Cesar). Hoy es {formatFecha(hoyISO())}.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
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
          label="Kilo en pie"
          value={precioActual ? `$${formatCOP(precioActual.precioCOP)}` : '—'}
          sub={precioActual ? `Fedegán, ${formatFecha(precioActual.fecha)}` : 'Sin precio registrado'}
        />
        <StatCard
          icon={CloudSun}
          label="Clima en Badillo"
          value={clima ? `${Math.round(clima.actual.temperaturaC)} °C` : '…'}
          sub={clima ? describeWeatherCode(clima.actual.codigo) + (clima.isFallback ? ' (respaldo)' : '') : 'Consultando'}
        />
        <StatCard
          icon={DollarSign}
          label="TRM hoy"
          value={trm ? `$${formatCOP(trm.valor)}` : '…'}
          sub={trm ? (trm.isFallback ? 'Valor de respaldo' : 'datos.gov.co') : 'Consultando'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          titulo="Vacunas y tratamientos pendientes"
          accion={
            <Link to="/animales" className="flex min-h-12 items-center gap-1 text-sm font-medium text-brand-700 hover:underline md:min-h-0">
              Ver hato <ChevronRight size={14} aria-hidden="true" />
            </Link>
          }
        >
          {alertas.length === 0 ? (
            <EmptyState titulo="Todo al día">No hay vacunas ni tratamientos programados pendientes.</EmptyState>
          ) : (
            <ul className="divide-y divide-gray-100">
              {alertas.slice(0, 6).map((a) => (
                <li key={`${a.animal.id}-${a.id}`}>
                  <Link to={`/animales/${a.animal.id}`} className="flex min-h-12 items-center gap-3 py-2 hover:bg-gray-50">
                    <AlertTriangle
                      size={16}
                      aria-hidden="true"
                      className={a.diasRestantes < 0 ? 'shrink-0 text-peligro' : 'shrink-0 text-alerta'}
                    />
                    <Chapeta numero={a.animal.numeroInterno} />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{a.descripcion}</span>
                    <span className={`shrink-0 text-xs font-semibold ${a.diasRestantes < 0 ? 'text-peligro' : 'text-gray-600'}`}>
                      {a.diasRestantes < 0 ? `Vencida hace ${Math.abs(a.diasRestantes)} d` : `En ${a.diasRestantes} d`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card titulo="Lotes">
          <ul className="space-y-2">
            {lotes.map((l) => (
              <li key={l.codigo}>
                <Link
                  to="/recomendacion"
                  className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:border-brand-300 hover:bg-brand-50"
                >
                  <span className="font-medium text-gray-800">{l.nombre}</span>
                  <span className="shrink-0 text-gray-500">{l.animales.filter((a) => a.estado === 'Activo').length} reses</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card titulo="Metas del proyecto frente al punto de partida">
        <dl className="divide-y divide-gray-100">
          {metas.map((m) => (
            <div key={m.metrica} className="grid gap-1 py-3 md:grid-cols-3 md:gap-4">
              <dt className="font-medium text-gray-800">{m.metrica}</dt>
              <dd className="text-sm text-gray-500">Antes: {m.base}</dd>
              <dd className="text-sm font-semibold text-brand-700">Hoy: {m.hoy}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
