import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, X } from 'lucide-react';
import { useHato, useAddAnimal, useContratosVigentes } from '../data/hato';
import { useAuth } from '../context/AuthContext';
import { ConDatos } from '../components/EstadoCarga';
import { pesoActual, fechaUltimoPesaje } from '../domain/breakeven';
import { formatFecha, hoyISO } from '../utils/format';
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
    return animales
      .filter((a) => (loteFiltro === 'TODOS' ? true : a.lote === loteFiltro))
      .filter((a) => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return true;
        return (
          a.numeroInterno.toLowerCase().includes(q) ||
          a.chapetaICA.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.numeroInterno.localeCompare(b.numeroInterno));
  }, [animales, busqueda, loteFiltro]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Trazabilidad del hato</h1>
          <p className="text-sm text-gray-500">Identificación, peso y sanidad individual — {animales.length} reses registradas.</p>
        </div>
        {puedeRegistrar && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            <Plus size={16} /> Registrar animal
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por número interno o chapeta ICA…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select
          value={loteFiltro}
          onChange={(e) => setLoteFiltro(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          <option value="TODOS">Todos los lotes</option>
          {lotes.map((l) => (
            <option key={l.codigo} value={l.codigo}>
              {l.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-4 py-3">N° interno</th>
              <th className="px-4 py-3">Chapeta ICA</th>
              <th className="px-4 py-3">Lote</th>
              <th className="px-4 py-3">Esquema</th>
              <th className="px-4 py-3 text-right">Peso actual</th>
              <th className="px-4 py-3 text-right">Meta</th>
              <th className="px-4 py-3">Última actualización</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.map((a) => (
              <tr key={a.id} className="hover:bg-brand-50/50">
                <td className="px-4 py-2.5">
                  <Link to={`/animales/${a.id}`} className="font-medium text-brand-700 hover:underline">
                    {a.numeroInterno}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-gray-500">{a.chapetaICA}</td>
                <td className="px-4 py-2.5 text-gray-600">{a.loteNombre}</td>
                <td className="px-4 py-2.5">
                  {a.esquema === 'Al partir' ? (
                    <span className="inline-flex items-center rounded-full bg-earth-100 px-2 py-0.5 text-xs font-medium text-earth-700">
                      Al partir · {a.tenedor?.split(' – ')[0]}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      Propio
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-800">{pesoActual(a)} kg</td>
                <td className="px-4 py-2.5 text-right text-gray-400">{a.pesoObjetivo} kg</td>
                <td className="px-4 py-2.5 text-gray-500">{formatFecha(fechaUltimoPesaje(a))}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No se encontraron animales con ese filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && <NuevoAnimalModal lotes={lotes} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function NuevoAnimalModal({ lotes, onClose }) {
  const addAnimal = useAddAnimal();
  const contratos = useContratosVigentes();
  const [error, setError] = useState('');
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
  }

  // R5: se valida aquí para dar un mensaje claro, y la base de datos vuelve a validar.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="nuevo-animal-titulo" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 id="nuevo-animal-titulo" className="text-lg font-semibold text-gray-900">Registrar nuevo animal</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="grid grid-cols-2 gap-3">
          <Field label="Número interno" required>
            <input value={form.numeroInterno} onChange={(e) => set('numeroInterno', e.target.value)} className="input" />
          </Field>
          <Field label="Chapeta ICA / Sinigán" required>
            <input value={form.chapetaICA} onChange={(e) => set('chapetaICA', e.target.value)} className="input" />
          </Field>
          <Field label="Sexo">
            <select value={form.sexo} onChange={(e) => set('sexo', e.target.value)} className="input">
              <option>Macho</option>
              <option>Hembra</option>
            </select>
          </Field>
          <Field label="Categoría">
            <select value={form.categoria} onChange={(e) => set('categoria', e.target.value)} className="input">
              <option value="novillo">Novillo</option>
              <option value="ternero">Ternero</option>
              <option value="ternera">Ternera</option>
              <option value="vientre">Vientre (no se vende)</option>
              <option value="reproductor">Reproductor</option>
            </select>
          </Field>
          <Field label="Lote">
            <select value={form.loteId} onChange={(e) => set('loteId', e.target.value)} className="input">
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Peso de ingreso (kg)" required>
            <input type="number" min="1" step="0.1" value={form.pesoIngreso} onChange={(e) => set('pesoIngreso', e.target.value)} className="input" />
          </Field>
          <Field label="Peso objetivo pactado (kg)" required>
            <input type="number" min="1" step="0.1" value={form.pesoObjetivo} onChange={(e) => set('pesoObjetivo', e.target.value)} className="input" />
          </Field>
          <Field label="Costo de compra (COP)">
            <input type="number" min="0" step="1" value={form.costoCompra} onChange={(e) => set('costoCompra', e.target.value)} className="input" />
          </Field>
          <Field label="Esquema">
            <select value={form.esquema} onChange={(e) => set('esquema', e.target.value)} className="input">
              <option>Propio</option>
              <option>Al partir</option>
            </select>
          </Field>
          {form.esquema === 'Al partir' && (
            <label className="col-span-2 block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Contrato "Al partir" <span className="text-red-500">*</span>
              </span>
              <select value={form.contratoId} onChange={(e) => set('contratoId', e.target.value)} className="input">
                <option value="">{contratos.isPending ? 'Cargando contratos…' : 'Selecciona el tenedor'}</option>
                {contratos.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && (
            <p role="alert" className="col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={addAnimal.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {addAnimal.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="col-span-1 block text-sm">
      <span className="mb-1 block font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
