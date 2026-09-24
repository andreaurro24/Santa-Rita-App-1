import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Sprout, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { USERS } from '../data/seedUsers';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  function handleSubmit(e) {
    e.preventDefault();
    const result = login(usuario.trim(), password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate('/');
  }

  function quickFill(u) {
    setUsuario(u.usuario);
    setPassword(u.password);
    setError('');
  }

  return (
    <div className="min-h-screen bg-brand-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-brand-700 px-8 py-6 text-white text-center">
          <Sprout className="mx-auto mb-2 h-9 w-9 text-brand-200" />
          <h1 className="text-xl font-semibold">Finca Santa Rita</h1>
          <p className="text-sm text-brand-200">Sistema de trazabilidad y apoyo a la decisión de venta</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="miguel / admin"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            <LogIn size={16} />
            Ingresar
          </button>
        </form>

        <div className="border-t border-gray-100 px-8 py-4 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">Acceso de demostración (MVP académico):</p>
          <div className="flex gap-2">
            {USERS.map((u) => (
              <button
                key={u.id}
                onClick={() => quickFill(u)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs hover:border-brand-300 hover:bg-brand-50 transition-colors"
              >
                <span className="block font-medium text-gray-700">{u.rolLabel}</span>
                <span className="text-gray-400">{u.usuario} / {u.password}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
