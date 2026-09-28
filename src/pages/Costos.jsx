import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react';
import { useHato } from '../data/hato';
import { useLotes } from '../data/lotes';
import { useRepartoCostos, useGuardarCosto, useBorrarCosto } from '../data/costos';
import { useAuth } from '../context/AuthContext';
import { CATEGORIAS_COSTO, resumenCostosLote } from '../domain/costos';
import { formatCOP } from '../domain/breakeven';
import { ConDatos } from '../components/EstadoCarga';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Chapeta from '../components/ui/Chapeta';
import Stat from '../components/ui/Stat';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { Field, Input, Select, FormError } from '../components/ui/Field';
import { formatFecha, hoyISO } from '../utils/format';
import { mensajeError } from '../lib/errores';

const pesos = (n) => `$${formatCOP(Math.round(n))}`;

// Spec 008 · R1, R5, R6: registrar gastos y verlos por lote.
export default function Costos() {
  const hato = useHato();
  const lotes = useLotes();
  const costos = useRepartoCostos();
  return (
    <ConDatos queries={[hato, lotes, ...costos.queries]}>
      {() => <CostosContenido animales={hato.data.animales} lotes={lotes.data} costos={costos.costos} reparto={costos.reparto} />}
    </ConDatos>
  );
}

function CostosContenido({ animales, lotes, costos, reparto }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const loteId = params.get('lote') ?? lotes[0]?.id ?? '';
  const [editando, setEditando] = useState(null); // null | {} (nuevo) | costo
  const [borrando, setBorrando] = useState(null);

  const lote = lotes.find((l) => l.id === loteId);
  const animalesLote = useMemo(() => animales.filter((a) => a.loteId === loteId), [animales, loteId]);
  const costosLote = costos.filter((c) => c.loteId === loteId);
  const resumen = resumenCostosLote(animalesLote, costosLote, reparto);
  const numero = (id) => animales.find((a) => a.id === id)?.numeroInterno;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Insumos y costos</h1>
          <p className="text-sm text-gray-500">Lo que se gasta en cada lote. Se reparte entre sus animales para calcular el costo real.</p>
        </div>
        <Button icono={Plus} onClick={() => setEditando({ loteId })}>
          Registrar gasto
        </Button>
      </div>

      <Card>
        <Field label="Lote">
          <Select value={loteId} onChange={(e) => setParams({ lote: e.target.value })}>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {lote && (
        <Card titulo="Resumen del lote" icono={Receipt}>
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            <Stat label="Gastado en el lote" value={pesos(resumen.total)} />
            <Stat label="Costo acumulado promedio por res" value={resumen.promedioPorAnimal != null ? pesos(resumen.promedioPorAnimal) : '—'} sub="Compra + gastos" />
            <Stat label="Gastos registrados" value={costosLote.length} />
          </div>
          {resumen.total > 0 && (
            <ul className="space-y-2">
              {Object.entries(resumen.porCategoria)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, monto]) => (
                  <li key={cat} className="text-sm">
                    <div className="mb-0.5 flex justify-between">
                      <span className="text-gray-700">{CATEGORIAS_COSTO[cat]}</span>
                      <span className="cifra font-semibold text-gray-900">{pesos(monto)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                      <div className="h-full rounded-full bg-earth-500" style={{ width: `${(monto / resumen.total) * 100}%` }} />
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}

      <Card titulo="Gastos">
        {costosLote.length === 0 ? (
          <EmptyState titulo="Sin gastos en este lote" accion={<Button icono={Plus} onClick={() => setEditando({ loteId })}>Registrar gasto</Button>}>
            Registra el suplemento, la sal, los jornales y demás para que el punto de equilibrio sea real.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-gray-100">
            {costosLote.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
                <span className="w-24 shrink-0 text-gray-600">{formatFecha(c.fecha)}</span>
                <Badge tono="cuero">{CATEGORIAS_COSTO[c.categoria]}</Badge>
                {c.animalId ? <Chapeta numero={numero(c.animalId)} /> : <span className="text-gray-500">Todo el lote</span>}
                <span className="w-full min-w-0 break-words text-gray-800 sm:w-auto sm:flex-1">{c.descripcion}</span>
                <span className="cifra ml-auto font-bold text-gray-900">{pesos(c.montoCop)}</span>
                <span className="flex gap-1">
                  <Button variante="fantasma" tamano="sm" aria-label={`Editar gasto ${c.descripcion}`} onClick={() => setEditando(c)}>
                    <Pencil size={16} />
                  </Button>
                  {user?.rol === 'dueno' && (
                    <Button variante="fantasma" tamano="sm" aria-label={`Borrar gasto ${c.descripcion}`} onClick={() => setBorrando(c)}>
                      <Trash2 size={16} />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editando && <CostoForm costo={editando} lotes={lotes} animales={animales} onClose={() => setEditando(null)} />}
      {borrando && <BorrarCosto costo={borrando} onClose={() => setBorrando(null)} />}
    </div>
  );
}

function CostoForm({ costo, lotes, animales, onClose }) {
  const guardar = useGuardarCosto();
  const [form, setForm] = useState({
    id: costo.id,
    loteId: costo.loteId ?? lotes[0]?.id ?? '',
    animalId: costo.animalId ?? '',
    categoria: costo.categoria ?? 'suplemento',
    descripcion: costo.descripcion ?? '',
    montoCop: costo.montoCop != null ? String(costo.montoCop) : '',
    fecha: costo.fecha ?? hoyISO(),
  });
  const [error, setError] = useState('');
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor, ...(campo === 'loteId' ? { animalId: '' } : {}) }));
  // Activos del lote, más el animal ya asignado aunque hoy esté en otro lote (verificación 008).
  const animalesLote = animales
    .filter((a) => (a.loteId === form.loteId && a.estado === 'Activo') || a.id === costo.animalId)
    .sort((a, b) => a.numeroInterno.localeCompare(b.numeroInterno));

  function handleSubmit(e) {
    e.preventDefault();
    const texto = String(form.montoCop).trim().replace(/[\s$]/g, '');
    if (/[.,]\d{1,2}$/.test(texto)) return setError('El monto va en pesos enteros, sin centavos (por ejemplo 12500 o 12.500).');
    const monto = Number(texto.replace(/\./g, ''));
    if (!form.loteId) return setError('Elige el lote del gasto.');
    if (!form.descripcion.trim()) return setError('Describe el gasto (por ejemplo: 10 bultos de sal mineral).');
    if (!Number.isInteger(monto) || monto <= 0) return setError('El monto debe ser un número entero de pesos mayor que cero.');
    if (monto > 5_000_000_000) return setError('El monto supera $5.000 millones: revisa que no sobren ceros.');
    if (!form.fecha || form.fecha > hoyISO()) return setError('La fecha del gasto no puede ser futura.');
    setError('');
    guardar.mutate({ ...form, montoCop: monto }, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) });
  }

  return (
    <Modal
      titulo={costo.id ? 'Editar gasto' : 'Registrar gasto'}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-costo" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-costo" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Lote" className="sm:col-span-2">
          <Select value={form.loteId} onChange={(e) => set('loteId', e.target.value)}>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="¿Para quién?" className="sm:col-span-2" ayuda="Si es para todo el lote, se reparte entre sus animales.">
          <Select value={form.animalId} onChange={(e) => set('animalId', e.target.value)}>
            <option value="">Todo el lote</option>
            {animalesLote.map((a) => (
              <option key={a.id} value={a.id}>
                Solo el animal {a.numeroInterno}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Categoría">
          <Select value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
            {Object.entries(CATEGORIAS_COSTO).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Monto (COP)">
          <Input type="text" inputMode="numeric" value={form.montoCop} onChange={(e) => set('montoCop', e.target.value)} placeholder="450000" />
        </Field>
        <Field label="Descripción" className="sm:col-span-2">
          <Input value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="10 bultos de sal mineral" />
        </Field>
        <Field label="Fecha">
          <Input type="date" value={form.fecha} max={hoyISO()} onChange={(e) => set('fecha', e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  );
}

function BorrarCosto({ costo, onClose }) {
  const borrar = useBorrarCosto();
  const [error, setError] = useState('');
  return (
    <Modal
      titulo="¿Borrar este gasto?"
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button variante="peligro" disabled={borrar.isPending} onClick={() => borrar.mutate(costo.id, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) })}>
            {borrar.isPending ? 'Borrando…' : 'Borrar gasto'}
          </Button>
        </>
      }
    >
      <p className="text-gray-800">
        {costo.descripcion}, {pesos(costo.montoCop)} del {formatFecha(costo.fecha)}. Dejará de contar en el costo de los animales.
      </p>
      <div className="mt-3">
        <FormError>{error}</FormError>
      </div>
    </Modal>
  );
}
