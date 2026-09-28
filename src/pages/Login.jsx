import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Sprout, LogIn } from 'lucide-react';
import { useAuth, tieneAcceso } from '../context/AuthContext';
import AccesoBloqueado from '../components/AccesoBloqueado';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // R2: tras entrar, volver a la ruta que se pidió sin sesión.
  const destino = location.state?.from && location.state.from !== '/login' ? location.state.from : '/';

  if (tieneAcceso(user)) return <Navigate to={destino} replace />;
  if (user) return <AccesoBloqueado />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    setEnviando(true);
    setError('');
    const result = await login(email, password);
    setEnviando(false);
    if (!result.ok) {
      // Sin perfil o sin red al consultarlo: AccesoBloqueado lo explica (user ya está puesto).
      if (result.error) setError(result.error);
      return;
    }
    navigate(destino, { replace: true });
  }

  return (
    <div className="min-h-screen bg-brand-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-brand-700 px-8 py-6 text-white text-center">
          <Sprout className="mx-auto mb-2 h-9 w-9 text-brand-200" />
          <h1 className="text-xl font-semibold">Finca Santa Rita</h1>
          <p className="text-sm text-brand-200">Sistema de trazabilidad y apoyo a la decisión de venta</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="nombre@correo.com"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-60"
          >
            <LogIn size={16} />
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
