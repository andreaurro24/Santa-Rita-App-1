import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, ChevronRight, TrendingDown, Upload } from 'lucide-react';
import { useHato, useAddAnimal, useContratosVigentes } from '../data/hato';
import { useAuth } from '../context/AuthContext';
import { ConDatos } from '../components/EstadoCarga';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Chapeta from '../components/ui/Chapeta';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { Field, Input, Select, FormError } from '../components/ui/Field';
import { pesoActual, fechaUltimoPesaje } from '../domain/breakeven';
import { pierdePeso } from '../domain/gdp';
import { vientresHaciaCeba } from '../domain/lotes';
import { formatFecha, hoyISO, formatKg } from '../utils/format';
import { mensajeError } from '../lib/errores';

export default function Animals() {
  const hato = useHato();
  return <ConDatos queries={hato}>{() => <HatoContenido {...hato.data} />}</ConDatos>;
}

function HatoContenido({ animales, lotes }) {
  const { user } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [loteFiltro, setLoteFiltro] = useState('TODOS');
  const [showForm, setShowForm] = useState(false);

  // Mientras solo Miguel use la app, todo miembro con perfil puede registrar (docs/plan.md §2).
  const puedeRegistrar = Boolean(user?.rol);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return animales
      .filter((a) => (loteFiltro === 'TODOS' ? true : a.lote === loteFiltro))
      .filter((a) => !q || a.numeroInterno.toLowerCase().includes(q) || a.chapetaICA.toLowerCase().includes(q))
      .sort((a, b) => a.numeroInterno.localeCompare(b.numeroInterno));
  }, [animales, busqueda, loteFiltro]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trazabilidad del hato</h1>
          <p className="text-sm text-gray-500">{animales.length} reses registradas, con su identificación, peso y sanidad.</p>
        </div>
        {puedeRegistrar && (
          <div className="flex flex-wrap gap-2">
            <Link
              to="/animales/importar"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-base font-semibold text-brand-800 ring-1 ring-inset ring-borde-control hover:bg-gray-50 md:min-h-10 md:text-sm"
            >
              <Upload size={18} aria-hidden="true" />
              Importar censo
            </Link>
            <Button icono={Plus} onClick={() => setShowForm(true)}>
              Registrar animal
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por número interno o chapeta" className="pl-10" />
        </label>
        <label className="md:w-72">
          <span className="sr-only">Lote</span>
          <Select value={loteFiltro} onChange={(e) => setLoteFiltro(e.target.value)}>
            <option value="TODOS">Todos los lotes</option>
            {lotes.map((l) => (
              <option key={l.codigo} value={l.codigo}>
                {l.nombre}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState titulo="No hay animales con ese filtro">Prueba con otro número, otra chapeta o todos los lotes.</EmptyState>
      ) : (
        <>
          {/* R10: tarjetas en celular */}
          <ul className="space-y-2 md:hidden">
            {filtrados.map((a) => (
              <li key={a.id}>
                <Link to={`/animales/${a.id}`} className="flex min-h-16 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3">
                  <Chapeta numero={a.numeroInterno} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-500">{a.loteNombre}</p>
                    <p className="text-sm">
                      <span className="cifra text-lg font-bold text-gray-900">{formatKg(pesoActual(a))}</span>
                      <span className="text-gray-500"> de {formatKg(a.pesoObjetivo)}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {pierdePeso(a) && (
                      <Badge tono="peligro" icono={TrendingDown}>
                        Pierde peso
                      </Badge>
                    )}
                    {a.esquema === 'Al partir' && <Badge tono="cuero">Al partir</Badge>}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>

          {/* R10: tabla en escritorio */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-gray-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">N° interno</th>
                  <th className="px-4 py-3 font-medium">Chapeta ICA</th>
                  <th className="px-4 py-3 font-medium">Lote</th>
                  <th className="px-4 py-3 font-medium">Esquema</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Peso actual</th>
                  <th className="px-4 py-3 text-right font-medium">Meta</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Último pesaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map((a) => (
                  <tr key={a.id} className="hover:bg-brand-50/60">
                    <td className="px-4 py-2">
                      <Link to={`/animales/${a.id}`} className="inline-block rounded-md hover:ring-2 hover:ring-brand-300">
                        <Chapeta numero={a.numeroInterno} />
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{a.chapetaICA}</td>
                    <td className="px-4 py-2 text-gray-700">{a.loteNombre}</td>
                    <td className="px-4 py-2">
                      {a.esquema === 'Al partir' ? (
                        <Badge tono="cuero">Al partir, {a.tenedor?.split(' – ')[0]}</Badge>
                      ) : (
                        <Badge>Propio</Badge>
                      )}
                    </td>
                    <td className="cifra whitespace-nowrap px-4 py-2 text-right text-base font-bold text-gray-900">
                      {pierdePeso(a) && <TrendingDown size={16} className="mr-1 inline text-peligro" aria-label="Pierde peso" />}
                      {formatKg(pesoActual(a))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-gray-500">{formatKg(a.pesoObjetivo)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{formatFecha(fechaUltimoPesaje(a))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showForm && <NuevoAnimalModal lotes={lotes} onClose={() => setShowForm(false)} />}
    </div>
  );
}

// D2: la categoría depende del sexo (la base de datos también lo exige).
const CATEGORIAS = {
  Macho: [
    { valor: 'novillo', label: 'Novillo' },
    { valor: 'ternero', label: 'Ternero' },
    { valor: 'reproductor', label: 'Reproductor' },
  ],
  Hembra: [
    { valor: 'ternera', label: 'Ternera' },
    { valor: 'vientre', label: 'Vientre (no se vende)' },
  ],
};

function NuevoAnimalModal({ lotes, onClose }) {
  const addAnimal = useAddAnimal();
  const contratos = useContratosVigentes();
  const [error, setError] = useState('');
  const [confirmarHembra, setConfirmarHembra] = useState(false);
  const [form, setForm] = useState({
    numeroInterno: '',
    chapetaICA: '',
    sexo: 'Macho',
    categoria: 'novillo',
    loteId: lotes[0]?.id ?? '',
    pesoIngreso: '',
    pesoObjetivo: '',
    costoCompra: '',
    esquema: 'Propio',
    contratoId: '',
  });

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setConfirmarHembra(false);
  }

  // R5 (spec 001): se valida aquí para dar un mensaje claro, y la base de datos vuelve a validar.
  function validar() {
    const ingreso = Number(form.pesoIngreso);
    const objetivo = Number(form.pesoObjetivo);
    if (!form.numeroInterno.trim() || !form.chapetaICA.trim()) return 'El número interno y la chapeta ICA son obligatorios.';
    if (!(ingreso > 0 && ingreso < 1500)) return 'El peso de ingreso debe estar entre 1 y 1.499 kg.';
    if (!(objetivo > 0 && objetivo < 1500)) return 'El peso objetivo debe estar entre 1 y 1.499 kg.';
    if (objetivo <= ingreso) return 'El peso objetivo debe ser mayor que el peso de ingreso.';
    if (form.costoCompra !== '' && !(Number(form.costoCompra) >= 0)) return 'El costo de compra no puede ser negativo.';
    if (!form.loteId) return 'Selecciona un lote.';
    if (form.esquema === 'Al partir' && !form.contratoId) return 'Selecciona el contrato "Al partir" del tenedor.';
    return null;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const problema = validar();
    if (problema) return setError(problema);
    // R8 / D2 (spec 006): una hembra reproductiva en un lote de ceba pide confirmación.
    const loteElegido = lotes.find((l) => l.id === form.loteId);
    if (vientresHaciaCeba([{ categoria: form.categoria }], loteElegido).length && !confirmarHembra) {
      setError('');
      return setConfirmarHembra(true);
    }
    setError('');
    const contrato = contratos.data?.find((c) => c.id === form.contratoId);
    addAnimal.mutate(
      {
        numeroInterno: form.numeroInterno,
        chapetaICA: form.chapetaICA,
        sexo: form.sexo,
        categoria: form.categoria,
        loteId: form.loteId,
        fechaIngreso: hoyISO(),
        pesoIngreso: Number(form.pesoIngreso),
        pesoObjetivo: Number(form.pesoObjetivo),
        costoCompra: form.costoCompra === '' ? null : Number(form.costoCompra),
        contratoId: form.esquema === 'Al partir' ? form.contratoId : null,
        fincaId: contrato?.fincaId ?? null,
      },
      { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) },
    );
  }

  return (
    <Modal
      titulo="Registrar nuevo animal"
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-nuevo-animal" disabled={addAnimal.isPending}>
            {addAnimal.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-nuevo-animal" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Número interno" required>
          <Input value={form.numeroInterno} onChange={(e) => set('numeroInterno', e.target.value)} />
        </Field>
        <Field label="Chapeta ICA / Sinigán" required>
          <Input value={form.chapetaICA} onChange={(e) => set('chapetaICA', e.target.value)} autoCapitalize="characters" />
        </Field>
        <Field label="Sexo">
          <Select
            value={form.sexo}
            onChange={(e) => setForm((f) => ({ ...f, sexo: e.target.value, categoria: CATEGORIAS[e.target.value][0].valor }))}
          >
            <option>Macho</option>
            <option>Hembra</option>
          </Select>
        </Field>
        <Field label="Categoría">
          <Select value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
            {CATEGORIAS[form.sexo].map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lote" className="sm:col-span-2">
          <Select value={form.loteId} onChange={(e) => set('loteId', e.target.value)}>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Peso de ingreso (kg)" required>
          <Input type="number" min="1" step="0.1" inputMode="decimal" value={form.pesoIngreso} onChange={(e) => set('pesoIngreso', e.target.value)} />
        </Field>
        <Field label="Peso objetivo pactado (kg)" required>
          <Input type="number" min="1" step="0.1" inputMode="decimal" value={form.pesoObjetivo} onChange={(e) => set('pesoObjetivo', e.target.value)} />
        </Field>
        <Field label="Costo de compra (COP)">
          <Input type="number" min="0" step="1" inputMode="numeric" value={form.costoCompra} onChange={(e) => set('costoCompra', e.target.value)} />
        </Field>
        <Field label="Esquema">
          <Select value={form.esquema} onChange={(e) => set('esquema', e.target.value)}>
            <option>Propio</option>
            <option>Al partir</option>
          </Select>
        </Field>
        {form.esquema === 'Al partir' && (
          <Field label='Contrato "Al partir"' required className="sm:col-span-2">
            <Select value={form.contratoId} onChange={(e) => set('contratoId', e.target.value)}>
              <option value="">{contratos.isPending ? 'Cargando contratos…' : 'Selecciona el tenedor'}</option>
              {contratos.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.etiqueta}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {confirmarHembra && (
          <p role="alert" className="rounded-lg bg-alerta-50 px-3 py-2 text-sm text-alerta-900 sm:col-span-2">
            Vas a registrar una hembra ({form.categoria}) en un lote de ceba, que es para vender. Las hembras con potencial reproductivo no se venden. Toca
            Guardar otra vez solo si es correcto.
          </p>
        )}
        <div className="sm:col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  );
}
