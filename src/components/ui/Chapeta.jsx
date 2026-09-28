// El número interno como la chapeta amarilla que lleva el animal en la oreja: la perforación
// arriba a la izquierda y el número en Archivo negrita. Es el único adorno fuerte de la app.
// El texto accesible es solo el número: el contexto ("Animal N°", la columna) ya lo nombra.
const TAMANOS = {
  sm: 'min-w-12 pl-5 pr-2 py-0.5 text-sm',
  md: 'min-w-16 pl-6 pr-2.5 py-1 text-lg',
  lg: 'min-w-24 pl-8 pr-4 py-2 text-4xl',
};
const AGUJERO = { sm: 'left-1.5 size-2', md: 'left-2 size-2.5', lg: 'left-2.5 size-3.5' };

export default function Chapeta({ numero, tamano = 'sm', className = '' }) {
  return (
    <span
      className={`cifra relative inline-flex items-center justify-center rounded-md rounded-tl-2xl border border-chapeta-borde bg-chapeta font-extrabold text-gray-900 ${TAMANOS[tamano]} ${className}`}
    >
      <span aria-hidden="true" className={`absolute top-1/2 -translate-y-1/2 rounded-full border border-chapeta-borde bg-cal ${AGUJERO[tamano]}`} />
      {numero}
    </span>
  );
}
