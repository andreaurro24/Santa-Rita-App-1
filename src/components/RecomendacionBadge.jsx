import { CheckCircle2, Clock, HelpCircle } from 'lucide-react';

// Paleta de estado (fija, nunca reutilizada para series de datos): good/warning/muted,
// siempre acompañada de ícono + etiqueta, nunca solo color, como pide la guía de dataviz.
const CONFIG = {
  VENDER: { label: 'Vender ahora', icon: CheckCircle2, color: '#0ca30c', bg: '#eafbea' },
  ESPERAR: { label: 'Esperar', icon: Clock, color: '#b8790f', bg: '#fef6e6' },
  SIN_DATOS_DE_COSTO: { label: 'Sin datos de costo', icon: HelpCircle, color: '#6b7280', bg: '#f3f4f6' },
};

export default function RecomendacionBadge({ recomendacion, size = 'md' }) {
  const cfg = CONFIG[recomendacion] ?? CONFIG.SIN_DATOS_DE_COSTO;
  const Icon = cfg.icon;
  const pad = size === 'lg' ? 'px-4 py-2 text-sm' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad}`}
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <Icon size={size === 'lg' ? 18 : 14} />
      {cfg.label}
    </span>
  );
}
