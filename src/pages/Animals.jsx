import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, ChevronRight, TrendingDown, Upload, Camera } from 'lucide-react';
import { useHato } from '../data/hato';
import { useLotes } from '../data/lotes';
import { useFotos } from '../data/fotos';
import { useAuth } from '../context/AuthContext';
import { ConDatos } from '../components/EstadoCarga';
import AnimalForm from '../components/AnimalForm';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Chapeta from '../components/ui/Chapeta';
import EmptyState from '../components/ui/EmptyState';
import { Input, Select } from '../components/ui/Field';
import { pesoActual, fechaUltimoPesaje } from '../domain/breakeven';
import { pierdePeso } from '../domain/gdp';
import { duenosExistentes, etiquetaCategoria } from '../domain/animales';
import { formatFecha, formatKg, cantidad } from '../utils/format';

export default function Animals() {
  const hato = useHato();
  const lotes = useLotes();
  return <ConDatos queries={[hato, lotes]}>{() => <HatoContenido {...hato.data} todosLotes={lotes.data} />}</ConDatos>;
}

// Spec 017 · R4: miniatura de la foto, o un recuadro con cámara si no hay.
function Miniatura({ url, alt }) {
  return url ? (
    <img src={url} alt={alt} className="size-14 shrink-0 rounded-lg object-cover" loading="lazy" />
  ) : (
    <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400" aria-hidden="true">
      <Camera size={20} />
    </span>
  );
}

function HatoContenido({ animales, caballos, lotes, todosLotes }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const vista = params.get('ver') === 'caballos' ? 'caballos' : 'ganado';
  const [busqueda, setBusqueda] = useState('');
  const [loteFiltro, setLoteFiltro] = useState('TODOS');
  const [showForm, setShowForm] = useState(params.get('nuevo') === '1');

  // Mientras solo Miguel use la app, todo miembro con perfil puede registrar (docs/plan.md §2).
  const puedeRegistrar = Boolean(user?.rol);
  const lista = vista === 'caballos' ? caballos : animales;
  const duenos = useMemo(() => duenosExistentes([...animales, ...caballos]), [animales, caballos]);
  const fotos = useFotos(lista.map((a) => a.fotoPath));

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lista
      .filter((a) => vista === 'caballos' || loteFiltro === 'TODOS' || a.lote === loteFiltro)
      .filter((a) => !q || a.numeroInterno.toLowerCase().includes(q) || a.chapetaICA.toLowerCase().includes(q) || (a.dueno ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.numeroInterno.localeCompare(b.numeroInterno, 'es', { numeric: true }));
  }, [lista, busqueda, loteFiltro, vista]);

  const cambiarVista = (v) => setParams(v === 'caballos' ? { ver: 'caballos' } : {}, { replace: true });
  const url = (a) => fotos.data?.get(a.fotoPath);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Animales</h1>
          <p className="text-base text-gray-600">
            {cantidad(animales.filter((a) => a.estado === 'Activo').length, 'res activa', 'reses activas')} y{' '}
            {cantidad(caballos.filter((a) => a.estado === 'Activo').length, 'caballo', 'caballos')}.
          </p>
        </div>
        {puedeRegistrar && (
          <Button icono={Plus} onClick={() => setShowForm(true)}>
            {vista === 'caballos' ? 'Registrar caballo' : 'Registrar animal'}
          </Button>
        )}
      </div>

      {/* Spec 016 · R8: el ganado y los caballos en pestañas aparte. */}
      <div role="tablist" aria-label="Tipo de animal" className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
        {[
          ['ganado', 'Ganado'],
          ['caballos', 'Caballos'],
        ].map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={vista === v}
            onClick={() => cambiarVista(v)}
            className={`min-h-12 rounded-lg text-base font-semibold ${vista === v ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por número, chapeta o dueño" className="pl-10" />
        </label>
        {vista === 'ganado' && (
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
        )}
      </div>

      {filtrados.length === 0 ? (
        lista.length === 0 ? (
          <EmptyState titulo={vista === 'caballos' ? 'Todavía no hay caballos' : 'Todavía no hay animales'}>
            Toca "{vista === 'caballos' ? 'Registrar caballo' : 'Registrar animal'}" para agregar el primero.
          </EmptyState>
        ) : (
          <EmptyState titulo="No hay animales con ese filtro">Prueba con otro número, otra chapeta o todos los lotes.</EmptyState>
        )
      ) : vista === 'caballos' ? (
        <ul className="space-y-2">
          {filtrados.map((a) => (
            <li key={a.id}>
              <Link to={`/animales/${a.id}`} className="flex min-h-20 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 hover:border-brand-300">
                <Miniatura url={url(a)} alt={`Foto de ${a.numeroInterno}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold text-gray-900">{a.numeroInterno}</p>
                  <p className="truncate text-base text-gray-600">
                    {etiquetaCategoria(a.categoria)}
                    {a.color ? `, ${a.color}` : ''}
                    {a.dueno ? ` · ${a.dueno}` : ''}
                  </p>
                </div>
                {a.estado !== 'Activo' && <Badge>{a.estado}</Badge>}
                <ChevronRight size={20} className="shrink-0 text-gray-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <>
          {/* R10: tarjetas en celular */}
          <ul className="space-y-2 md:hidden">
            {filtrados.map((a) => (
              <li key={a.id}>
                <Link to={`/animales/${a.id}`} className="flex min-h-20 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3">
                  {a.fotoPath ? <Miniatura url={url(a)} alt={`Foto de ${a.numeroInterno}`} /> : <Chapeta numero={a.numeroInterno} />}
                  <div className="min-w-0 flex-1">
                    {a.fotoPath && <p className="text-base font-bold text-gray-900">{a.numeroInterno}</p>}
                    <p className="truncate text-sm text-gray-600">
                      {etiquetaCategoria(a.categoria)} · {a.loteNombre}
                    </p>
                    <p className="text-base">
                      <span className="cifra text-lg font-bold text-gray-900">{formatKg(pesoActual(a))}</span>
                      {a.pesoObjetivo && <span className="text-gray-600"> de {formatKg(a.pesoObjetivo)}</span>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {pierdePeso(a) && (
                      <Badge tono="peligro" icono={TrendingDown}>
                        Pierde peso
                      </Badge>
                    )}
                    {a.esquema === 'Al partir' && <Badge tono="cuero">Al partir</Badge>}
                    {a.estado !== 'Activo' && <Badge>{a.estado}</Badge>}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>

          {/* R10: tabla en escritorio */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-gray-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">N° interno</th>
                  <th className="px-4 py-3 font-medium">Chapeta ICA</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Lote</th>
                  <th className="px-4 py-3 font-medium">Dueño</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Peso actual</th>
                  <th className="px-4 py-3 text-right font-medium">Meta</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Último pesaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map((a) => (
                  <tr key={a.id} className="hover:bg-brand-50/60">
                    <td className="px-4 py-2">
                      <Link to={`/animales/${a.id}`} className="inline-flex items-center gap-2 rounded-md hover:ring-2 hover:ring-brand-300">
                        {a.fotoPath && <img src={url(a)} alt="" className="size-9 rounded object-cover" loading="lazy" />}
                        <Chapeta numero={a.numeroInterno} />
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{a.chapetaICA}</td>
                    <td className="px-4 py-2 text-gray-700">{etiquetaCategoria(a.categoria)}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {a.loteNombre}
                      {a.esquema === 'Al partir' && (
                        <Badge tono="cuero" className="ml-1">
                          Al partir, {a.tenedor?.split(' – ')[0]}
                        </Badge>
                      )}
                      {a.estado !== 'Activo' && <Badge className="ml-1">{a.estado}</Badge>}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{a.dueno ?? '—'}</td>
                    <td className="cifra whitespace-nowrap px-4 py-2 text-right text-base font-bold text-gray-900">
                      {pierdePeso(a) && <TrendingDown size={16} className="mr-1 inline text-peligro" aria-label="Pierde peso" />}
                      {formatKg(pesoActual(a))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-gray-600">{a.pesoObjetivo ? formatKg(a.pesoObjetivo) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{formatFecha(fechaUltimoPesaje(a))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {puedeRegistrar && vista === 'ganado' && (
        <Link to="/animales/importar" className="inline-flex min-h-12 items-center gap-2 text-base font-medium text-brand-700 hover:underline">
          <Upload size={18} aria-hidden="true" />
          ¿Muchos animales? Impórtalos desde Excel
        </Link>
      )}

      {showForm && (
        <AnimalForm
          especie={vista === 'caballos' ? 'equino' : 'bovino'}
          lotes={todosLotes}
          duenos={duenos}
          onClose={() => {
            setShowForm(false);
            if (params.get('nuevo')) setParams(vista === 'caballos' ? { ver: 'caballos' } : {}, { replace: true });
          }}
        />
      )}
    </div>
  );
}
