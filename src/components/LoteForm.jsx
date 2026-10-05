import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuardarLote } from '../data/lotes';
import { ESTADO_LOTE, vientresHaciaCeba } from '../domain/lotes';
import { mensajeNombre } from '../utils/validar';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { Field, Input, Select, FormError } from './ui/Field';
import { hoyISO } from '../utils/format';
import { mensajeError } from '../lib/errores';


// Specs 006, 020 y 022 · crear o editar un lote. Spec 022 · R6: ya no pide meta de peso (la meta es
// de cada animal). Al crear desde Animales, `alCrear` recibe el id (para filtrar por el lote nuevo).
export default function LoteForm({ lote, onClose, alCrear }) {
  const navigate = useNavigate();
  const guardar = useGuardarLote();
  const [form, setForm] = useState({
    id: lote?.id,
    codigo: lote?.codigo ?? '',
    nombre: lote?.nombre ?? '',
    tipo: lote?.tipo ?? 'ceba',
    fechaInicio: lote?.fechaInicio ?? hoyISO(),
    estado: lote?.estado ?? 'activo',
    descripcion: lote?.descripcion ?? '',
  });
  const [error, setError] = useState('');
  const [confirmarHembras, setConfirmarHembras] = useState(false);
  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setConfirmarHembras(false);
  };
  // R8 / D2: pasar a ceba un lote con vientres o terneras adentro pide confirmación.
  const hembras = lote && lote.tipo !== 'ceba' ? vientresHaciaCeba(lote.animales.filter((a) => a.estado === 'Activo'), { tipo: form.tipo }) : [];

  function handleSubmit(e) {
    e.preventDefault();
    // Spec 018 · R2: nombres sin caracteres raros. Spec 020 · R2: descripción opcional.
    const problema = mensajeNombre(form.codigo, 'el código', { maximo: 30 }) || mensajeNombre(form.nombre, 'el nombre del lote');
    if (problema) return setError(problema);
    if (form.descripcion.trim().length > 300) return setError('La descripción puede tener hasta 300 caracteres.');
    if (form.fechaInicio && form.fechaInicio > hoyISO()) return setError('La fecha de inicio no puede ser futura.');
    if (hembras.length && !confirmarHembras) {
      setError('');
      return setConfirmarHembras(true);
    }
    setError('');
    guardar.mutate(form, {
      onSuccess: (id) => {
        onClose();
        if (lote) return;
        if (alCrear) alCrear(id);
        else navigate(`/lotes/${id}`);
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
        <Field label="Descripción" ayuda="Opcional, por ejemplo: novillos comprados en Valledupar para vender en diciembre" className="sm:col-span-2">
          <textarea
            className="input min-h-24"
            maxLength={300}
            value={form.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
          />
        </Field>
        <Field label="Fecha de inicio">
          <Input type="date" value={form.fechaInicio ?? ''} max={hoyISO()} onChange={(e) => set('fechaInicio', e.target.value)} />
        </Field>
        <Field label="Estado">
          <Select value={form.estado} onChange={(e) => set('estado', e.target.value)}>
            {Object.entries(ESTADO_LOTE).map(([valor, { label }]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        {confirmarHembras && (
          <p role="alert" className="rounded-lg bg-alerta-50 px-3 py-2 text-sm text-alerta-900 sm:col-span-2">
            Este lote tiene {hembras.length} {hembras.length === 1 ? 'hembra' : 'hembras'} (vientres o terneras). Un lote de ceba es para vender y esas hembras
            no se venden. Toca Guardar otra vez solo si es correcto.
          </p>
        )}
        <div className="sm:col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  );
}
