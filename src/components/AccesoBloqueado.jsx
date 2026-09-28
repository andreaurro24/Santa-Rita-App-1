import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Button from './ui/Button';

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
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div role="alert" className="w-full max-w-md rounded-xl border border-alerta bg-alerta-50 p-6 text-sm text-gray-900">
        <p className="mb-2 text-base font-semibold">
          {esRed ? 'No se pudo verificar tu acceso' : 'Tu cuenta no tiene acceso a los datos de la finca'}
        </p>
        <p className="mb-5">
          {esRed
            ? user.errorPerfil
            : `La cuenta ${user?.email} existe, pero no tiene un perfil activo. Pídele al dueño que te dé acceso.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {esRed && (
            <Button onClick={reintentar} disabled={reintentando}>
              {reintentando ? 'Reintentando…' : 'Reintentar'}
            </Button>
          )}
          <Button variante="secundario" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
