import { Link } from 'react-router-dom';
import { PawPrint, Scale, Receipt, TrendingUp, AlertTriangle, ChevronRight, TrendingDown, Tags } from 'lucide-react';
import { useHato } from '../data/hato';
import { usePreciosReferencia } from '../data/precios';
import { ConDatos } from '../components/EstadoCarga';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Chapeta from '../components/ui/Chapeta';
import { formatCOP } from '../domain/breakeven';
import { pierdePeso } from '../domain/gdp';
import { rangosVigentes } from '../domain/precios';
import { formatFecha, diasHasta, hoyISO, cantidad } from '../utils/format';

export default function Dashboard() {
  const hato = useHato();
  const precios = usePreciosReferencia();
  return <ConDatos queries={[hato, precios]}>{() => <DashboardContenido {...hato.data} rangos={precios.data} />}</ConDatos>;
}

// Spec 015 · R3: los 4 accesos de todos los días, grandes.
const ACCESOS = [
  { to: '/animales?nuevo=1', label: 'Registrar animal', icon: PawPrint },
  { to: '/pesaje', label: 'Pesar', icon: Scale },
  { to: '/costos?nuevo=1', label: 'Anotar gasto', icon: Receipt },
  { to: '/recomendacion', label: '¿Vendo hoy?', icon: TrendingUp },
];

function DashboardContenido({ animales, caballos, rangos }) {
  const { user } = useAuth();
  const activos = animales.filter((a) => a.estado === 'Activo');
  const caballosActivos = caballos.filter((a) => a.estado === 'Activo');
  const gordo = rangosVigentes(rangos).get('gordo');

  const alertas = activos
    .flatMap((a) => (a.sanidad ?? []).filter((s) => s.pendiente).map((s) => ({ animal: a, ...s, diasRestantes: diasHasta(s.proximaFecha) })))
    .filter((a) => a.diasRestantes <= 15)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
  // Spec 004 · R7: animales cuya ganancia reciente es negativa.
  const perdiendo = activos.filter(pierdePeso);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Hola, {user?.nombre?.split(' ')[0]}</h1>
        <p className="text-base text-gray-600">Finca Santa Rita, Badillo (Cesar). Hoy es {formatFecha(hoyISO())}.</p>
      </div>

      <nav aria-label="Accesos rápidos" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ACCESOS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl bg-brand-700 px-3 py-4 text-center text-lg font-bold text-white shadow-sm hover:bg-brand-800"
          >
            <Icon size={32} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Resumen to="/animales" titulo="Reses activas" valor={activos.length} detalle={cantidad(caballosActivos.length, 'caballo', 'caballos')} />
        <Resumen
          to="/mercado"
          titulo="Kilo de ganado gordo"
          valor={gordo ? `$${formatCOP(gordo.precioMin)} – $${formatCOP(gordo.precioMax)}` : '—'}
          detalle={gordo ? `Cesar y La Guajira, ${formatFecha(gordo.fecha)}` : 'Sin precio registrado'}
          icono={Tags}
        />
        <Resumen
          to="/animales"
          titulo="Alertas"
          valor={alertas.length + perdiendo.length}
          detalle={alertas.length + perdiendo.length ? 'Revisa abajo' : 'Todo al día'}
          alerta={alertas.length + perdiendo.length > 0}
        />
      </div>

      {(alertas.length > 0 || perdiendo.length > 0) && (
        <Card titulo="Para revisar">
          <ul className="divide-y divide-gray-100">
            {alertas.slice(0, 6).map((a) => (
              <li key={`${a.animal.id}-${a.id}`}>
                <Link to={`/animales/${a.animal.id}`} className="flex min-h-14 items-center gap-3 py-2 hover:bg-gray-50">
                  <AlertTriangle size={20} aria-hidden="true" className={a.diasRestantes < 0 ? 'shrink-0 text-brasa' : 'shrink-0 text-alerta'} />
                  <Chapeta numero={a.animal.numeroInterno} />
                  <span className="line-clamp-2 min-w-0 flex-1 text-base text-gray-800">{a.descripcion}</span>
                  <span className={`shrink-0 text-sm font-semibold ${a.diasRestantes < 0 ? 'text-brasa' : 'text-gray-700'}`}>
                    {a.diasRestantes < 0 ? `Vencida hace ${cantidad(Math.abs(a.diasRestantes), 'día', 'días')}` : `En ${cantidad(a.diasRestantes, 'día', 'días')}`}
                  </span>
                </Link>
              </li>
            ))}
            {perdiendo.map((a) => (
              <li key={`peso-${a.id}`}>
                <Link to={`/animales/${a.id}`} className="flex min-h-14 items-center gap-3 py-2 hover:bg-gray-50">
                  <TrendingDown size={20} aria-hidden="true" className="shrink-0 text-peligro" />
                  <Chapeta numero={a.numeroInterno} />
                  <span className="min-w-0 flex-1 text-base text-gray-800">Está perdiendo peso: revísalo en el próximo recorrido.</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Resumen({ to, titulo, valor, detalle, alerta = false }) {
  return (
    <Link to={to} className={`flex min-h-20 items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 hover:border-brand-300 ${alerta ? 'border-alerta' : 'border-gray-200'}`}>
      <span>
        <span className="block text-base text-gray-600">{titulo}</span>
        <span className="cifra block text-2xl font-bold text-gray-900">{valor}</span>
        <span className="block text-sm text-gray-600">{detalle}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-gray-400" aria-hidden="true" />
    </Link>
  );
}
