// Campo con etiqueta. La etiqueta envuelve el control para que getByLabel y los lectores de
// pantalla los asocien sin ids.
export function Field({ label, required, ayuda, className = '', children }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-gray-700">
        {label}
        {required && <span className="text-peligro"> *</span>}
      </span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-gray-500">{ayuda}</span>}
    </label>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={`input ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`input ${className}`} {...props}>
      {children}
    </select>
  );
}

// Mensaje de error de formulario (role="alert" para que se anuncie).
export function FormError({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-peligro-50 px-3 py-2 text-sm text-peligro">
      {children}
    </p>
  );
}
