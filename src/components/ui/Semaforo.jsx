import { CheckCircle2, Clock, HelpCircle, AlertTriangle } from 'lucide-react';

// Semáforo: color + ícono + frase, nunca solo color (legible para daltónicos y al sol).
const ESTADOS = {
  verde: { icono: CheckCircle2, clases: 'bg-ok text-white' },
  ambar: { icono: Clock, clases: 'bg-alerta text-gray-900' },
  rojo: { icono: AlertTriangle, clases: 'bg-peligro text-white' },
  gris: { icono: HelpCircle, clases: 'bg-gray-200 text-gray-800' },
};

export default function Semaforo({ estado = 'gris', grande = false, children }) {
  const { icono: Icono, clases } = ESTADOS[estado] ?? ESTADOS.gris;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${clases} ${
        grande ? 'px-4 py-2 text-base' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Icono size={grande ? 18 : 14} aria-hidden="true" />
      {children}
    </span>
  );
}
