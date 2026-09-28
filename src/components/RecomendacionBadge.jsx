import Semaforo from './ui/Semaforo';

// La recomendación siempre como semáforo + frase (docs/plan.md §7).
const CONFIG = {
  VENDER: { estado: 'verde', label: 'Vender ahora' },
  ESPERAR: { estado: 'ambar', label: 'Esperar' },
  SIN_DATOS_DE_COSTO: { estado: 'gris', label: 'Sin datos de costo' },
};

export default function RecomendacionBadge({ recomendacion, size = 'md' }) {
  const cfg = CONFIG[recomendacion] ?? CONFIG.SIN_DATOS_DE_COSTO;
  return (
    <Semaforo estado={cfg.estado} grande={size === 'lg'}>
      {cfg.label}
    </Semaforo>
  );
}
