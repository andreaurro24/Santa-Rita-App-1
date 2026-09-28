import { AlertTriangle, Loader2, RotateCw } from 'lucide-react';
import { mensajeError } from '../lib/errores';
import Button from './ui/Button';
import Skeleton from './ui/Skeleton';

// Spec 001 · R7: estados compartidos de carga y error para toda pantalla que lee datos.
export function Cargando({ texto = 'Cargando datos…' }) {
  return (
    <div role="status" className="space-y-6 py-4">
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> {texto}
      </p>
      <Skeleton lineas={3} className="max-w-md" />
      <Skeleton lineas={4} />
    </div>
  );
}

export function ErrorCarga({ error, onReintentar }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl border border-peligro/30 bg-peligro-50 p-5 text-sm text-peligro">
      <p className="mb-1 flex items-center gap-2 font-semibold">
        <AlertTriangle size={16} aria-hidden="true" /> No se pudieron cargar los datos
      </p>
      <p className="mb-4 text-gray-800">{mensajeError(error)}</p>
      {onReintentar && (
        <Button variante="secundario" tamano="sm" icono={RotateCw} onClick={onReintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

// Envuelve una o varias consultas de TanStack Query: muestra carga o error, o el contenido.
// `children` es una función para que solo se evalúe cuando los datos ya existen.
export function ConDatos({ queries, children }) {
  const lista = Array.isArray(queries) ? queries : [queries];
  const conError = lista.find((q) => q.isError);
  if (conError) return <ErrorCarga error={conError.error} onReintentar={() => lista.forEach((q) => q.refetch())} />;
  if (lista.some((q) => q.isPending)) return <Cargando />;
  return children();
}
