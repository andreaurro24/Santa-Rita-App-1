import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, MoveRight, CheckCircle2 } from 'lucide-react';
import { useHato } from '../data/hato';
import { useLotes, useGuardarLote } from '../data/lotes';
import { resumenLote } from '../domain/lotes';
import { pesoActual } from '../domain/breakeven';
import { ConDatos } from '../components/EstadoCarga';
import MoverAnimales from '../components/MoverAnimales';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Chapeta from '../components/ui/Chapeta';
import Stat from '../components/ui/Stat';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { Field, Input, Select, FormError } from '../components/ui/Field';
import { formatFecha, formatoGdp, hoyISO } from '../utils/format';
import { mensajeError } from '../lib/errores';

const ESTADO_LOTE = {
  activo: { label: 'Activo', tono: 'potrero' },
  listo: { label: 'Listo para vender', tono: 'ok' },
  vendido: { label: 'Vendido', tono: 'neutro' },
  cerrado: { label: 'Cerrado', tono: 'neutro' },
};

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
  if (p.tipo === 'fecha') return `${formatFecha(p.fecha)} (en ${p.dias} días)`;
  if (p.tipo === 'meta_alcanzada') return 'Meta alcanzada';
  if (p.tipo === 'sin_animales') return 'Sin animales';
  return 'Sin datos suficientes';
}

export function LotesLista() {
  const { queries, datos } = useLotesConAnimales();
  const [nuevo, setNuevo] = useState(false);
  const hoy = hoyISO();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lotes y ciclos</h1>
          <p className="text-sm text-gray-500">Cada lote con su meta pactada y la fecha en que la alcanzaría al ritmo actual.</p>
        </div>
        <Button icono={Plus} onClick={() => setNuevo(true)}>
          Nuevo lote
        </Button>
      </div>
      <ConDatos queries={queries}>
        {() => (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {datos.map((l) => {
              const r = resumenLote(l, hoy);
              return (
                <li key={l.id}>
                  <Link to={`/lotes/${l.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-300">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="mr-auto text-lg font-bold text-gray-900">{l.nombre}</h2>
                      <Badge tono={l.tipo === 'cria' ? 'cuero' : 'potrero'}>{l.tipo === 'cria' ? 'Cría' : 'Ceba'}</Badge>
                      <Badge tono={ESTADO_LOTE[l.estado].tono}>{ESTADO_LOTE[l.estado].label}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <Stat label="Reses" value={r.nActivos} />
                      <Stat label="Peso promedio" value={r.pesoPromedio != null ? `${r.pesoPromedio} kg` : '—'} />
                      <Stat label="Meta" value={r.meta != null ? `${r.meta} kg` : '—'} />
                      <Stat label="Ganancia diaria" value={formatoGdp(r.gdp)} />
                    </div>
                    {r.avancePct != null && (
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, r.avancePct)}%` }} />
                      </div>
                    )}
                    <p className="mt-2 text-sm text-gray-700">
                      Llega a la meta: <span className="font-semibold">{textoProyeccion(r.proyeccion)}</span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </ConDatos>
      {nuevo && <LoteForm onClose={() => setNuevo(false)} />}
    </div>
  );
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
          <EmptyState titulo="Ese lote no existe" accion={<Link to="/lotes" className="font-medium text-brand-700">Ver lotes</Link>} />
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
      <Link to="/lotes" className="inline-flex min-h-12 items-center gap-1 text-sm text-gray-600 hover:text-brand-700 md:min-h-0">
        <ArrowLeft size={16} aria-hidden="true" /> Lotes
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{lote.nombre}</h1>
          <p className="text-sm text-gray-600">
            {lote.codigo}, {lote.tipo === 'cria' ? 'cría' : 'ceba'}
            {lote.fechaInicio ? `, desde el ${formatFecha(lote.fechaInicio)}` : ''}. Estado: {ESTADO_LOTE[lote.estado].label.toLowerCase()}.
          </p>
        </div>
        <Button variante="secundario" icono={Pencil} onClick={() => setEditando(true)}>
          Editar lote
        </Button>
      </div>

      {r.proyeccion.tipo === 'meta_alcanzada' && lote.estado === 'activo' && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-ok bg-ok-50 p-4 text-sm text-gray-900">
          <CheckCircle2 size={18} className="text-ok" aria-hidden="true" />
          <span className="mr-auto">El peso promedio ya alcanzó la meta pactada. ¿Marcar el lote como listo para vender?</span>
          <Button tamano="sm" disabled={guardar.isPending} onClick={() => guardar.mutate({ ...lote, estado: 'listo' })}>
            Marcar como listo
          </Button>
        </div>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Stat label="Reses activas" value={r.nActivos} />
          <Stat label="Peso promedio" value={r.pesoPromedio != null ? `${r.pesoPromedio} kg` : '—'} />
          <Stat label="Meta pactada" value={r.meta != null ? `${r.meta} kg` : '—'} sub={r.avancePct != null ? `${r.avancePct} % de avance` : undefined} />
          <Stat label="Ganancia diaria del lote" value={formatoGdp(r.gdp)} />
          <Stat label="Llega a la meta" value={textoProyeccion(r.proyeccion)} />
        </div>
      </Card>

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
                  <span className="cifra font-bold text-gray-900">{pesoActual(a)} kg</span>
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

function LoteForm({ lote, onClose }) {
  const navigate = useNavigate();
  const guardar = useGuardarLote();
  const [form, setForm] = useState({
    id: lote?.id,
    codigo: lote?.codigo ?? '',
    nombre: lote?.nombre ?? '',
    tipo: lote?.tipo ?? 'ceba',
    fechaInicio: lote?.fechaInicio ?? hoyISO(),
    pesoMeta: lote?.pesoMeta ?? '',
    estado: lote?.estado ?? 'activo',
  });
  const [error, setError] = useState('');
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.codigo.trim() || !form.nombre.trim()) return setError('El código y el nombre del lote son obligatorios.');
    if (form.pesoMeta !== '' && !(Number(form.pesoMeta) > 0 && Number(form.pesoMeta) < 1500)) return setError('La meta de peso debe estar entre 1 y 1.499 kg.');
    setError('');
    guardar.mutate(form, {
      onSuccess: (id) => {
        onClose();
        if (!lote) navigate(`/lotes/${id}`);
      },
      onError: (err) => setError(mensajeError(err)),
    });
  }

  return (
    <Modal
      titulo={lote ? 'Editar lote' : 'Nuevo lote'}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-lote" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-lote" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Código" required>
          <Input value={form.codigo} onChange={(e) => set('codigo', e.target.value)} placeholder="LOTE-2027-A" autoCapitalize="characters" />
        </Field>
        <Field label="Tipo">
          <Select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
            <option value="ceba">Ceba</option>
            <option value="cria">Cría</option>
          </Select>
        </Field>
        <Field label="Nombre" required className="sm:col-span-2">
          <Input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Lote 2027-A (Ceba)" />
        </Field>
        <Field label="Fecha de inicio">
          <Input type="date" value={form.fechaInicio ?? ''} onChange={(e) => set('fechaInicio', e.target.value)} />
        </Field>
        <Field label="Meta de peso pactada (kg)">
          <Input type="number" min="1" step="1" inputMode="numeric" value={form.pesoMeta} onChange={(e) => set('pesoMeta', e.target.value)} />
        </Field>
        <Field label="Estado" className="sm:col-span-2">
          <Select value={form.estado} onChange={(e) => set('estado', e.target.value)}>
            {Object.entries(ESTADO_LOTE).map(([valor, { label }]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  );
}
