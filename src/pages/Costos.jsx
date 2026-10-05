import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react';
import { useHato } from '../data/hato';
import { useLotes } from '../data/lotes';
import { useFincas } from '../data/fincas';
import { useRepartoCostos, useGuardarCosto, useBorrarCosto } from '../data/costos';
import { useAuth } from '../context/AuthContext';
import { CATEGORIAS_COSTO, resumenCostosLote } from '../domain/costos';
import { tenedoresDelLote } from '../domain/lotes';
import { formatCOP } from '../domain/breakeven';
import { ConDatos } from '../components/EstadoCarga';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Chapeta from '../components/ui/Chapeta';
import Stat from '../components/ui/Stat';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import CampoPesos from '../components/ui/CampoPesos';
import { Field, Input, Select, FormError } from '../components/ui/Field';
import { formatFecha, hoyISO } from '../utils/format';
import { numeroAPesos, pesosANumero } from '../utils/validar';
import { mensajeError } from '../lib/errores';

const pesos = (n) => `$${formatCOP(Math.round(n))}`;
const FINCA = 'finca';

// Spec 008 · R1, R5, R6: registrar gastos y verlos por lote.
// Spec 020 · R3, R4: también gastos de la finca entera; los lotes "Al partir" llevan su marca.
export default function Costos() {
  const hato = useHato();
  const lotes = useLotes();
  const fincas = useFincas();
  const costos = useRepartoCostos();
  return (
    <ConDatos queries={[hato, lotes, fincas, ...costos.queries]}>
      {() => <CostosContenido animales={hato.data.animales} lotes={lotes.data} fincas={fincas.data} costos={costos.costos} reparto={costos.reparto} />}
    </ConDatos>
  );
}

// Etiqueta del lote con su marca "Al partir · tenedor" (R3).
function etiquetaLote(lote, animales) {
  const tenedores = tenedoresDelLote(animales.filter((a) => a.loteId === lote.id));
  return tenedores.length ? `${lote.nombre} · Al partir: ${tenedores.join(', ')}` : lote.nombre;
}

function CostosContenido({ animales, lotes, fincas, costos, reparto }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const ver = params.get('ver') === FINCA ? FINCA : params.get('lote') ?? lotes[0]?.id ?? FINCA;
  const esFinca = ver === FINCA;
  const [editando, setEditando] = useState(params.get('nuevo') === '1' ? { fincaId: esFinca ? fincas[0]?.id : null, loteId: esFinca ? null : ver } : null);
  const [borrando, setBorrando] = useState(null);

  const lote = lotes.find((l) => l.id === ver);
  const animalesLote = useMemo(() => animales.filter((a) => a.loteId === ver), [animales, ver]);
  const lista = esFinca ? costos.filter((c) => !c.loteId) : costos.filter((c) => c.loteId === ver);
  const resumen = esFinca ? null : resumenCostosLote(animalesLote, lista, reparto);
  const totalFinca = esFinca ? lista.reduce((s, c) => s + c.montoCop, 0) : 0;
  const sinRepartir = esFinca ? [] : (reparto.sinRepartir ?? []).filter((c) => c.loteId === ver);
  const numero = (id) => animales.find((a) => a.id === id)?.numeroInterno;
  const nombreFinca = (id) => fincas.find((f) => f.id === id)?.nombre ?? 'Finca';
  const tenedores = lote ? tenedoresDelLote(animalesLote) : [];

  function cambiar(valor) {
    setParams(valor === FINCA ? { ver: FINCA } : { lote: valor });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gastos</h1>
          <p className="text-base text-gray-600">Lo que se gasta en la finca y en cada lote. Los gastos de un lote se reparten entre sus animales.</p>
        </div>
        <Button icono={Plus} onClick={() => setEditando(esFinca ? { fincaId: fincas[0]?.id } : { loteId: ver })}>
          Anotar gasto
        </Button>
      </div>

      <Card>
        <Field label="Ver gastos de">
          <Select value={ver} onChange={(e) => cambiar(e.target.value)}>
            <option value={FINCA}>Toda la finca (gastos generales)</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {etiquetaLote(l, animales)}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {esFinca ? (
        <Card titulo="Gastos generales de la finca" icono={Receipt}>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Total" value={pesos(totalFinca)} />
            <Stat label="Gastos registrados" value={lista.length} />
          </div>
          <p className="mt-3 text-base text-gray-700">Estos gastos no se reparten entre los animales: no cambian el costo de cada res.</p>
        </Card>
      ) : (
        lote && (
          <Card titulo="Resumen del lote" icono={Receipt} accion={tenedores.map((t) => <Badge key={t} tono="cuero">Al partir · {t}</Badge>)}>
            <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              <Stat label="Gastado en el lote" value={pesos(resumen.total)} />
              <Stat label="Costo acumulado promedio por res" value={resumen.promedioPorAnimal != null ? pesos(resumen.promedioPorAnimal) : '—'} sub="Compra + gastos" />
              <Stat label="Gastos registrados" value={lista.length} />
            </div>
            {sinRepartir.length > 0 && (
              <p role="status" className="mb-4 rounded-lg bg-alerta-50 px-3 py-2 text-sm text-alerta-900">
                {sinRepartir.length === 1 ? 'Un gasto' : `${sinRepartir.length} gastos`} ({pesos(sinRepartir.reduce((s, c) => s + c.montoCop, 0))}) no se
                {sinRepartir.length === 1 ? ' reparte' : ' reparten'} entre ningún animal: en su fecha el lote no tenía animales. Revisa la fecha o asígnalo a un animal.
              </p>
            )}
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
        )
      )}

      <Card titulo="Gastos">
        {lista.length === 0 ? (
          <EmptyState
            titulo={esFinca ? 'Sin gastos generales' : 'Sin gastos en este lote'}
            accion={
              <Button icono={Plus} onClick={() => setEditando(esFinca ? { fincaId: fincas[0]?.id } : { loteId: ver })}>
                Anotar gasto
              </Button>
            }
          >
            {esFinca ? 'Combustible, cercas, herramientas y demás gastos de toda la finca.' : 'Registra el suplemento, la sal, los jornales y demás para que el punto de equilibrio sea real.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-gray-100">
            {lista.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-base">
                <span className="w-28 shrink-0 text-gray-600">{formatFecha(c.fecha)}</span>
                <Badge tono="cuero">{CATEGORIAS_COSTO[c.categoria]}</Badge>
                {c.fincaId ? (
                  <span className="text-gray-600">{nombreFinca(c.fincaId)}</span>
                ) : c.animalId ? (
                  <Chapeta numero={numero(c.animalId)} />
                ) : (
                  <span className="text-gray-600">Todo el lote</span>
                )}
                <span className="w-full min-w-0 break-words text-gray-800 sm:w-auto sm:flex-1">{c.descripcion}</span>
                <span className="cifra ml-auto text-lg font-bold text-gray-900">{pesos(c.montoCop)}</span>
                <span className="flex gap-1">
                  <Button variante="fantasma" tamano="sm" aria-label={`Editar gasto ${c.descripcion}`} onClick={() => setEditando(c)}>
                    <Pencil size={18} />
                  </Button>
                  {user?.rol === 'dueno' && (
                    <Button variante="fantasma" tamano="sm" aria-label={`Borrar gasto ${c.descripcion}`} onClick={() => setBorrando(c)}>
                      <Trash2 size={18} />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editando && <CostoForm costo={editando} lotes={lotes} fincas={fincas} animales={animales} onClose={() => setEditando(null)} />}
      {borrando && <BorrarCosto costo={borrando} onClose={() => setBorrando(null)} />}
    </div>
  );
}

function CostoForm({ costo, lotes, fincas, animales, onClose }) {
  const guardar = useGuardarCosto();
  const [form, setForm] = useState({
    id: costo.id,
    de: costo.fincaId ? FINCA : 'lote',
    fincaId: costo.fincaId ?? fincas[0]?.id ?? '',
    loteId: costo.loteId ?? lotes[0]?.id ?? '',
    animalId: costo.animalId ?? '',
    categoria: costo.categoria ?? (costo.fincaId ? 'otros' : 'suplemento'),
    descripcion: costo.descripcion ?? '',
    montoCop: costo.montoCop != null ? numeroAPesos(costo.montoCop) : '',
    fecha: costo.fecha ?? hoyISO(),
  });
  const [error, setError] = useState('');
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor, ...(campo === 'loteId' ? { animalId: '' } : {}) }));
  // Activos del lote, más el animal ya asignado aunque hoy esté en otro lote (verificación 008).
  const animalesLote = animales
    .filter((a) => (a.loteId === form.loteId && a.estado === 'Activo') || a.id === costo.animalId)
    .sort((a, b) => a.numeroInterno.localeCompare(b.numeroInterno));
  const esFinca = form.de === FINCA;

  function handleSubmit(e) {
    e.preventDefault();
    const monto = pesosANumero(form.montoCop);
    if (esFinca && !form.fincaId) return setError('Elige la finca del gasto.');
    if (!esFinca && !form.loteId) return setError('Elige el lote del gasto.');
    if (!form.descripcion.trim()) return setError('Describe el gasto (por ejemplo: 10 bultos de sal mineral).');
    if (form.descripcion.trim().length > 200) return setError('La descripción puede tener hasta 200 caracteres.');
    if (!(monto > 0)) return setError('Escribe el monto del gasto en pesos.');
    if (monto > 5_000_000_000) return setError('El monto supera $5.000 millones: revisa que no sobren ceros.');
    if (!form.fecha || form.fecha > hoyISO()) return setError('La fecha del gasto no puede ser futura.');
    setError('');
    guardar.mutate(
      { id: form.id, fincaId: esFinca ? form.fincaId : null, loteId: esFinca ? null : form.loteId, animalId: esFinca ? null : form.animalId, categoria: form.categoria, descripcion: form.descripcion, fecha: form.fecha, montoCop: monto },
      { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) },
    );
  }

  return (
    <Modal
      titulo={costo.id ? 'Editar gasto' : 'Anotar gasto'}
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
      <form id="form-costo" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-base font-semibold text-gray-800">¿De qué es el gasto?</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {[
              [FINCA, 'De toda la finca'],
              ['lote', 'De un lote o animal'],
            ].map(([valor, label]) => (
              <label
                key={valor}
                className={`relative flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-base font-semibold ${form.de === valor ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-borde-control bg-white text-gray-700'}`}
              >
                <input type="radio" name="de" value={valor} checked={form.de === valor} onChange={() => set('de', valor)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {esFinca ? (
          <Field label="Finca" className="sm:col-span-2" ayuda="No se reparte entre los animales.">
            <Select value={form.fincaId} onChange={(e) => set('fincaId', e.target.value)}>
              {fincas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <>
            <Field label="Lote" className="sm:col-span-2">
              <Select value={form.loteId} onChange={(e) => set('loteId', e.target.value)}>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {etiquetaLote(l, animales)}
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
          </>
        )}
        <Field label="Categoría">
          <Select value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
            {Object.entries(CATEGORIAS_COSTO).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Monto">
          <CampoPesos value={form.montoCop} onChange={(v) => set('montoCop', v)} placeholder="450.000" />
        </Field>
        <Field label="Descripción" className="sm:col-span-2">
          <Input value={form.descripcion} maxLength={200} onChange={(e) => set('descripcion', e.target.value)} placeholder="10 bultos de sal mineral" />
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
