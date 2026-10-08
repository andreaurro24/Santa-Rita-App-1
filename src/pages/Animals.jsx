import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, ChevronRight, ChevronLeft, TrendingDown, Upload, Camera, CirclePlus, Pencil, ArrowUp, ArrowDown, ArrowUpDown, Layers } from 'lucide-react';
import { useHato } from '../data/hato';
import { useLotes, useGuardarLote } from '../data/lotes';
import { useFotos } from '../data/fotos';
import { useAuth } from '../context/AuthContext';
import { ConDatos } from '../components/EstadoCarga';
import AnimalForm from '../components/AnimalForm';
import LoteForm from '../components/LoteForm';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { Input, Select, FormError } from '../components/ui/Field';
import { pesoActual } from '../domain/breakeven';
import { formatCOP } from '../domain/breakeven';
import { pierdePeso } from '../domain/gdp';
import { duenosExistentes, etiquetaCategoria, kiloDesdeTotal } from '../domain/animales';
import { ESTADO_LOTE, resumenLote, tenedoresDelLote } from '../domain/lotes';
import { FILTROS_ESTADO, coincide, ordenarAnimales, paginar, pasaEstado } from '../domain/tabla';
import { formatKg, cantidad, hoyISO } from '../utils/format';
import { mensajeError } from '../lib/errores';

export default function Animals() {
  const hato = useHato();
  const lotes = useLotes();
  return <ConDatos queries={[hato, lotes]}>{() => <HatoContenido animales={hato.data.animales} caballos={hato.data.caballos} todosLotes={lotes.data} />}</ConDatos>;
}

// Spec 022 · R3/R4: miniatura cuadrada (spec 024: solo se descarga la de 200 px), o un recuadro
// con cámara si no hay foto.
function Miniatura({ url, alt, tamano = 'size-12' }) {
  return url ? (
    <img src={url} alt={alt} className={`${tamano} shrink-0 rounded-full object-cover ring-2 ring-white`} loading="lazy" />
  ) : (
    <span className={`flex ${tamano} shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400`} aria-hidden="true">
      <Camera size={18} />
    </span>
  );
}

// Estado con un punto de color: activo verde, de baja rojo, vendido gris.
const TONO_ESTADO = { Activo: 'bg-ok', Vendido: 'bg-gray-400', Muerto: 'bg-peligro', Perdido: 'bg-peligro' };
function EstadoPunto({ estado }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
      <span className={`size-2 rounded-full ${TONO_ESTADO[estado] ?? 'bg-gray-400'}`} aria-hidden="true" />
      {estado}
    </span>
  );
}

const precioKgCompra = (a) => a.precioCompraKg ?? kiloDesdeTotal(a.costoCompra, a.pesoIngreso);

function HatoContenido({ animales, caballos, todosLotes }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const vista = params.get('ver') === 'caballos' ? 'caballos' : 'ganado';
  const loteFiltro = params.get('lote') ?? 'TODOS';
  const estadoFiltro = params.get('estado') ?? 'activos';
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ campo: 'animal', dir: 'asc' });
  const [pagina, setPagina] = useState(1);
  const [modal, setModal] = useState(params.get('nuevo') === '1' ? 'animal' : null);

  // Mientras solo Miguel use la app, todo miembro con perfil puede registrar (docs/plan.md §2).
  const puedeRegistrar = Boolean(user?.rol);
  const lista = vista === 'caballos' ? caballos : animales;
  const duenos = useMemo(() => duenosExistentes([...animales, ...caballos]), [animales, caballos]);

  // R1: lotes con sus animales y su resumen (cabezas activas y peso promedio).
  const hoy = hoyISO();
  const lotesConResumen = useMemo(
    () =>
      todosLotes
        .map((l) => {
          const suyos = animales.filter((a) => a.loteId === l.id);
          return { ...l, animales: suyos, resumen: resumenLote({ ...l, animales: suyos }, hoy), tenedores: tenedoresDelLote(suyos) };
        })
        .filter((l) => l.estado === 'activo' || l.estado === 'listo' || l.resumen.nActivos > 0 || l.id === loteFiltro),
    [todosLotes, animales, hoy, loteFiltro],
  );

  const filtrados = useMemo(() => {
    const f = lista.filter((a) => pasaEstado(a, estadoFiltro) && coincide(a, busqueda) && (vista === 'caballos' || loteFiltro === 'TODOS' || a.loteId === loteFiltro));
    return ordenarAnimales(f, orden.campo, orden.dir);
  }, [lista, estadoFiltro, busqueda, vista, loteFiltro, orden]);
  const pag = paginar(filtrados, pagina);
  const fotos = useFotos(
    pag.items.map((a) => a.fotoPath),
    { mini: true },
  );
  const url = (a) => fotos.data?.get(a.fotoPath);

  function cambiarParam(clave, valor, porDefecto) {
    const p = new URLSearchParams(params);
    if (valor === porDefecto) p.delete(clave);
    else p.set(clave, valor);
    p.delete('nuevo');
    setParams(p, { replace: true });
    setPagina(1);
  }
  const cambiarVista = (v) => setParams(v === 'caballos' ? { ver: 'caballos' } : {}, { replace: true });
  function ordenarPor(campo) {
    setOrden((o) => ({ campo, dir: o.campo === campo && o.dir === 'asc' ? 'desc' : 'asc' }));
  }
  function cerrarModal() {
    setModal(null);
    if (params.get('nuevo')) cambiarParam('nuevo', null, null);
  }

  const activosGanado = animales.filter((a) => a.estado === 'Activo').length;
  const activosCaballos = caballos.filter((a) => a.estado === 'Activo').length;

  return (
    <div className="space-y-5">
      {/* R2: título y botones a la mano (abajo del título en el celular). */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Animales</h1>
          <p className="text-base text-gray-600">
            {cantidad(activosGanado, 'res activa', 'reses activas')}, {cantidad(lotesConResumen.length, 'lote', 'lotes')} y {cantidad(activosCaballos, 'caballo', 'caballos')}.
          </p>
        </div>
        {puedeRegistrar && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {vista === 'ganado' && (
              <>
                <Button variante="fantasma" icono={Pencil} onClick={() => setModal('editar-lotes')} className="flex-1 whitespace-nowrap max-sm:px-3 sm:flex-none">
                  Editar lotes
                </Button>
                <Button variante="secundario" icono={CirclePlus} onClick={() => setModal('lote')} className="flex-1 whitespace-nowrap max-sm:px-3 sm:flex-none">
                  Crear lote
                </Button>
              </>
            )}
            <Button icono={Plus} onClick={() => setModal('animal')} className="w-full sm:w-auto">
              {vista === 'caballos' ? 'Registrar caballo' : 'Añadir animal'}
            </Button>
          </div>
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
            className={`min-h-14 rounded-lg text-base font-semibold ${vista === v ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === 'ganado' && <TarjetasLote lotes={lotesConResumen} seleccionado={loteFiltro} onElegir={(id) => cambiarParam('lote', id, 'TODOS')} onCrear={puedeRegistrar ? () => setModal('lote') : null} />}

      {/* R5: buscador y filtros, como en la referencia. */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 md:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
          <Input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por nombre, chapeta, dueño o raza"
            className="pl-10"
          />
        </label>
        <div className="grid grid-cols-2 gap-3 md:flex">
          <label className="md:w-44">
            <span className="sr-only">Estado</span>
            <Select value={estadoFiltro} onChange={(e) => cambiarParam('estado', e.target.value, 'activos')}>
              {FILTROS_ESTADO.map(([v, label]) => (
                <option key={v} value={v}>
                  Estado: {label}
                </option>
              ))}
            </Select>
          </label>
          {vista === 'ganado' && (
            <label className="md:w-56">
              <span className="sr-only">Lote</span>
              <Select value={loteFiltro} onChange={(e) => cambiarParam('lote', e.target.value, 'TODOS')}>
                <option value="TODOS">Lote: todos</option>
                {lotesConResumen.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </div>
      </div>

      {filtrados.length === 0 ? (
        lista.length === 0 ? (
          <EmptyState titulo={vista === 'caballos' ? 'Todavía no hay caballos' : 'Todavía no hay animales'}>
            {vista === 'caballos'
              ? 'Toca "Registrar caballo" para agregar el primero.'
              : lotesConResumen.length
                ? 'Toca "Añadir animal" para agregar el primero.'
                : 'Primero toca "Crear lote" y luego "Añadir animal".'}
          </EmptyState>
        ) : (
          <EmptyState titulo="No hay animales con ese filtro">Prueba con otra búsqueda, otro estado o todos los lotes.</EmptyState>
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {vista === 'caballos' ? (
            <TablaCaballos items={pag.items} url={url} orden={orden} onOrdenar={ordenarPor} />
          ) : (
            <TablaGanado items={pag.items} url={url} orden={orden} onOrdenar={ordenarPor} />
          )}
          <TarjetasAnimal items={pag.items} url={url} caballos={vista === 'caballos'} />
          <Paginacion pag={pag} total={filtrados.length} onPagina={setPagina} />
        </div>
      )}

      {puedeRegistrar && vista === 'ganado' && (
        <Link to="/animales/importar" className="inline-flex min-h-12 items-center gap-2 text-base font-medium text-brand-700 hover:underline">
          <Upload size={18} aria-hidden="true" />
          ¿Muchos animales? Impórtalos desde Excel
        </Link>
      )}

      {modal === 'animal' && <AnimalForm especie={vista === 'caballos' ? 'equino' : 'bovino'} lotes={todosLotes} duenos={duenos} onClose={cerrarModal} />}
      {modal === 'lote' && (
        <LoteForm
          onClose={cerrarModal}
          alCrear={(id) => {
            cerrarModal();
            cambiarParam('lote', id, 'TODOS');
          }}
        />
      )}
      {modal === 'editar-lotes' && <EditarLotes lotes={lotesConResumen} onClose={cerrarModal} />}
    </div>
  );
}

// R1: tarjetas de lote arriba; en el celular se deslizan de lado. Tocar una filtra la tabla.
function TarjetasLote({ lotes, seleccionado, onElegir, onCrear }) {
  const base = 'flex min-h-24 w-44 shrink-0 snap-start flex-col justify-between rounded-xl border-2 bg-white p-3 text-left transition-colors sm:w-52';
  const tono = (activo) => (activo ? 'border-brand-700 bg-brand-50' : 'border-gray-200 hover:border-brand-300');
  const totalCabezas = lotes.reduce((s, l) => s + l.resumen.nActivos, 0);
  return (
    <section aria-label="Lotes">
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        <button type="button" aria-pressed={seleccionado === 'TODOS'} onClick={() => onElegir('TODOS')} className={`${base} ${tono(seleccionado === 'TODOS')}`}>
          <span className="flex items-center gap-2 text-base font-bold text-gray-900">
            <Layers size={18} aria-hidden="true" /> Todos
          </span>
          <span className="text-sm text-gray-600">{cantidad(totalCabezas, 'cabeza', 'cabezas')}</span>
        </button>
        {lotes.map((l) => (
          <button key={l.id} type="button" aria-pressed={seleccionado === l.id} onClick={() => onElegir(l.id)} className={`${base} ${tono(seleccionado === l.id)}`}>
            <span className="line-clamp-2 text-base font-bold text-gray-900">{l.nombre}</span>
            <span className="text-sm text-gray-600">
              {cantidad(l.resumen.nActivos, 'cabeza', 'cabezas')}
              {l.resumen.pesoPromedio != null && (
                <span className="block">
                  <span className="cifra font-semibold text-gray-800">{formatKg(Math.round(l.resumen.pesoPromedio))}</span> en promedio
                </span>
              )}
            </span>
            <span className="flex flex-wrap gap-1">
              {l.estado === 'listo' && <Badge tono="ok">Listo</Badge>}
              {l.tenedores.length > 0 && <Badge tono="cuero">Al partir</Badge>}
            </span>
          </button>
        ))}
        {onCrear && (
          <button type="button" onClick={onCrear} className={`${base} items-center justify-center border-dashed border-gray-300 text-base font-semibold text-brand-700 hover:border-brand-400`}>
            <CirclePlus size={22} aria-hidden="true" />
            Crear lote
          </button>
        )}
      </div>
    </section>
  );
}

function Encabezado({ campo, orden, onOrdenar, children, derecha = false }) {
  if (!campo) return <th className={`px-4 py-3 ${derecha ? 'text-right' : 'text-left'}`}>{children}</th>;
  const activo = orden.campo === campo;
  const Icono = activo ? (orden.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th aria-sort={activo ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`px-2 py-1 ${derecha ? 'text-right' : 'text-left'}`}>
      <button type="button" onClick={() => onOrdenar(campo)} className={`inline-flex min-h-11 items-center gap-1 rounded-md px-2 uppercase tracking-wide hover:text-gray-900 ${activo ? 'text-gray-900' : ''}`}>
        {children}
        <Icono size={14} aria-hidden="true" className={activo ? '' : 'opacity-50'} />
      </button>
    </th>
  );
}

const CABECERA = 'border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600';

function CeldaAnimal({ a, url, ocultas = false }) {
  return (
    <td className="px-4 py-2">
      <Link to={`/animales/${a.id}`} className="flex items-center gap-3 rounded-md">
        <Miniatura url={url(a)} alt={`Foto de ${a.numeroInterno}`} />
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold text-brand-800 hover:underline">{a.numeroInterno}</span>
          <EstadoPunto estado={a.estado} />
          {/* 022 · R3: en pantallas medianas, chapeta, raza y dueño van aquí en vez de en su columna. */}
          {ocultas && (a.chapetaICA || a.raza || a.dueno) && (
            <span className={`block truncate text-sm text-gray-600 2xl:hidden ${a.raza || a.dueno ? '' : 'xl:hidden'}`}>
              {[a.chapetaICA, a.raza, a.dueno].filter(Boolean).map((t, i) => (
                // La chapeta tiene su columna desde 1280 px: ahí se esconde aquí.
                <span key={i} className={i === 0 && t === a.chapetaICA ? 'xl:hidden' : ''}>
                  {i > 0 && ' · '}
                  {t}
                </span>
              ))}
            </span>
          )}
        </span>
      </Link>
    </td>
  );
}

// R3: tabla del ganado en escritorio.
function TablaGanado({ items, url, orden, onOrdenar }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-sm">
        <thead className={CABECERA}>
          <tr>
            <Encabezado campo="animal" orden={orden} onOrdenar={onOrdenar}>
              Animal
            </Encabezado>
            <th className="hidden px-4 py-3 text-left xl:table-cell">Chapeta ICA</th>
            <Encabezado>Lote</Encabezado>
            <th className="hidden px-4 py-3 text-left 2xl:table-cell">Raza</th>
            <Encabezado campo="pesoActual" orden={orden} onOrdenar={onOrdenar} derecha>
              Peso actual
            </Encabezado>
            <Encabezado campo="pesoInicial" orden={orden} onOrdenar={onOrdenar} derecha>
              Peso inicial
            </Encabezado>
            <Encabezado campo="precioKg" orden={orden} onOrdenar={onOrdenar} derecha>
              Precio x kg
            </Encabezado>
            <th className="hidden px-4 py-3 text-left 2xl:table-cell">Dueño</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((a) => (
            <tr key={a.id} className="h-16 hover:bg-brand-50/60">
              <CeldaAnimal a={a} url={url} ocultas />
              <td className="hidden whitespace-nowrap px-4 py-2 text-gray-700 xl:table-cell">{a.chapetaICA || '—'}</td>
              <td className="px-4 py-2">
                <span className="inline-flex flex-wrap items-center gap-1">
                  <Badge tono="potrero" className="whitespace-nowrap">{a.loteNombre ?? 'Sin lote'}</Badge>
                  {a.esquema === 'Al partir' && <Badge tono="cuero">Al partir</Badge>}
                </span>
              </td>
              <td className="hidden px-4 py-2 text-gray-700 2xl:table-cell">{a.raza ?? '—'}</td>
              <td className="cifra whitespace-nowrap px-4 py-2 text-right text-base font-bold text-gray-900">
                {pierdePeso(a) && <TrendingDown size={16} className="mr-1 inline text-peligro" aria-label="Pierde peso" />}
                {formatKg(pesoActual(a))}
              </td>
              <td className="cifra whitespace-nowrap px-4 py-2 text-right text-gray-700">{formatKg(a.pesoIngreso)}</td>
              <td className="cifra whitespace-nowrap px-4 py-2 text-right font-semibold text-gray-900">{precioKgCompra(a) ? `$${formatCOP(precioKgCompra(a))}` : '—'}</td>
              <td className="hidden px-4 py-2 text-gray-700 2xl:table-cell">{a.dueno ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// R8: caballos con la misma tabla, sin lote ni pesos.
function TablaCaballos({ items, url, orden, onOrdenar }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-sm">
        <thead className={CABECERA}>
          <tr>
            <Encabezado campo="animal" orden={orden} onOrdenar={onOrdenar}>
              Animal
            </Encabezado>
            <Encabezado>Categoría</Encabezado>
            <Encabezado>Raza</Encabezado>
            <Encabezado>Color</Encabezado>
            <Encabezado>Dueño</Encabezado>
            <Encabezado derecha>Precio de compra</Encabezado>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((a) => (
            <tr key={a.id} className="h-16 hover:bg-brand-50/60">
              <CeldaAnimal a={a} url={url} />
              <td className="px-4 py-2 text-gray-700">{etiquetaCategoria(a.categoria)}</td>
              <td className="px-4 py-2 text-gray-700">{a.raza ?? '—'}</td>
              <td className="px-4 py-2 text-gray-700">{a.color ?? '—'}</td>
              <td className="px-4 py-2 text-gray-700">{a.dueno ?? '—'}</td>
              <td className="cifra whitespace-nowrap px-4 py-2 text-right text-gray-900">{a.costoCompra ? `$${formatCOP(a.costoCompra)}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// R4: tarjetas en el celular.
function TarjetasAnimal({ items, url, caballos }) {
  return (
    <ul className="divide-y divide-gray-100 md:hidden">
      {items.map((a) => (
        <li key={a.id}>
          <Link to={`/animales/${a.id}`} className="flex min-h-20 items-center gap-3 px-3 py-3">
            <Miniatura url={url(a)} alt={`Foto de ${a.numeroInterno}`} tamano="size-14" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold text-gray-900">{a.numeroInterno}</p>
              <p className="truncate text-sm text-gray-600">
                {etiquetaCategoria(a.categoria)}
                {caballos ? (a.color ? `, ${a.color}` : '') : ` · ${a.loteNombre ?? 'Sin lote'}`}
                {a.raza ? ` · ${a.raza}` : ''}
              </p>
              {!caballos && (
                <p className="text-base">
                  <span className="cifra text-lg font-bold text-gray-900">{formatKg(pesoActual(a))}</span>
                  <span className="text-gray-600"> · inicial {formatKg(a.pesoIngreso)}</span>
                </p>
              )}
              {/* Las insignias van debajo (no en una columna a la derecha) para no cortar el nombre a 375 px. */}
              {(pierdePeso(a) || a.esquema === 'Al partir' || a.estado !== 'Activo') && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {pierdePeso(a) && (
                    <Badge tono="peligro" icono={TrendingDown}>
                      Pierde peso
                    </Badge>
                  )}
                  {a.esquema === 'Al partir' && <Badge tono="cuero">Al partir</Badge>}
                  {a.estado !== 'Activo' && <Badge>{a.estado}</Badge>}
                </div>
              )}
            </div>
            <ChevronRight size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// R3: conteo abajo y páginas de 20.
function Paginacion({ pag, total, onPagina }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
      <span>
        {pag.rango.replace(/ de \d+$/, '')} de {cantidad(total, 'animal', 'animales')}
      </span>
      {pag.paginas > 1 && (
        <div className="flex items-center gap-2">
          <Button variante="secundario" tamano="sm" icono={ChevronLeft} aria-label="Página anterior" disabled={pag.pagina === 1} onClick={() => onPagina(pag.pagina - 1)} />
          <span className="min-w-12 text-center font-semibold text-gray-900">
            {pag.pagina} / {pag.paginas}
          </span>
          <Button variante="secundario" tamano="sm" icono={ChevronRight} aria-label="Página siguiente" disabled={pag.pagina === pag.paginas} onClick={() => onPagina(pag.pagina + 1)} />
        </div>
      )}
    </div>
  );
}

// R2: "Editar lotes": editar, ver el detalle (costos, mover animales) y cerrar los vacíos.
function EditarLotes({ lotes, onClose }) {
  const [editando, setEditando] = useState(null);
  const guardar = useGuardarLote();
  const [error, setError] = useState('');
  if (editando) return <LoteForm lote={editando} onClose={() => setEditando(null)} />;
  return (
    <Modal titulo="Editar lotes" onClose={onClose}>
      {lotes.length === 0 ? (
        <p className="text-base text-gray-700">Todavía no hay lotes. Toca "Crear lote".</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {lotes.map((l) => (
            <li key={l.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto text-base font-bold text-gray-900">{l.nombre}</span>
                <Badge tono={ESTADO_LOTE[l.estado].tono}>{ESTADO_LOTE[l.estado].label}</Badge>
              </div>
              <p className="text-sm text-gray-600">
                {cantidad(l.resumen.nActivos, 'cabeza activa', 'cabezas activas')}
                {l.descripcion ? ` · ${l.descripcion}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variante="secundario" tamano="sm" icono={Pencil} onClick={() => setEditando(l)}>
                  Editar
                </Button>
                <Link
                  to={`/lotes/${l.id}`}
                  className="inline-flex min-h-[3.2rem] items-center rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 md:min-h-9"
                >
                  Ver detalle y costos
                </Link>
                {l.resumen.nActivos === 0 && (l.estado === 'activo' || l.estado === 'listo') && (
                  <Button
                    variante="fantasma"
                    tamano="sm"
                    disabled={guardar.isPending}
                    onClick={() => guardar.mutate({ ...l, estado: 'cerrado' }, { onError: (err) => setError(mensajeError(err)) })}
                  >
                    Cerrar lote vacío
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormError>{error}</FormError>
    </Modal>
  );
}
