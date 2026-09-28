import Semaforo from './ui/Semaforo';

// La recomendación siempre como semáforo + frase (docs/plan.md §7). Estados del motor v2 (spec 010).
const CONFIG = {
  VENDER: { estado: 'verde', label: 'Vender ahora' },
  VENDER_ANTICIPADO: { estado: 'verde', label: 'Vender antes de la meta' },
  ESPERAR: { estado: 'ambar', label: 'Esperar' },
  NO_VENDER: { estado: 'rojo', label: 'No vender todavía' },
  SIN_DATOS: { estado: 'gris', label: 'Faltan datos' },
};

export default function RecomendacionBadge({ recomendacion, size = 'md' }) {
  const cfg = CONFIG[recomendacion] ?? CONFIG.SIN_DATOS;
  return (
    <Semaforo estado={cfg.estado} grande={size === 'lg'}>
      {cfg.label}
    </Semaforo>
  );
}
