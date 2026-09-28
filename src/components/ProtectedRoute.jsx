import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, tieneAcceso } from '../context/AuthContext';
import { Cargando } from './EstadoCarga';
import AccesoBloqueado from './AccesoBloqueado';

// Spec 001 · R2: sin sesión, cualquier ruta lleva a /login recordando a dónde se quería ir.
export default function ProtectedRoute({ children }) {
  const { user, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <Cargando texto="Verificando sesión…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!tieneAcceso(user)) return <AccesoBloqueado />;
  return children;
}
