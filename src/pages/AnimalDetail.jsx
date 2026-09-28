import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, Syringe, Scale, Tag, TrendingDown, MapPin, MoveRight, Receipt, Printer } from 'lucide-react';
import { useHato, useAddPeso, useAddSanidad } from '../data/hato';
import { useMovimientos } from '../data/fincas';
import { useVisitasAnimal } from '../data/alPartir';
import { useRepartoCostos } from '../data/costos';
import { CATEGORIAS_COSTO, costoAcumuladoAnimal } from '../domain/costos';
import MoverAnimales from '../components/MoverAnimales';
import { ConDatos } from '../components/EstadoCarga';
import { mensajeError } from '../lib/errores';
import { useAuth } from '../context/AuthContext';
import WeightChart from '../components/WeightChart';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Chapeta from '../components/ui/Chapeta';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { Field, Input, Select, FormError } from '../components/ui/Field';
import { pesoActual, fechaUltimoPesaje, formatCOP } from '../domain/breakeven';
import { gdpReciente, gdpTotal, pierdePeso, variacionSospechosa } from '../domain/gdp';
import Stat from '../components/ui/Stat';
import { formatFecha, diasHasta, hoyISO, formatoGdp } from '../utils/format';

export default function AnimalDetail() {
  const hato = useHato();
  const costos = useRepartoCostos();
  return <ConDatos queries={[hato, ...costos.queries]}>{() => <FichaAnimal animales={hato.data.animales} reparto={costos.reparto} />}</ConDatos>;
}

function FichaAnimal({ animales, reparto }) {
  const { id } = useParams();
  const { user } = useAuth();
  const animal = animales.find((a) => a.id === id);
  const [showPesoForm, setShowPesoForm] = useState(false);
  const [showSanidadForm, setShowSanidadForm] = useState(false);
  const [moviendo, setMoviendo] = useState(false);

  if (!animal) return <Navigate to="/animales" replace />;

  // Mientras solo Miguel use la app, todo miembro con perfil puede registrar (docs/plan.md §2).
  const puedeRegistrar = Boolean(user?.rol);
  const peso = pesoActual(animal);
  const avance = Math.round((peso / animal.pesoObjetivo) * 100);

  const sanidadOrdenada = [...(animal.sanidad ?? [])].sort((a, b) =>
    (b.fecha ?? b.proximaFecha ?? '').localeCompare(a.fecha ?? a.proximaFecha ?? ''),
  );

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link to="/animales" className="inline-flex min-h-12 items-center gap-1 text-sm text-gray-600 hover:text-brand-700 md:min-h-0">
          <ArrowLeft size={16} aria-hidden="true" /> Volver al hato
        </Link>
        {/* Spec 012 · R4: ficha imprimible (la navegación y las acciones no se imprimen). */}
        <Button variante="secundario" tamano="sm" icono={Printer} onClick={() => window.print()}>
          Imprimir ficha
        </Button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-gray-900">
            <span className="sr-only">Animal N° </span>
            <Chapeta numero={animal.numeroInterno} tamano="lg" />
          </h1>
          <p className="text-sm text-gray-600">
            {animal.loteNombre}
            {animal.esquema === 'Al partir' && (
              <Badge tono="cuero" className="ml-2">
                Al partir
              </Badge>
            )}
            {pierdePeso(animal) && (
              <Badge tono="peligro" icono={TrendingDown} className="ml-2">
                Pierde peso
              </Badge>
            )}
          </p>
        </div>
        <div className="md:text-right">
          <p className="cifra text-4xl font-bold text-brand-800">{peso} kg</p>
          <p className="text-sm text-gray-600">
            Meta {animal.pesoObjetivo} kg, {avance} % de avance
          </p>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, avance)}%` }} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card titulo="Identificación" icono={Tag}>
          <dl className="space-y-2 text-sm">
            <Row label="Marca de finca" value={animal.marcaFinca} />
            <Row label="Chapeta ICA / Sinigán" value={animal.chapetaICA} />
            <Row label="Sexo" value={animal.sexo} />
            <Row label="Origen" value={animal.origen} />
            <Row label="Fecha de ingreso" value={formatFecha(animal.fechaIngreso)} />
            <Row label="Peso de ingreso" value={`${animal.pesoIngreso} kg`} />
            {animal.costoCompra != null && <Row label="Costo de compra" value={`$${formatCOP(animal.costoCompra)}`} />}
            <Row
              label="Esquema"
              value={animal.esquema === 'Al partir' ? `${animal.tenedor} (${animal.porcentajeTenedor} %)` : 'Propio'}
            />
          </dl>
        </Card>

        <Card
          className="lg:col-span-2"
          titulo="Historial de peso"
          icono={Scale}
          accion={
            puedeRegistrar && (
              <Button variante="suave" tamano="sm" icono={Plus} onClick={() => setShowPesoForm(true)}>
                Registrar peso
              </Button>
            )
          }
        >
          {showPesoForm && (
            <PesoForm animalId={animal.id} pesoAnterior={peso} onCancel={() => setShowPesoForm(false)} onSaved={() => setShowPesoForm(false)} />
          )}
          <div className="mb-3 grid grid-cols-2 gap-4">
            <Stat label="Ganancia diaria (todo el ciclo)" value={formatoGdp(gdpTotal(animal.pesos))} />
            <Stat
              label="Ganancia diaria (último periodo)"
              value={formatoGdp(gdpReciente(animal.pesos))}
              tono={pierdePeso(animal) ? 'peligro' : 'neutro'}
            />
          </div>
          <WeightChart pesos={animal.pesos} pesoObjetivo={animal.pesoObjetivo} />
          <p className="mt-1 text-sm text-gray-500">Último pesaje: {formatFecha(fechaUltimoPesaje(animal))}</p>
        </Card>
      </div>

      <CostoAnimal animal={animal} reparto={reparto} />

      <Card
        titulo="Ubicación"
        icono={MapPin}
        accion={
          puedeRegistrar && (
            <Button variante="suave" tamano="sm" icono={MoveRight} onClick={() => setMoviendo(true)}>
              Mover
            </Button>
          )
        }
      >
        <dl className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <Row label="Finca" value={animal.fincaNombre ?? '—'} />
          <Row label="Potrero" value={animal.potreroNombre ?? 'Sin potrero'} />
          <Row label="Lote" value={animal.loteNombre} />
        </dl>
        <Movimientos animalId={animal.id} />
        <VisitasAnimal animalId={animal.id} />
      </Card>

      <Card
        titulo="Historial sanitario"
        icono={Syringe}
        accion={
          puedeRegistrar && (
            <Button variante="suave" tamano="sm" icono={Plus} onClick={() => setShowSanidadForm(true)}>
              Registrar evento
            </Button>
          )
        }
      >
        {showSanidadForm && (
          <SanidadForm animalId={animal.id} onCancel={() => setShowSanidadForm(false)} onSaved={() => setShowSanidadForm(false)} />
        )}
        {sanidadOrdenada.length === 0 ? (
          <EmptyState titulo="Sin eventos sanitarios">Registra aquí las vacunas y los tratamientos de este animal.</EmptyState>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sanidadOrdenada.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="shrink-0 sm:w-32">
                  {s.pendiente ? (
                    <span className={`font-semibold ${diasHasta(s.proximaFecha) < 0 ? 'text-brasa' : 'text-alerta-900'}`}>
                      Pendiente {formatFecha(s.proximaFecha)}
                    </span>
                  ) : (
                    <span className="text-gray-600">{formatFecha(s.fecha)}</span>
                  )}
                </span>
                <Badge>{s.tipo}</Badge>
                <span className="w-full min-w-0 break-words text-gray-800 sm:w-auto sm:flex-1">{s.descripcion}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {moviendo && <MoverAnimales animales={[animal]} onClose={() => setMoviendo(false)} />}
    </div>
  );
}

// Spec 008 · R4: costo acumulado del animal (compra + gastos directos + su parte del lote).
function CostoAnimal({ animal, reparto }) {
  const c = costoAcumuladoAnimal(animal, reparto);
  const pesos = (n) => `$${formatCOP(Math.round(n))}`;
  return (
    <Card titulo="Costo acumulado" icono={Receipt}>
      <div className="mb-3 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total" value={pesos(c.total)} />
        <Stat label="Compra" value={animal.costoCompra != null ? pesos(c.compra) : 'Cría propia'} />
        <Stat label="Gastos directos" value={pesos(c.directos)} />
        <Stat label="Parte de los gastos del lote" value={pesos(c.deLote)} />
      </div>
      {c.gastos > 0 ? (
        <p className="text-sm text-gray-600">
          {Object.entries(c.porCategoria)
            .map(([cat, monto]) => `${CATEGORIAS_COSTO[cat]}: ${pesos(monto)}`)
            .join('; ')}
          .
        </p>
      ) : (
        <p className="text-sm text-gray-500">Todavía no hay gastos registrados para este animal ni su lote.</p>
      )}
    </Card>
  );
}

// Spec 007 · R5, R6: visitas de verificación "Al partir" en las que se revisó el animal.
function VisitasAnimal({ animalId }) {
  const visitas = useVisitasAnimal(animalId);
  if (!visitas.data?.length) return null;
  return (
    <>
      <h3 className="mb-1 mt-4 text-sm font-semibold text-gray-700">Visitas de verificación</h3>
      <ul className="divide-y divide-gray-100 text-sm">
        {visitas.data.map((v) => (
          <li key={`${v.fecha}-${v.tenedor}`} className="flex flex-wrap justify-between gap-2 py-2">
            <span className="text-gray-900">
              {formatFecha(v.fecha)}
              {v.tenedor ? `, finca de ${v.tenedor}` : ''}
            </span>
            {v.encontrado ? <span className="text-gray-700">{v.pesoKg} kg</span> : <Badge tono="alerta">No encontrado</Badge>}
          </li>
        ))}
      </ul>
    </>
  );
}

// Spec 006 · R7: historial de movimientos del animal.
function Movimientos({ animalId }) {
  const movimientos = useMovimientos(animalId);
  if (movimientos.isPending) return null;
  if (movimientos.isError) return <p className="text-sm text-peligro">No se pudo cargar el historial de movimientos.</p>;
  if (!movimientos.data.length) return <p className="text-sm text-gray-500">Sin movimientos registrados.</p>;
  return (
    <>
      <h3 className="mb-1 text-sm font-semibold text-gray-700">Movimientos</h3>
      <ul className="divide-y divide-gray-100 text-sm">
        {movimientos.data.map((m) => (
          <li key={m.id} className="py-2">
            <p className="text-gray-900">
              <span className="font-medium">{formatFecha(m.fecha)}:</span> {m.desde} → {m.hacia}
              {m.loteDesde !== m.loteHacia && `, lote ${m.loteDesde ?? '—'} → ${m.loteHacia ?? '—'}`}
            </p>
            <p className="text-gray-500">{m.motivo}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 pb-1.5 last:border-0">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function PesoForm({ animalId, pesoAnterior, onSaved, onCancel }) {
  const addPeso = useAddPeso();
  const [fecha, setFecha] = useState(hoyISO());
  const [pesoKg, setPesoKg] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(null); // peso con variación > 15 % pendiente de confirmar

  function handleSubmit(e) {
    e.preventDefault();
    const peso = Number(String(pesoKg).replace(',', '.'));
    if (!(peso > 0 && peso < 1500)) return setError('El peso debe estar entre 0,1 y 1.499 kg.');
    if (!fecha || fecha > hoyISO()) return setError('La fecha del pesaje no puede ser futura.');
    setError('');
    const valor = Math.round(peso * 10) / 10;
    // Spec 004 · R3: más de 15 % de diferencia con el último peso pide confirmación (segundo toque).
    if (variacionSospechosa(valor, pesoAnterior) && aviso !== valor) {
      setAviso(valor);
      return;
    }
    addPeso.mutate(
      { animalId, fecha, pesoKg: valor },
      { onSuccess: onSaved, onError: (err) => setError(mensajeError(err)) },
    );
  }

  // R9 (spec 002): hoja inferior en celular, con Guardar siempre visible.
  return (
    <Modal
      titulo="Registrar peso"
      onClose={onCancel}
      pie={
        <>
          <Button variante="fantasma" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" form="form-peso" disabled={addPeso.isPending}>
            {addPeso.isPending ? 'Guardando…' : aviso != null ? 'Guardar igual' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-peso" onSubmit={handleSubmit} noValidate className="grid grid-cols-2 gap-3">
        <Field label="Peso (kg)">
          <Input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={pesoKg}
            onChange={(e) => {
              setPesoKg(e.target.value);
              setAviso(null);
            }}
          />
        </Field>
        <Field label="Fecha">
          <Input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        {aviso != null && (
          <p role="alert" className="col-span-2 rounded-lg bg-alerta-50 px-3 py-2 text-sm text-alerta-900">
            Pesaba {pesoAnterior} kg y escribiste {aviso} kg ({aviso > pesoAnterior ? '+' : ''}
            {Math.round(((aviso - pesoAnterior) / pesoAnterior) * 100)} %). ¿Es correcto? Revisa el número o toca "Guardar igual".
          </p>
        )}
        <div className="col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  );
}

function SanidadForm({ animalId, onSaved, onCancel }) {
  const addSanidad = useAddSanidad();
  const [fecha, setFecha] = useState(hoyISO());
  const [tipo, setTipo] = useState('vacuna');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!descripcion.trim()) return setError('Describe la vacuna o el tratamiento aplicado.');
    if (!fecha || fecha > hoyISO()) return setError('La fecha de aplicación no puede ser futura.');
    setError('');
    addSanidad.mutate(
      { animalId, fecha, tipo, descripcion },
      { onSuccess: onSaved, onError: (err) => setError(mensajeError(err)) },
    );
  }

  return (
    <Modal
      titulo="Registrar evento sanitario"
      onClose={onCancel}
      pie={
        <>
          <Button variante="fantasma" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" form="form-sanidad" disabled={addSanidad.isPending}>
            {addSanidad.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-sanidad" onSubmit={handleSubmit} noValidate className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="vacuna">Vacuna</option>
            <option value="tratamiento">Tratamiento</option>
            <option value="desparasitacion">Desparasitación</option>
          </Select>
        </Field>
        <Field label="Fecha">
          <Input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Field label="Descripción" className="col-span-2">
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Por ejemplo: aftosa, ciclo semestral ICA" />
        </Field>
        <div className="col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  );
}
