import Button from './ui/Button';

// Botón que abre el selector de fotos. El input va encima del botón, invisible y del mismo tamaño
// (un toque lo abre y el área táctil es la del botón). `camara` abre la cámara trasera del celular
// (spec 024 · R1); sin ella, el celular ofrece la galería.
export default function BotonArchivo({ camara = false, onArchivo, disabled, etiqueta, children, className = '', ...boton }) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <Button {...boton} disabled={disabled} tabIndex={-1} aria-hidden="true" className="w-full">
        {children}
      </Button>
      <input
        type="file"
        accept="image/*"
        {...(camara ? { capture: 'environment' } : {})}
        disabled={disabled}
        aria-label={etiqueta ?? (typeof children === 'string' ? children : 'Elegir foto')}
        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          if (archivo) onArchivo(archivo);
        }}
      />
    </span>
  );
}
