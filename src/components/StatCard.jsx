export default function StatCard({ icon: Icon, label, value, sub, tone = 'default' }) {
  const toneClasses = {
    default: 'text-brand-700 bg-brand-50',
    warning: 'text-amber-700 bg-amber-50',
    critical: 'text-red-700 bg-red-50',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
        </div>
        {Icon && (
          <span className={`rounded-lg p-2 ${toneClasses[tone]}`}>
            <Icon size={18} />
          </span>
        )}
      </div>
    </div>
  );
}
