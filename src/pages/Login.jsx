import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth, tieneAcceso } from '../context/AuthContext';
import AccesoBloqueado from '../components/AccesoBloqueado';
import MarcaSR from '../components/MarcaSR';
import Button from '../components/ui/Button';
import { Field, Input, FormError } from '../components/ui/Field';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // R2 (spec 001): tras entrar, volver a la ruta que se pidió sin sesión.
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
    <div className="flex min-h-dvh flex-col bg-brand-800 md:items-center md:justify-center md:px-4">
      <div className="flex flex-col items-center gap-3 px-6 pb-8 pt-14 text-center text-white md:pt-0">
        <MarcaSR className="size-16 text-chapeta" />
        <div>
          <h1 className="text-3xl font-bold">Finca Santa Rita</h1>
          <p className="mt-1 text-brand-200">El hato, sus pesos y el momento de vender</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex-1 space-y-4 rounded-t-3xl bg-white px-6 pb-10 pt-8 md:w-full md:max-w-sm md:flex-none md:rounded-2xl md:pb-8"
      >
        <Field label="Correo">
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@correo.com"
            autoFocus
          />
        </Field>
        <Field label="Contraseña">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        <FormError>{error}</FormError>

        <Button type="submit" icono={LogIn} disabled={enviando} className="w-full">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </div>
  );
}
