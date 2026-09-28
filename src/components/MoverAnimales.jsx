import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useFincas, useMoverAnimales } from '../data/fincas';
import { useLotes } from '../data/lotes';
import { vientresHaciaCeba } from '../domain/lotes';
import { mensajeError } from '../lib/errores';
import { hoyISO } from '../utils/format';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Chapeta from './ui/Chapeta';
import { Field, Input, Select, FormError } from './ui/Field';

// Spec 006 · R6, R8: mover uno o varios animales a otra finca, potrero y/o lote.
export default function MoverAnimales({ animales, onClose, onMovidos }) {
  const fincas = useFincas();
  const lotes = useLotes();
  const mover = useMoverAnimales();
  const [destino, setDestino] = useState({ fincaId: '', potreroId: '', loteId: '' });
  const [fecha, setFecha] = useState(hoyISO());
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [confirmarVientres, setConfirmarVientres] = useState(false);

  const finca = fincas.data?.find((f) => f.id === destino.fincaId);
  const loteDestino = lotes.data?.find((l) => l.id === destino.loteId);
  const vientres = vientresHaciaCeba(animales, loteDestino);

  function set(campo, valor) {
    setDestino((d) => ({ ...d, [campo]: valor, ...(campo === 'fincaId' ? { potreroId: '' } : {}) }));
    setConfirmarVientres(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!destino.fincaId && !destino.loteId) return setError('Elige una finca o un lote de destino.');
    if (!motivo.trim()) return setError('Escribe el motivo del movimiento.');
    if (!fecha || fecha > hoyISO()) return setError('La fecha del movimiento no puede ser futura.');
    // R8 / D2: un vientre no se vende; pasarlo a un lote de ceba pide confirmación explícita.
    if (vientres.length && !confirmarVientres) {
      setConfirmarVientres(true);
      return setError('');
    }
    setError('');
    mover.mutate(
      { ids: animales.map((a) => a.id), fecha, motivo, fincaId: destino.fincaId, potreroId: destino.potreroId, loteId: destino.loteId },
      {
        onSuccess: () => {
          onMovidos?.();
          onClose();
        },
        onError: (err) => setError(mensajeError(err)),
      },
    );
  }

  return (
    <Modal
      titulo={animales.length === 1 ? `Mover ${animales[0].numeroInterno}` : `Mover ${animales.length} animales`}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-mover" disabled={mover.isPending}>
            {mover.isPending ? 'Moviendo…' : confirmarVientres ? 'Mover de todas formas' : 'Mover'}
          </Button>
        </>
      }
    >
      <form id="form-mover" onSubmit={handleSubmit} noValidate className="space-y-3">
        {animales.length > 1 && (
          <ul className="flex flex-wrap gap-1.5">
            {animales.map((a) => (
              <li key={a.id}>
                <Chapeta numero={a.numeroInterno} />
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Finca de destino">
            <Select value={destino.fincaId} onChange={(e) => set('fincaId', e.target.value)}>
              <option value="">No cambiar</option>
              {fincas.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                  {f.tipo === 'tenedor' ? ' (tenedor)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Potrero">
            <Select value={destino.potreroId} onChange={(e) => set('potreroId', e.target.value)} disabled={!finca?.potreros.length}>
              <option value="">{finca ? (finca.potreros.length ? 'Sin potrero' : 'Esta finca no tiene potreros') : 'Elige primero la finca'}</option>
              {finca?.potreros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lote de destino" className="sm:col-span-2">
            <Select value={destino.loteId} onChange={(e) => set('loteId', e.target.value)}>
              <option value="">No cambiar</option>
              {lotes.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha">
            <Input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Motivo" required>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por ejemplo: rotación de potrero" />
          </Field>
        </div>
        {confirmarVientres && (
          <p role="alert" className="flex gap-2 rounded-lg bg-alerta-50 px-3 py-2 text-sm text-alerta-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {vientres.map((v) => v.numeroInterno).join(', ')} {vientres.length === 1 ? 'es un vientre' : 'son vientres'}: las vacas paridas o con potencial
            reproductivo no se venden, y un lote de ceba es para vender. Confirma solo si es correcto.
          </p>
        )}
        <FormError>{error}</FormError>
      </form>
    </Modal>
  );
}
