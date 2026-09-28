import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, UserPlus, UserPen, ClipboardCheck, Handshake, AlertTriangle } from 'lucide-react';
import { useHato } from '../data/hato';
import { useFincas } from '../data/fincas';
import {
  useContratos,
  useTenedores,
  useGuardarTenedor,
  useGuardarContrato,
  useAsignarAContrato,
  useVisitas,
  useRegistrarVisita,
} from '../data/alPartir';
import { pesoActual, formatCOP } from '../domain/breakeven';
import { gdpLote, variacionSospechosa } from '../domain/gdp';
import { ConDatos } from '../components/EstadoCarga';
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

const promedio = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);

// Spec 007 · R1, R2, R4: tenedores y contratos con el resumen de sus animales.
export function AlPartirLista() {
  const contratos = useContratos();
  const hato = useHato();
  const [tenedorForm, setTenedorForm] = useState(false);
  const [contratoForm, setContratoForm] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Al partir</h1>
          <p className="text-sm text-gray-500">Animales en fincas de terceros: quién los cuida, con qué contrato y cuándo se revisaron.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variante="secundario" icono={UserPlus} onClick={() => setTenedorForm(true)}>
            Nuevo tenedor
          </Button>
          <Button icono={Plus} onClick={() => setContratoForm(true)}>
            Nuevo contrato
          </Button>
        </div>
      </div>
      <ConDatos queries={[contratos, hato]}>
        {() =>
          contratos.data.length === 0 ? (
            <EmptyState titulo="Sin contratos">Registra un tenedor y su contrato para seguir los animales que están en su finca.</EmptyState>
          ) : (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {contratos.data.map((c) => {
                const suyos = hato.data.animales.filter((a) => a.contratoId === c.id && a.estado === 'Activo');
                return (
                  <li key={c.id}>
                    <Link to={`/al-partir/${c.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-earth-300">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="mr-auto text-lg font-bold text-gray-900">{c.tenedor.nombre}</h2>
                        <Badge tono="cuero">{c.porcentaje} % de la ganancia</Badge>
                        <Badge tono={c.estado === 'vigente' ? 'ok' : 'neutro'}>{c.estado === 'vigente' ? 'Vigente' : 'Terminado'}</Badge>
                      </div>
                      <p className="mb-3 text-sm text-gray-600">{c.tenedor.fincaNombre ?? 'Sin finca registrada'}</p>
                      <div className="grid grid-cols-3 gap-3">
                        <Stat label="Reses" value={suyos.length} />
                        <Stat label="Peso promedio" value={suyos.length ? `${promedio(suyos.map(pesoActual))} kg` : '—'} />
                        <Stat label="Última visita" value={c.ultimaVisita ? formatFecha(c.ultimaVisita) : 'Ninguna'} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        }
      </ConDatos>
      {tenedorForm && <TenedorForm onClose={() => setTenedorForm(false)} />}
      {contratoForm && <ContratoForm onClose={() => setContratoForm(false)} />}
    </div>
  );
}

export function ContratoDetalle() {
  const { contratoId } = useParams();
  const contratos = useContratos();
  const hato = useHato();
  return (
    <ConDatos queries={[contratos, hato]}>
      {() => {
        const contrato = contratos.data.find((c) => c.id === contratoId);
        return contrato ? (
          <DetalleContrato contrato={contrato} animales={hato.data.animales} />
        ) : (
          <EmptyState titulo="Ese contrato no existe" accion={<Link to="/al-partir" className="font-medium text-brand-700">Ver contratos</Link>} />
        );
      }}
    </ConDatos>
  );
}

function DetalleContrato({ contrato, animales }) {
  const [editando, setEditando] = useState(false);
  const [editandoTenedor, setEditandoTenedor] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [visitando, setVisitando] = useState(false);
  const visitas = useVisitas(contrato.id);
  const suyos = animales.filter((a) => a.contratoId === contrato.id && a.estado === 'Activo').sort((a, b) => a.numeroInterno.localeCompare(b.numeroInterno));
  const vigente = contrato.estado === 'vigente';
  const numero = (id) => animales.find((a) => a.id === id)?.numeroInterno ?? '—';

  return (
    <div className="space-y-5">
      <Link to="/al-partir" className="inline-flex min-h-12 items-center gap-1 text-sm text-gray-600 hover:text-brand-700 md:min-h-0">
        <ArrowLeft size={16} aria-hidden="true" /> Al partir
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{contrato.tenedor.nombre}</h1>
          <p className="text-sm text-gray-600">
            {contrato.tenedor.fincaNombre ?? 'Sin finca'}
            {contrato.tenedor.telefono ? `, tel. ${contrato.tenedor.telefono}` : ''}. Contrato {vigente ? 'vigente' : 'terminado'}
            {contrato.fechaInicio ? ` desde el ${formatFecha(contrato.fechaInicio)}` : ''}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variante="secundario" icono={UserPen} onClick={() => setEditandoTenedor(true)}>
            Editar tenedor
          </Button>
          <Button variante="secundario" icono={Pencil} onClick={() => setEditando(true)}>
            Editar contrato
          </Button>
          {vigente && (
            <Button variante="secundario" icono={Plus} onClick={() => setAsignando(true)}>
              Asignar animales
            </Button>
          )}
          <Button icono={ClipboardCheck} disabled={!suyos.length} onClick={() => setVisitando(true)}>
            Registrar visita
          </Button>
        </div>
      </div>

      <Card titulo="Condiciones y estado" icono={Handshake}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Stat label="Participación del tenedor" value={`${contrato.porcentaje} %`} sub="de la ganancia neta" />
          <Stat label="Precio del animal" value={contrato.precioAnimalCop != null ? `$${formatCOP(contrato.precioAnimalCop)}` : '—'} />
          <Stat label="Precio por kilo" value={contrato.precioKgCop != null ? `$${formatCOP(contrato.precioKgCop)}` : '—'} />
          <Stat label="Reses" value={suyos.length} sub={suyos.length ? `promedio ${promedio(suyos.map(pesoActual))} kg` : undefined} />
          <Stat label="Ganancia diaria" value={formatoGdp(gdpLote(suyos))} />
        </div>
      </Card>

      <Card titulo={`Animales (${suyos.length})`}>
        {suyos.length === 0 ? (
          <EmptyState titulo="Este contrato no tiene animales">{vigente ? 'Asígnale animales activos del hato.' : 'El contrato terminó.'}</EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {suyos.map((a) => (
              <li key={a.id}>
                <Link to={`/animales/${a.id}`} className="flex min-h-12 items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 hover:bg-earth-50">
                  <Chapeta numero={a.numeroInterno} />
                  <span className="cifra font-bold text-gray-900">{pesoActual(a)} kg</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card titulo="Visitas de verificación" icono={ClipboardCheck}>
        <ConDatos queries={visitas}>
          {() =>
            visitas.data.length === 0 ? (
              <EmptyState titulo="Sin visitas registradas">Cuando visites la finca sin previo aviso, registra aquí los pesos que tomes.</EmptyState>
            ) : (
              <ul className="divide-y divide-gray-100">
                {visitas.data.map((v) => {
                  const noEncontrados = v.revisiones.filter((r) => !r.encontrado);
                  return (
                    <li key={v.id} className="space-y-1 py-3 text-sm">
                      <p className="font-semibold text-gray-900">
                        {formatFecha(v.fecha)}: {v.revisiones.length - noEncontrados.length} pesados
                        {noEncontrados.length > 0 && <span className="text-brasa">, {noEncontrados.length} no encontrados</span>}
                      </p>
                      <p className="flex flex-wrap gap-x-3 gap-y-1 text-gray-700">
                        {v.revisiones.map((r) => (
                          <span key={r.animalId}>
                            {numero(r.animalId)}: {r.encontrado ? `${r.pesoKg} kg` : 'no encontrado'}
                          </span>
                        ))}
                      </p>
                      {v.notas && <p className="text-gray-500">{v.notas}</p>}
                    </li>
                  );
                })}
              </ul>
            )
          }
        </ConDatos>
      </Card>

      {editando && <ContratoForm contrato={contrato} onClose={() => setEditando(false)} />}
      {editandoTenedor && <TenedorForm tenedor={contrato.tenedor} onClose={() => setEditandoTenedor(false)} />}
      {asignando && <AsignarForm contrato={contrato} animales={animales} onClose={() => setAsignando(false)} />}
      {visitando && <VisitaForm contrato={contrato} animales={suyos} onClose={() => setVisitando(false)} />}
    </div>
  );
}

// R1: crear o editar un tenedor (verificación 007, Alto: faltaba editar).
function TenedorForm({ tenedor, onClose }) {
  const guardar = useGuardarTenedor();
  const fincas = useFincas();
  const [form, setForm] = useState({ id: tenedor?.id, nombre: tenedor?.nombre ?? '', telefono: tenedor?.telefono ?? '', fincaId: tenedor?.fincaId ?? '', fincaNueva: '' });
  const [error, setError] = useState('');
  const set = (c, v) => setForm((f) => ({ ...f, [c]: v }));
  const deTenedores = fincas.data?.filter((f) => f.tipo === 'tenedor') ?? [];

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return setError('Escribe el nombre del tenedor.');
    if (!form.fincaId && !form.fincaNueva.trim()) return setError('Elige la finca del tenedor o escribe el nombre de una nueva.');
    setError('');
    guardar.mutate(form, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) });
  }

  return (
    <Modal
      titulo={tenedor ? 'Editar tenedor' : 'Nuevo tenedor'}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-tenedor" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-tenedor" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nombre" required>
          <Input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
        </Field>
        <Field label="Teléfono">
          <Input type="tel" inputMode="tel" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
        </Field>
        <Field label="Finca" className="sm:col-span-2">
          <Select value={form.fincaId} onChange={(e) => set('fincaId', e.target.value)}>
            <option value="">Una finca nueva</option>
            {deTenedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </Select>
        </Field>
        {!form.fincaId && (
          <Field label="Nombre de la finca nueva" className="sm:col-span-2">
            <Input value={form.fincaNueva} onChange={(e) => set('fincaNueva', e.target.value)} placeholder="Finca El Porvenir" />
          </Field>
        )}
        <div className="sm:col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  );
}

function ContratoForm({ contrato, onClose }) {
  const navigate = useNavigate();
  const guardar = useGuardarContrato();
  const tenedores = useTenedores();
  const [form, setForm] = useState({
    id: contrato?.id,
    tenedorId: contrato?.tenedor.id ?? '',
    fechaInicio: contrato?.fechaInicio ?? hoyISO(),
    precioAnimalCop: contrato?.precioAnimalCop ?? '',
    precioKgCop: contrato?.precioKgCop ?? '',
    porcentaje: contrato?.porcentaje ?? 50,
    estado: contrato?.estado ?? 'vigente',
  });
  const [error, setError] = useState('');
  const set = (c, v) => setForm((f) => ({ ...f, [c]: v }));

  function handleSubmit(e) {
    e.preventDefault();
    const pct = Number(form.porcentaje);
    if (!form.tenedorId) return setError('Elige el tenedor.');
    if (String(form.porcentaje).trim() === '' || !(pct >= 0 && pct <= 100)) return setError('Escribe el porcentaje de la ganancia neta, entre 0 y 100.');
    if (form.fechaInicio && form.fechaInicio > hoyISO()) return setError('La fecha de inicio no puede ser futura.');
    for (const [campo, nombre] of [['precioAnimalCop', 'precio del animal'], ['precioKgCop', 'precio por kilo']]) {
      if (form[campo] !== '' && !Number.isInteger(Number(form[campo]))) return setError(`El ${nombre} va en pesos enteros, sin decimales.`);
      if (form[campo] !== '' && !(Number(form[campo]) >= 0)) return setError(`El ${nombre} no puede ser negativo.`);
    }
    setError('');
    guardar.mutate(form, {
      onSuccess: (id) => {
        onClose();
        if (!contrato) navigate(`/al-partir/${id}`);
      },
      onError: (err) => setError(mensajeError(err)),
    });
  }

  return (
    <Modal
      titulo={contrato ? 'Editar contrato' : 'Nuevo contrato'}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-contrato" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-contrato" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tenedor" className="sm:col-span-2">
          <Select value={form.tenedorId} onChange={(e) => set('tenedorId', e.target.value)} disabled={Boolean(contrato)}>
            <option value="">{tenedores.isPending ? 'Cargando…' : 'Elige el tenedor'}</option>
            {tenedores.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Porcentaje de la ganancia neta (%)">
          <Input type="number" min="0" max="100" step="0.5" inputMode="decimal" value={form.porcentaje} onChange={(e) => set('porcentaje', e.target.value)} />
        </Field>
        <Field label="Fecha de inicio">
          <Input type="date" value={form.fechaInicio ?? ''} max={hoyISO()} onChange={(e) => set('fechaInicio', e.target.value)} />
        </Field>
        <Field label="Precio del animal (COP)">
          <Input type="number" min="0" step="1" inputMode="numeric" value={form.precioAnimalCop} onChange={(e) => set('precioAnimalCop', e.target.value)} />
        </Field>
        <Field label="Precio por kilo (COP)">
          <Input type="number" min="0" step="1" inputMode="numeric" value={form.precioKgCop} onChange={(e) => set('precioKgCop', e.target.value)} />
        </Field>
        <Field label="Estado" className="sm:col-span-2">
          <Select value={form.estado} onChange={(e) => set('estado', e.target.value)}>
            <option value="vigente">Vigente</option>
            <option value="terminado">Terminado</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  );
}

// R3: elegir animales activos que no están "Al partir" y pasarlos al contrato.
function AsignarForm({ contrato, animales, onClose }) {
  const asignar = useAsignarAContrato();
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [motivo, setMotivo] = useState('Entrega Al partir');
  const [fecha, setFecha] = useState(hoyISO());
  const [error, setError] = useState('');
  const candidatos = useMemo(
    () =>
      animales
        .filter((a) => a.estado === 'Activo' && !a.contratoId && a.numeroInterno.includes(busqueda.trim()))
        .sort((a, b) => a.numeroInterno.localeCompare(b.numeroInterno)),
    [animales, busqueda],
  );

  function alternar(id) {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!seleccion.size) return setError('Selecciona al menos un animal.');
    if (!motivo.trim()) return setError('Escribe el motivo.');
    if (!fecha || fecha > hoyISO()) return setError('La fecha no puede ser futura.');
    setError('');
    asignar.mutate({ ids: [...seleccion], contratoId: contrato.id, fecha, motivo }, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) });
  }

  return (
    <Modal
      titulo={`Asignar animales a ${contrato.tenedor.nombre}`}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-asignar" disabled={asignar.isPending}>
            {asignar.isPending ? 'Asignando…' : `Asignar${seleccion.size ? ` (${seleccion.size})` : ''}`}
          </Button>
        </>
      }
    >
      <form id="form-asignar" onSubmit={handleSubmit} noValidate className="space-y-3">
        <p className="text-sm text-gray-600">Los animales pasan a {contrato.tenedor.fincaNombre ?? 'la finca del tenedor'} y queda el movimiento en su historial.</p>
        <Field label="Buscar por número interno">
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} inputMode="numeric" />
        </Field>
        <ul className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {candidatos.map((a) => (
            <li key={a.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-2 has-[:checked]:border-earth-500 has-[:checked]:bg-earth-50">
                <input type="checkbox" className="size-5 accent-earth-600" checked={seleccion.has(a.id)} onChange={() => alternar(a.id)} aria-label={`Asignar ${a.numeroInterno}`} />
                <Chapeta numero={a.numeroInterno} />
              </label>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Motivo">
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
          </Field>
        </div>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  );
}

// R5, R6: una fila por animal del contrato: su peso o "no encontrado". Un animal sin peso ni
// marca queda como no encontrado (R6), y un peso con más de 15 % de diferencia frente al último
// pide confirmación, como en la jornada de pesaje (verificación 007).
function VisitaForm({ contrato, animales, onClose }) {
  const registrar = useRegistrarVisita();
  const [fecha, setFecha] = useState(hoyISO());
  const [notas, setNotas] = useState('');
  const [filas, setFilas] = useState(() => Object.fromEntries(animales.map((a) => [a.id, { peso: '', noEncontrado: false }])));
  const [error, setError] = useState('');
  const [confirmados, setConfirmados] = useState(null); // firma de los pesos ya confirmados
  const set = (id, campo, valor) => {
    setFilas((f) => ({ ...f, [id]: { ...f[id], [campo]: valor } }));
    setError('');
    setConfirmados(null);
  };
  const sinDato = animales.filter((a) => !filas[a.id].noEncontrado && filas[a.id].peso.trim() === '');

  function handleSubmit(e) {
    e.preventDefault();
    if (!fecha || fecha > hoyISO()) return setError('La fecha de la visita no puede ser futura.');
    const revisiones = [];
    const sospechosos = [];
    for (const a of animales) {
      const f = filas[a.id];
      if (f.noEncontrado || f.peso.trim() === '') {
        revisiones.push({ animalId: a.id, pesoKg: null });
        continue;
      }
      const peso = Math.round(Number(String(f.peso).replace(',', '.')) * 10) / 10;
      if (!(peso > 0 && peso < 1500)) return setError(`El peso de ${a.numeroInterno} debe estar entre 0,1 y 1.499 kg.`);
      if (variacionSospechosa(peso, pesoActual(a))) sospechosos.push(`${a.numeroInterno}: ${pesoActual(a)} → ${peso} kg`);
      revisiones.push({ animalId: a.id, pesoKg: peso });
    }
    const firma = JSON.stringify(revisiones);
    if (sospechosos.length && confirmados !== firma) {
      setConfirmados(firma);
      return setError(`Revisa estos pesos, cambian más de 15 % frente al último: ${sospechosos.join('; ')}. Si están bien, toca "Guardar visita" otra vez.`);
    }
    setError('');
    registrar.mutate({ contratoId: contrato.id, fecha, notas, revisiones }, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) });
  }

  return (
    <Modal
      titulo="Registrar visita de verificación"
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-visita" disabled={registrar.isPending}>
            {registrar.isPending ? 'Guardando…' : 'Guardar visita'}
          </Button>
        </>
      }
    >
      <form id="form-visita" onSubmit={handleSubmit} noValidate className="space-y-3">
        <Field label="Fecha de la visita">
          <Input
            type="date"
            value={fecha}
            max={hoyISO()}
            onChange={(e) => {
              setFecha(e.target.value);
              setError('');
            }}
          />
        </Field>
        <ul className="divide-y divide-gray-100">
          {animales.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-2">
              <Chapeta numero={a.numeroInterno} />
              <label className="min-w-32 flex-1">
                <span className="sr-only">Peso de {a.numeroInterno} (kg)</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={`Últ. ${pesoActual(a)}`}
                  value={filas[a.id].peso}
                  disabled={filas[a.id].noEncontrado}
                  onChange={(e) => set(a.id, 'peso', e.target.value)}
                />
              </label>
              <label className="flex min-h-12 items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="size-5 accent-earth-600"
                  checked={filas[a.id].noEncontrado}
                  onChange={(e) => set(a.id, 'noEncontrado', e.target.checked)}
                  aria-label={`No encontrado ${a.numeroInterno}`}
                />
                <span aria-hidden="true">No encontrado</span>
              </label>
            </li>
          ))}
        </ul>
        {sinDato.length > 0 && (
          <p className="flex gap-2 rounded-lg bg-alerta-50 px-3 py-2 text-sm text-alerta-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {sinDato.length} {sinDato.length === 1 ? 'animal sin peso quedará' : 'animales sin peso quedarán'} como no encontrados en esta visita.
          </p>
        )}
        <Field label="Notas">
          <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Estado del pasto, del agua, de los animales" />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  );
}
