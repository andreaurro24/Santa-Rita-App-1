import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Explica por qué una sesión válida no puede ver los datos: sin perfil (pedir acceso) o
// sin conexión al consultar el perfil (reintentar). Se usa en el login y en las rutas.
export default function AccesoBloqueado() {
  const { user, logout, reintentarPerfil } = useAuth();
  const [reintentando, setReintentando] = useState(false);
  const esRed = Boolean(user?.errorPerfil);

  async function reintentar() {
    setReintentando(true);
    await reintentarPerfil();
    setReintentando(false);
  }

  return (
    <div role="alert" className="mx-auto mt-24 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
      <p className="mb-2 font-semibold">
        {esRed ? 'No se pudo verificar tu acceso' : 'Tu cuenta no tiene acceso a los datos de la finca'}
      </p>
      <p className="mb-4">
        {esRed
          ? user.errorPerfil
          : `La cuenta ${user?.email} existe, pero no tiene un perfil activo. Pídele al dueño que te dé acceso.`}
      </p>
      <div className="flex gap-2">
        {esRed && (
          <button
            onClick={reintentar}
            disabled={reintentando}
            className="rounded-lg bg-white px-3 py-2 font-medium ring-1 ring-amber-300 hover:bg-amber-100 disabled:opacity-60"
          >
            {reintentando ? 'Reintentando…' : 'Reintentar'}
          </button>
        )}
        <button onClick={logout} className="rounded-lg bg-white px-3 py-2 font-medium ring-1 ring-amber-300 hover:bg-amber-100">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
