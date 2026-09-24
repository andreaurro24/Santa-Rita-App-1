import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  PawPrint,
  CloudSun,
  TrendingUp,
  FileText,
  LogOut,
  Sprout,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Panel general', icon: LayoutDashboard, end: true },
  { to: '/animales', label: 'Trazabilidad del hato', icon: PawPrint },
  { to: '/mercado', label: 'Mercado y clima', icon: CloudSun },
  { to: '/recomendacion', label: 'Recomendación de venta', icon: TrendingUp },
  { to: '/reporte', label: 'Reporte resumen', icon: FileText },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-[#f5f6f3]">
      <aside className="no-print flex w-64 shrink-0 flex-col bg-brand-800 text-white">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
          <Sprout className="h-7 w-7 text-brand-200" />
          <div>
            <p className="font-semibold leading-tight">Finca Santa Rita</p>
            <p className="text-xs text-brand-200">Trazabilidad &amp; decisión de venta</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-brand-100 hover:bg-brand-700 hover:text-white'
                }`
              }
            >
              <Icon className="h-4.5 w-4.5" size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <p className="text-sm font-medium">{user?.nombre}</p>
          <p className="text-xs text-brand-200 mb-3">{user?.rolLabel}</p>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-100 hover:bg-brand-700 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-6 md:px-10 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
