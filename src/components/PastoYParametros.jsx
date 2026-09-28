import { useState } from 'react';
import { Sprout, SlidersHorizontal, Plus, Pencil } from 'lucide-react';
import { useFincas } from '../data/fincas';
import { useCondicionPasto, useRegistrarPasto, useParametros, useGuardarParametros } from '../data/pasto';
import { ultimoPorFinca } from '../domain/pasto';
import { mensajeError } from '../lib/errores';
import { formatFecha, hoyISO } from '../utils/format';
import { ConDatos } from './EstadoCarga';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Semaforo from './ui/Semaforo';
import Stat from './ui/Stat';
import Modal from './ui/Modal';
import { Field, Input, Select, FormError } from './ui/Field';

const NIVEL = {
  verde: { estado: 'verde', label: 'Bien' },
  amarillo: { estado: 'ambar', label: 'Regular' },
  rojo: { estado: 'rojo', label: 'Escaso' },
};

// Spec 009 · R1, R2: último estado del pasto de cada finca.
export function EstadoPasto() {
  const fincas = useFincas();
  const pasto = useCondicionPasto();
  const [registrando, setRegistrando] = useState(false);
  return (
    <Card
      titulo="Estado del pasto"
      icono={Sprout}
      accion={
        <Button variante="suave" tamano="sm" icono={Plus} disabled={!fincas.data?.length} onClick={() => setRegistrando(true)}>
          Registrar estado
        </Button>
      }
    >
      <ConDatos queries={[fincas, pasto]}>
        {() => {
          const ultimos = ultimoPorFinca(pasto.data, hoyISO());
          return (
            <ul className="divide-y divide-gray-100">
              {fincas.data.map((f) => {
                const e = ultimos.get(f.id);
                return (
                  <li key={f.id} className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                    <span className="mr-auto font-medium text-gray-900">{f.nombre}</span>
                    {e ? (
                      <>
                        <Semaforo estado={NIVEL[e.nivel].estado}>{NIVEL[e.nivel].label}</Semaforo>
                        <span className="text-gray-600">{formatFecha(e.fecha)}</span>
                        {e.desactualizado && <Badge tono="alerta">Desactualizado</Badge>}
                      </>
                    ) : (
                      <span className="text-gray-500">Sin registro</span>
                    )}
                  </li>
                );
              })}
            </ul>
          );
        }}
      </ConDatos>
      {registrando && fincas.data && <PastoForm fincas={fincas.data} onClose={() => setRegistrando(false)} />}
    </Card>
  );
}

function PastoForm({ fincas, onClose }) {
  const registrar = useRegistrarPasto();
  const [form, setForm] = useState({ fincaId: fincas[0]?.id ?? '', potreroId: '', nivel: '', fecha: hoyISO(), notas: '' });
  const [error, setError] = useState('');
  const set = (c, v) => setForm((f) => ({ ...f, [c]: v, ...(c === 'fincaId' ? { potreroId: '' } : {}) }));
  const finca = fincas.find((f) => f.id === form.fincaId);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.fincaId) return setError('Elige la finca.');
    if (!form.nivel) return setError('Elige cómo está el pasto.');
    if (!form.fecha || form.fecha > hoyISO()) return setError('La fecha no puede ser futura.');
    setError('');
    registrar.mutate(form, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) });
  }

  return (
    <Modal
      titulo="Registrar estado del pasto"
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-pasto" disabled={registrar.isPending}>
            {registrar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-pasto" onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Finca">
            <Select value={form.fincaId} onChange={(e) => set('fincaId', e.target.value)}>
              {fincas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Potrero (opcional)">
            <Select value={form.potreroId} onChange={(e) => set('potreroId', e.target.value)} disabled={!finca?.potreros.length}>
              <option value="">Toda la finca</option>
              {finca?.potreros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">¿Cómo está el pasto?</legend>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(NIVEL).map(([valor, { label, estado }]) => (
              <label
                key={valor}
                className={`flex min-h-12 cursor-pointer items-center justify-center rounded-lg border-2 px-2 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-600 ${
                  form.nivel === valor ? 'border-brand-700' : 'border-transparent'
                }`}
              >
                <input type="radio" name="nivel" value={valor} checked={form.nivel === valor} onChange={() => set('nivel', valor)} className="sr-only" />
                <Semaforo estado={estado}>{label}</Semaforo>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Fecha">
            <Input type="date" value={form.fecha} max={hoyISO()} onChange={(e) => set('fecha', e.target.value)} />
          </Field>
          <Field label="Notas">
            <Input value={form.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Por ejemplo: rebrote después de la lluvia" />
          </Field>
        </div>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  );
}

// Spec 009 · R3: destare de la finca (D5).
export function ParametrosVenta() {
  const parametros = useParametros();
  const [editando, setEditando] = useState(false);
  return (
    <Card
      titulo="Parámetros de venta"
      icono={SlidersHorizontal}
      accion={
        <Button variante="suave" tamano="sm" icono={Pencil} onClick={() => setEditando(true)}>
          Cambiar destare
        </Button>
      }
    >
      <ConDatos queries={parametros}>
        {() => (
          <Stat
            label="Destare"
            value={`${parametros.data.destarePct.toLocaleString('es-CO')} %`}
            sub="Porcentaje que el comprador descuenta del peso en pie. Se usa en la recomendación de venta."
          />
        )}
      </ConDatos>
      {editando && parametros.data && <DestareForm actual={parametros.data.destarePct} onClose={() => setEditando(false)} />}
    </Card>
  );
}

function DestareForm({ actual, onClose }) {
  const guardar = useGuardarParametros();
  const [valor, setValor] = useState(String(actual));
  const [error, setError] = useState('');
  function handleSubmit(e) {
    e.preventDefault();
    const n = Number(String(valor).replace(',', '.'));
    if (!(n >= 0 && n <= 15)) return setError('El destare debe estar entre 0 y 15 %.');
    setError('');
    guardar.mutate({ destarePct: Math.round(n * 10) / 10 }, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) });
  }
  return (
    <Modal
      titulo="Cambiar destare"
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-destare" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-destare" onSubmit={handleSubmit} noValidate className="space-y-3">
        <Field label="Destare (%)" ayuda="Entre 0 y 15. Por defecto 0 hasta confirmar el valor con el comprador.">
          <Input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  );
}
