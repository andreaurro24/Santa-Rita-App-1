const TONOS = {
  neutro: 'bg-gray-100 text-gray-700',
  potrero: 'bg-brand-50 text-brand-800',
  cuero: 'bg-earth-100 text-earth-700',
  ok: 'bg-ok-50 text-ok',
  alerta: 'bg-alerta-50 text-alerta-900',
  peligro: 'bg-peligro-50 text-peligro',
};

export default function Badge({ tono = 'neutro', icono: Icono, className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONOS[tono]} ${className}`}>
      {Icono && <Icono size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}
