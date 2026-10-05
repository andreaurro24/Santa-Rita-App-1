import { useState } from 'react';
import { Plus, MapPin, Pencil } from 'lucide-react';
import { useFincas, useCrearPotrero, useGuardarFinca } from '../data/fincas';
import { useHato } from '../data/hato';
import { useTenedores } from '../data/alPartir';
import { mensajeNombre } from '../utils/validar';
import { ConDatos } from '../components/EstadoCarga';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Field, Input, Select, FormError } from '../components/ui/Field';
import Modal from '../components/ui/Modal';
import { mensajeError } from '../lib/errores';
import { formatNumero, cantidad } from '../utils/format';

// Spec 006 · R5: fincas (propia y de tenedores) con sus potreros y cuántos animales tiene cada uno.
export default function Fincas() {
  const fincas = useFincas();
  const hato = useHato();
  const [nueva, setNueva] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fincas y potreros</h1>
          <p className="text-base text-gray-600">Dónde está el hato: Santa Rita y las fincas de los tenedores "Al partir".</p>
        </div>
        <Button icono={Plus} onClick={() => setNueva(true)}>
          Nueva finca
        </Button>
      </div>
      <ConDatos queries={[fincas, hato]}>
        {() => {
          const activos = hato.data.animales.filter((a) => a.estado === 'Activo');
          return fincas.data.length ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {fincas.data.map((f) => (
                <FincaCard key={f.id} finca={f} animales={activos.filter((a) => a.fincaId === f.id)} />
              ))}
            </div>
          ) : (
            <p className="text-base text-gray-700">Todavía no hay fincas. Toca "Nueva finca".</p>
          );
        }}
      </ConDatos>
      {nueva && <FincaForm onClose={() => setNueva(false)} />}
    </div>
  );
}

function FincaCard({ finca, animales }) {
  const [agregando, setAgregando] = useState(false);
  const [editando, setEditando] = useState(false);
  const sinPotrero = animales.filter((a) => !a.potreroId).length;
  return (
    <Card
      as="article"
      titulo={finca.nombre}
      icono={MapPin}
      accion={<Badge tono={finca.tipo === 'propia' ? 'potrero' : 'cuero'}>{finca.tipo === 'propia' ? 'Propia' : 'Tenedor'}</Badge>}
    >
      <p className="mb-1 text-base text-gray-800">
        A nombre de: <span className="font-semibold">{finca.propietario ?? finca.tenedores[0]?.nombre ?? 'sin registrar'}</span>
      </p>
      <p className="mb-3 text-base text-gray-600">
        {cantidad(animales.length, 'res activa', 'reses activas')}{finca.municipio ? `, ${finca.municipio}` : ''}
      </p>
      <ul className="mb-3 divide-y divide-gray-100">
        {finca.potreros.map((p) => (
          <li key={p.id} className="flex min-h-12 items-center justify-between gap-2 text-sm">
            <span className="font-medium text-gray-800">
              {p.nombre}
              {p.areaHa != null && <span className="font-normal text-gray-500"> ({formatNumero(p.areaHa)} ha)</span>}
            </span>
            <span className="text-gray-600">{cantidad(animales.filter((a) => a.potreroId === p.id).length, 'res', 'reses')}</span>
          </li>
        ))}
        {finca.potreros.length > 0 && sinPotrero > 0 && (
          <li className="flex min-h-12 items-center justify-between gap-2 text-sm text-gray-500">
            <span>Sin potrero asignado</span>
            <span>{cantidad(sinPotrero, 'res', 'reses')}</span>
          </li>
        )}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variante="suave" tamano="sm" icono={Plus} onClick={() => setAgregando(true)}>
          Agregar potrero
        </Button>
        <Button variante="secundario" tamano="sm" icono={Pencil} onClick={() => setEditando(true)}>
          Editar finca
        </Button>
      </div>
      {agregando && <PotreroForm finca={finca} onClose={() => setAgregando(false)} />}
      {editando && <FincaForm finca={finca} onClose={() => setEditando(false)} />}
    </Card>
  );
}

function PotreroForm({ finca, onClose }) {
  const crear = useCrearPotrero();
  const [nombre, setNombre] = useState('');
  const [areaHa, setAreaHa] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const problema = mensajeNombre(nombre, 'el nombre del potrero');
    if (problema) return setError(problema);
    if (areaHa !== '' && !(Number(areaHa) > 0)) return setError('El área debe ser mayor que cero.');
    setError('');
    crear.mutate({ fincaId: finca.id, nombre, areaHa }, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) });
  }

  // R9 (spec 002): hoja inferior en celular (verificación 006, Medio 4).
  return (
    <Modal
      titulo={`Nuevo potrero en ${finca.nombre}`}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={`form-potrero-${finca.id}`} disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Guardar potrero'}
          </Button>
        </>
      }
    >
    <form id={`form-potrero-${finca.id}`} onSubmit={handleSubmit} noValidate className="grid grid-cols-2 gap-3">
      <Field label="Nombre del potrero">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="La Ceiba" />
      </Field>
      <Field label="Área (ha)">
        <Input type="number" min="0.1" step="0.1" inputMode="decimal" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} />
      </Field>
      <div className="col-span-2">
        <FormError>{error}</FormError>
      </div>
    </form>
    </Modal>
  );
}

// Spec 020 · R1: finca a nombre de una persona; si es de un tenedor, se elige o se crea en "Al partir".
function FincaForm({ finca, onClose }) {
  const guardar = useGuardarFinca();
  const tenedores = useTenedores();
  const enlazado = finca?.tenedores?.[0];
  const [form, setForm] = useState({
    nombre: finca?.nombre ?? '',
    tipo: finca?.tipo ?? 'propia',
    municipio: finca?.municipio ?? '',
    propietario: finca?.propietario ?? '',
    tenedorId: enlazado?.id ?? '',
    tenedorNuevo: '',
  });
  const [error, setError] = useState('');
  const set = (c, v) => setForm((f) => ({ ...f, [c]: v }));
  const nuevoTenedor = form.tenedorId === 'nuevo';

  function enviar(e) {
    e.preventDefault();
    const problema =
      mensajeNombre(form.nombre, 'el nombre de la finca') ||
      mensajeNombre(form.municipio, 'el municipio', { opcional: true }) ||
      (form.tipo === 'propia' ? mensajeNombre(form.propietario, 'a nombre de quién está', { opcional: true }) : '') ||
      (form.tipo === 'tenedor' && nuevoTenedor ? mensajeNombre(form.tenedorNuevo, 'el nombre del tenedor') : '');
    if (problema) return setError(problema);
    if (form.tipo === 'tenedor' && !form.tenedorId) return setError('Elige el tenedor o crea uno nuevo.');
    const tenedor = tenedores.data?.find((t) => t.id === form.tenedorId);
    guardar.mutate(
      {
        id: finca?.id,
        nombre: form.nombre,
        tipo: form.tipo,
        municipio: form.municipio,
        propietario: form.tipo === 'tenedor' ? (nuevoTenedor ? form.tenedorNuevo : tenedor?.nombre) : form.propietario,
        tenedorId: nuevoTenedor ? null : form.tenedorId,
        tenedorNuevo: nuevoTenedor ? form.tenedorNuevo : null,
      },
      { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) },
    );
  }

  return (
    <Modal
      titulo={finca ? `Editar ${finca.nombre}` : 'Nueva finca'}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-finca" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-finca" onSubmit={enviar} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre de la finca" required className="sm:col-span-2">
          <Input value={form.nombre} maxLength={80} onChange={(e) => set('nombre', e.target.value)} />
        </Field>
        <Field label="Tipo">
          <Select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
            <option value="propia">Propia</option>
            <option value="tenedor">De un tenedor (Al partir)</option>
          </Select>
        </Field>
        <Field label="Municipio" ayuda="Opcional">
          <Input value={form.municipio} maxLength={80} onChange={(e) => set('municipio', e.target.value)} />
        </Field>
        {form.tipo === 'propia' ? (
          <Field label="A nombre de" ayuda="Opcional, por ejemplo: Familia (Rosana y Miguel)" className="sm:col-span-2">
            <Input value={form.propietario} maxLength={80} onChange={(e) => set('propietario', e.target.value)} />
          </Field>
        ) : (
          <>
            <Field label="Tenedor" required className="sm:col-span-2">
              <Select value={form.tenedorId} onChange={(e) => set('tenedorId', e.target.value)}>
                <option value="">{tenedores.isPending ? 'Cargando tenedores…' : 'Elige el tenedor'}</option>
                {tenedores.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
                <option value="nuevo">+ Crear un tenedor nuevo</option>
              </Select>
            </Field>
            {nuevoTenedor && (
              <Field label="Nombre del tenedor nuevo" required className="sm:col-span-2">
                <Input value={form.tenedorNuevo} maxLength={80} onChange={(e) => set('tenedorNuevo', e.target.value)} />
              </Field>
            )}
          </>
        )}
        <div className="sm:col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  );
}
