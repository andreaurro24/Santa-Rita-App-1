import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, PawPrint, Scale, TrendingUp, Layers, MapPin, Handshake, Receipt, BadgeDollarSign, CloudSun, FileText, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MarcaSR from './MarcaSR';
import useDialogo from './ui/useDialogo';

// Secciones de la app. `movil: true` = va en la barra inferior; el resto queda en "Más".
const SECCIONES = [
  { to: '/', label: 'Inicio', icon: Home, end: true, movil: true },
  { to: '/animales', label: 'Hato', icon: PawPrint, movil: true },
  { to: '/pesaje', label: 'Pesaje', icon: Scale, movil: true },
  { to: '/recomendacion', label: 'Venta', icon: TrendingUp, movil: true },
  { to: '/lotes', label: 'Lotes y ciclos', icon: Layers },
  { to: '/fincas', label: 'Fincas y potreros', icon: MapPin },
  { to: '/al-partir', label: 'Al partir', icon: Handshake },
  { to: '/costos', label: 'Insumos y costos', icon: Receipt },
  { to: '/ventas', label: 'Ventas', icon: BadgeDollarSign },
  { to: '/mercado', label: 'Mercado y clima', icon: CloudSun },
  { to: '/reporte', label: 'Reporte', icon: FileText },
];

export default function Layout() {
  return (
    <div className="min-h-dvh md:flex">
      <SideNav />
      <TopBar />
      <main className="min-w-0 flex-1 pb-24 md:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

// R4: navegación lateral desde 768 px.
function SideNav() {
  const { user, logout } = useAuth();
  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-brand-800 text-white md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <MarcaSR className="size-9 text-chapeta" />
        <div>
          <p className="font-display text-lg font-bold leading-tight">Santa Rita</p>
          <p className="text-xs text-brand-200">Badillo, Cesar</p>
        </div>
      </div>
      <nav aria-label="Principal" className="flex-1 space-y-1 px-3 py-2">
        {SECCIONES.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-[color,background-color] ${
                isActive ? 'bg-brand-600 text-white' : 'text-brand-100 hover:bg-brand-700 hover:text-white'
              }`
            }
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <p className="text-sm font-medium">{user?.nombre}</p>
        <p className="mb-3 text-xs text-brand-200">{user?.rolLabel}</p>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-100 transition-[color,background-color] hover:bg-brand-700 hover:text-white"
        >
          <LogOut size={16} aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <header className="no-print sticky top-0 z-30 flex items-center gap-2 bg-brand-800 px-4 py-2.5 text-white md:hidden">
      <MarcaSR className="size-8 text-chapeta" />
      <p className="font-display text-lg font-bold">Santa Rita</p>
    </header>
  );
}

// R3: navegación inferior fija en celular. "Más" abre una hoja con el resto de secciones.
function BottomNav() {
  const [masAbierto, setMasAbierto] = useState(false);
  const location = useLocation();
  const secundarias = SECCIONES.filter((s) => !s.movil);
  const enSecundaria = secundarias.some((s) => location.pathname.startsWith(s.to));

  const clase = (activo) =>
    `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
      activo ? 'text-brand-800' : 'text-gray-500'
    }`;

  return (
    <>
      <nav
        aria-label="Principal"
        className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {SECCIONES.filter((s) => s.movil).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => clase(isActive)}>
            {({ isActive }) => (
              <>
                <span className={`rounded-full px-4 py-1 ${isActive ? 'bg-brand-100' : ''}`}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
        <button onClick={() => setMasAbierto(true)} className={clase(enSecundaria)} aria-haspopup="dialog">
          <span className={`rounded-full px-4 py-1 ${enSecundaria ? 'bg-brand-100' : ''}`}>
            <Menu size={20} aria-hidden="true" />
          </span>
          Más
        </button>
      </nav>
      {masAbierto && <HojaMas secciones={secundarias} onClose={() => setMasAbierto(false)} />}
    </>
  );
}

function HojaMas({ secciones, onClose }) {
  const { user, logout } = useAuth();
  const ref = useDialogo(onClose);
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end bg-gray-900/50 md:hidden" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Más secciones"
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 outline-none"
      >
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <p className="min-w-0 text-sm text-gray-500">
            {user?.nombre}, {user?.rolLabel?.toLowerCase()}
          </p>
          <button onClick={onClose} aria-label="Cerrar" className="flex size-12 shrink-0 items-center justify-center rounded-lg text-gray-500">
            <X size={20} />
          </button>
        </div>
        <div data-dialogo-cuerpo>
        {secciones.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium ${isActive ? 'bg-brand-50 text-brand-800' : 'text-gray-800'}`
            }
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
        <button onClick={logout} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-base font-medium text-gray-800">
          <LogOut size={20} aria-hidden="true" />
          Cerrar sesión
        </button>
        </div>
      </div>
    </div>
  );
}
