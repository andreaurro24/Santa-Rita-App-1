import { AlertTriangle, Loader2, RotateCw } from 'lucide-react';
import { mensajeError } from '../lib/errores';

// Spec 001 · R7: estados compartidos de carga y error para toda pantalla que lee datos.
export function Cargando({ texto = 'Cargando datos…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
      <Loader2 size={18} className="animate-spin" /> {texto}
    </div>
  );
}

export function ErrorCarga({ error, onReintentar }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      <p className="mb-1 flex items-center gap-2 font-semibold">
        <AlertTriangle size={16} /> No se pudieron cargar los datos
      </p>
      <p className="mb-3">{mensajeError(error)}</p>
      {onReintentar && (
        <button
          onClick={onReintentar}
          className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100"
        >
          <RotateCw size={14} /> Reintentar
        </button>
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
