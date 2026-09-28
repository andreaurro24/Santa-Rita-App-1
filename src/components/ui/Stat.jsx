const TONOS = {
  neutro: 'text-gray-900',
  ok: 'text-ok',
  alerta: 'text-alerta-900',
  peligro: 'text-peligro',
};

// Cifra con su etiqueta. La etiqueta va arriba en texto normal (no en mayúsculas sostenidas).
export default function Stat({ label, value, sub, tono = 'neutro', icono: Icono, grande = false }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-sm text-gray-500">
        {Icono && <Icono size={15} aria-hidden="true" />}
        {label}
      </p>
      <p className={`cifra mt-0.5 font-bold ${grande ? 'text-3xl' : 'text-2xl'} ${TONOS[tono]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
