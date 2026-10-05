import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, MoveRight, CheckCircle2, Receipt } from 'lucide-react';
import { useHato } from '../data/hato';
import { useLotes, useGuardarLote } from '../data/lotes';
import LoteForm from '../components/LoteForm';
import { ESTADO_LOTE, resumenLote, tenedoresDelLote } from '../domain/lotes';
import { useRepartoCostos } from '../data/costos';
import { resumenCostosLote } from '../domain/costos';
import { formatCOP } from '../domain/breakeven';
import { pesoActual } from '../domain/breakeven';
import { ConDatos } from '../components/EstadoCarga';
import MoverAnimales from '../components/MoverAnimales';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Chapeta from '../components/ui/Chapeta';
import Stat from '../components/ui/Stat';
import EmptyState from '../components/ui/EmptyState';
import { formatFecha, formatoGdp, hoyISO, formatKg, formatPct, cantidad } from '../utils/format';
import { mensajeError } from '../lib/errores';

// Une los lotes (tabla) con sus animales (hato) para calcular el resumen.
function useLotesConAnimales() {
  const lotes = useLotes();
  const hato = useHato();
  const datos = useMemo(() => {
    if (!lotes.data || !hato.data) return null;
    return lotes.data.map((l) => ({ ...l, animales: hato.data.animales.filter((a) => a.loteId === l.id) }));
  }, [lotes.data, hato.data]);
  return { queries: [lotes, hato], datos };
}

function textoProyeccion(p) {
  if (p.tipo === 'fecha') return `${formatFecha(p.fecha)} (en ${cantidad(p.dias, 'día', 'días')})`;
  if (p.tipo === 'meta_alcanzada') return 'Meta alcanzada';
  if (p.tipo === 'meta_estimada') return `Ya debería estar en la meta (peso estimado ${formatKg(p.pesoEstimadoHoy)}): confírmalo con un pesaje`;
  if (p.tipo === 'sin_animales') return 'Sin animales';
  if (p.tipo === 'sin_meta') return 'Sin meta de peso';
  return 'Sin datos suficientes';
}

// Spec 022 · R7: los lotes viven en la página Animales; /lotes lleva allá.
export function LotesLista() {
  return <Navigate to="/animales" replace />;
}

export function LoteDetalle() {
  const { loteId } = useParams();
  const { queries, datos } = useLotesConAnimales();
  return (
    <ConDatos queries={queries}>
      {() => {
        const lote = datos.find((l) => l.id === loteId);
        return lote ? (
          <DetalleContenido lote={lote} />
        ) : (
          <EmptyState titulo="Ese lote no existe" accion={<Link to="/animales" className="font-medium text-brand-700">Ver animales</Link>} />
        );
      }}
    </ConDatos>
  );
}

function DetalleContenido({ lote }) {
  const [editando, setEditando] = useState(false);
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [moviendo, setMoviendo] = useState(false);
  const guardar = useGuardarLote();
  const [errorListo, setErrorListo] = useState('');
  const r = resumenLote(lote, hoyISO());
  const activos = lote.animales.filter((a) => a.estado === 'Activo').sort((a, b) => a.numeroInterno.localeCompare(b.numeroInterno));

  function alternar(id) {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-5">
      <Link to={`/animales?lote=${lote.id}`} className="inline-flex min-h-12 items-center gap-1 text-base text-gray-600 hover:text-brand-700">
        <ArrowLeft size={18} aria-hidden="true" /> Volver a Animales
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{lote.nombre}</h1>
          <p className="text-sm text-gray-600">
            {lote.codigo}, {lote.tipo === 'cria' ? 'cría' : 'ceba'}
            {lote.fechaInicio ? `, desde el ${formatFecha(lote.fechaInicio)}` : ''}. Estado: {ESTADO_LOTE[lote.estado].label.toLowerCase()}.
          </p>
          {tenedoresDelLote(lote.animales).map((t) => (
            <Badge key={t} tono="cuero" className="mr-1 mt-1">
              Al partir · {t}
            </Badge>
          ))}
          {lote.descripcion && <p className="mt-2 max-w-prose text-base text-gray-800">{lote.descripcion}</p>}
        </div>
        <Button variante="secundario" icono={Pencil} onClick={() => setEditando(true)}>
          Editar lote
        </Button>
      </div>

      {r.proyeccion.tipo === 'meta_alcanzada' && lote.estado === 'activo' && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-ok bg-ok-50 p-4 text-sm text-gray-900">
          <CheckCircle2 size={18} className="text-ok" aria-hidden="true" />
          <span className="mr-auto">El peso promedio ya alcanzó la meta de sus animales. ¿Marcar el lote como listo para vender?</span>
          <Button tamano="sm" disabled={guardar.isPending} onClick={() => guardar.mutate({ ...lote, estado: 'listo' }, { onError: (err) => setErrorListo(mensajeError(err)) })}>
            Marcar como listo
          </Button>
          {errorListo && <p role="alert" className="w-full text-peligro">{errorListo}</p>}
        </div>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Stat label="Reses activas" value={r.nActivos} />
          <Stat label="Peso promedio" value={r.pesoPromedio != null ? `${formatKg(r.pesoPromedio)}` : '—'} />
          <Stat label="Meta (promedio de los animales)" value={r.meta != null ? `${formatKg(r.meta)}` : '—'} sub={r.avancePct != null ? `${formatPct(r.avancePct)} de avance` : undefined} />
          <Stat label="Ganancia diaria del lote" value={formatoGdp(r.gdp)} />
          <Stat label="Llega a la meta" value={textoProyeccion(r.proyeccion)} />
        </div>
      </Card>

      <CostosLote lote={lote} />

      <Card
        titulo={`Animales (${activos.length})`}
        accion={
          <Button tamano="sm" icono={MoveRight} disabled={!seleccion.size} onClick={() => setMoviendo(true)}>
            Mover seleccionados{seleccion.size ? ` (${seleccion.size})` : ''}
          </Button>
        }
      >
        {activos.length === 0 ? (
          <EmptyState titulo="Este lote no tiene animales activos">Muévelos desde otro lote o regístralos en el hato.</EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activos.map((a) => (
              <li key={a.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                  <input type="checkbox" className="size-5 accent-brand-700" checked={seleccion.has(a.id)} onChange={() => alternar(a.id)} aria-label={`Seleccionar ${a.numeroInterno}`} />
                  <Chapeta numero={a.numeroInterno} />
                  <span className="cifra font-bold text-gray-900">{formatKg(pesoActual(a))}</span>
                  <span className="ml-auto truncate text-xs text-gray-500">{[a.fincaNombre, a.potreroNombre].filter(Boolean).join(', ')}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editando && <LoteForm lote={lote} onClose={() => setEditando(false)} />}
      {moviendo && (
        <MoverAnimales
          animales={activos.filter((a) => seleccion.has(a.id))}
          onClose={() => setMoviendo(false)}
          onMovidos={() => setSeleccion(new Set())}
        />
      )}
    </div>
  );
}

// Spec 008 · R5: resumen de costos del lote.
function CostosLote({ lote }) {
  const { costos, reparto } = useRepartoCostos();
  if (!costos || !reparto) return null;
  const r = resumenCostosLote(lote.animales, costos.filter((c) => c.loteId === lote.id), reparto);
  return (
    <Card
      titulo="Costos"
      icono={Receipt}
      accion={
        <Link to={`/costos?lote=${lote.id}`} className="inline-flex min-h-12 items-center text-sm font-medium text-brand-700 hover:underline md:min-h-0">
          Ver gastos
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Gastado en el lote" value={`$${formatCOP(Math.round(r.total))}`} />
        <Stat label="Costo acumulado promedio por res" value={r.promedioPorAnimal != null ? `$${formatCOP(Math.round(r.promedioPorAnimal))}` : '—'} />
      </div>
    </Card>
  );
}
