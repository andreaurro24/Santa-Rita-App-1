import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, Syringe, Scale, Tag, TrendingDown } from 'lucide-react';
import { useHato, useAddPeso, useAddSanidad } from '../data/hato';
import { ConDatos } from '../components/EstadoCarga';
import { mensajeError } from '../lib/errores';
import { useAuth } from '../context/AuthContext';
import WeightChart from '../components/WeightChart';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Chapeta from '../components/ui/Chapeta';
import EmptyState from '../components/ui/EmptyState';
import { Field, Input, Select, FormError } from '../components/ui/Field';
import { pesoActual, fechaUltimoPesaje, formatCOP } from '../domain/breakeven';
import { gdpReciente, gdpTotal, pierdePeso } from '../domain/gdp';
import Stat from '../components/ui/Stat';
import { formatFecha, diasHasta, hoyISO, formatoGdp } from '../utils/format';

export default function AnimalDetail() {
  const hato = useHato();
  return <ConDatos queries={hato}>{() => <FichaAnimal animales={hato.data.animales} />}</ConDatos>;
}

function FichaAnimal({ animales }) {
  const { id } = useParams();
  const { user } = useAuth();
  const animal = animales.find((a) => a.id === id);
  const [showPesoForm, setShowPesoForm] = useState(false);
  const [showSanidadForm, setShowSanidadForm] = useState(false);

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
      <Link to="/animales" className="inline-flex min-h-12 items-center gap-1 text-sm text-gray-600 hover:text-brand-700 md:min-h-0">
        <ArrowLeft size={16} aria-hidden="true" /> Volver al hato
      </Link>

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
              <Button variante="suave" tamano="sm" icono={Plus} onClick={() => setShowPesoForm((s) => !s)}>
                Registrar peso
              </Button>
            )
          }
        >
          {showPesoForm && (
            <PesoForm animalId={animal.id} onCancel={() => setShowPesoForm(false)} onSaved={() => setShowPesoForm(false)} />
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

      <Card
        titulo="Historial sanitario"
        icono={Syringe}
        accion={
          puedeRegistrar && (
            <Button variante="suave" tamano="sm" icono={Plus} onClick={() => setShowSanidadForm((s) => !s)}>
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
                <span className="w-32 shrink-0">
                  {s.pendiente ? (
                    <span className={`font-semibold ${diasHasta(s.proximaFecha) < 0 ? 'text-peligro' : 'text-alerta-900'}`}>
                      Pendiente {formatFecha(s.proximaFecha)}
                    </span>
                  ) : (
                    <span className="text-gray-600">{formatFecha(s.fecha)}</span>
                  )}
                </span>
                <Badge>{s.tipo}</Badge>
                <span className="min-w-0 flex-1 text-gray-800">{s.descripcion}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
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

function PesoForm({ animalId, onSaved, onCancel }) {
  const addPeso = useAddPeso();
  const [fecha, setFecha] = useState(hoyISO());
  const [pesoKg, setPesoKg] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const peso = Number(pesoKg);
    if (!(peso > 0 && peso < 1500)) return setError('El peso debe estar entre 0,1 y 1.499 kg.');
    if (!fecha || fecha > hoyISO()) return setError('La fecha del pesaje no puede ser futura.');
    setError('');
    addPeso.mutate(
      { animalId, fecha, pesoKg: Math.round(peso * 10) / 10 },
      { onSuccess: onSaved, onError: (err) => setError(mensajeError(err)) },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 md:flex md:flex-wrap md:items-end">
      <Field label="Fecha">
        <Input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
      </Field>
      <Field label="Peso (kg)">
        <Input type="number" min="0.1" step="0.1" inputMode="decimal" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} />
      </Field>
      <div className="col-span-2 flex gap-2">
        <Button type="submit" disabled={addPeso.isPending}>
          {addPeso.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button variante="fantasma" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      <div className="col-span-2 md:w-full">
        <FormError>{error}</FormError>
      </div>
    </form>
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
    <form onSubmit={handleSubmit} noValidate className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 md:grid-cols-4 md:items-end">
      <Field label="Fecha">
        <Input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
      </Field>
      <Field label="Tipo">
        <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="vacuna">Vacuna</option>
          <option value="tratamiento">Tratamiento</option>
          <option value="desparasitacion">Desparasitación</option>
        </Select>
      </Field>
      <Field label="Descripción" className="col-span-2">
        <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </Field>
      <div className="col-span-2 flex gap-2 md:col-span-4">
        <Button type="submit" disabled={addSanidad.isPending}>
          {addSanidad.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button variante="fantasma" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      <div className="col-span-2 md:col-span-4">
        <FormError>{error}</FormError>
      </div>
    </form>
  );
}
