import { useEffect, useId } from 'react';
import { X } from 'lucide-react';

// R9: en celular es una hoja inferior a pantalla completa con el pie (botones) siempre
// visible; en escritorio, un diálogo centrado. Cierra con Escape o con el fondo.
export default function Modal({ titulo, onClose, pie, children }) {
  const tituloId = useId();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50 md:items-center md:px-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl md:max-h-[90vh] md:max-w-lg md:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 id={tituloId} className="text-lg font-semibold text-gray-900">
            {titulo}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="-mr-2 flex size-12 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 md:size-10">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {pie && <div className="flex justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{pie}</div>}
      </div>
    </div>
  );
}
