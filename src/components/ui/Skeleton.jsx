// Bloque de carga. `lineas` dibuja varias barras para simular texto.
export default function Skeleton({ lineas = 1, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lineas }).map((_, i) => (
        <div key={i} className={`h-4 animate-pulse rounded bg-gray-200 ${i === lineas - 1 && lineas > 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}
