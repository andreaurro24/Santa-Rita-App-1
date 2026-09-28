import Stat from './ui/Stat';

// Tarjeta de cifra del panel. `tone`: default | warning | critical.
const TONO = { default: 'neutro', warning: 'alerta', critical: 'peligro' };

export default function StatCard({ icon, label, value, sub, tone = 'default' }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${tone === 'default' ? 'border-gray-200' : 'border-alerta'}`}>
      <Stat icono={icon} label={label} value={value} sub={sub} tono={TONO[tone]} />
    </div>
  );
}
