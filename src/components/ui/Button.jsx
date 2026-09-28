// Botón del sistema. En celular mide al menos 48 px de alto (R5).
const VARIANTES = {
  primario: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-400',
  secundario: 'bg-white text-brand-800 ring-1 ring-inset ring-borde-control hover:bg-gray-50',
  suave: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
  fantasma: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  peligro: 'bg-peligro text-white hover:brightness-95',
};

const TAMANOS = {
  md: 'min-h-12 px-4 text-base md:min-h-10 md:text-sm',
  sm: 'min-h-12 px-3 text-sm md:min-h-9',
};

export default function Button({ variante = 'primario', tamano = 'md', icono: Icono, className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${VARIANTES[variante]} ${TAMANOS[tamano]} ${className}`}
      {...props}
    >
      {Icono && <Icono size={18} aria-hidden="true" />}
      {children}
    </button>
  );
}
