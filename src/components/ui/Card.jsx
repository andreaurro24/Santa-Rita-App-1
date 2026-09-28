// Superficie blanca con borde fino. `titulo` e `icono` opcionales; `accion` va a la derecha.
export default function Card({ titulo, icono: Icono, accion, className = '', children, as: Tag = 'section' }) {
  return (
    <Tag className={`rounded-xl border border-gray-200 bg-white p-4 md:p-5 ${className}`}>
      {(titulo || accion) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo && (
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              {Icono && <Icono size={18} className="text-brand-600" aria-hidden="true" />}
              {titulo}
            </h2>
          )}
          {accion && <div className="no-print">{accion}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
