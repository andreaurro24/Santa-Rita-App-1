import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, Syringe, ScaleIcon, Tag } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import WeightChart from '../components/WeightChart';
import { pesoActual, fechaUltimoPesaje } from '../utils/breakeven';
import { formatFecha, diasHasta } from '../utils/format';
import { formatCOP } from '../utils/breakeven';

export default function AnimalDetail() {
  const { id } = useParams();
  const { animales, addPeso, addSanidad } = useData();
  const { user } = useAuth();
  const animal = animales.find((a) => a.id === id);
  const [showPesoForm, setShowPesoForm] = useState(false);
  const [showSanidadForm, setShowSanidadForm] = useState(false);

  if (!animal) return <Navigate to="/animales" replace />;

  const puedeRegistrar = user?.rol === 'administrador';
  const avance = Math.round((pesoActual(animal) / animal.pesoObjetivo) * 100);

  const sanidadOrdenada = [...(animal.sanidad ?? [])].sort((a, b) =>
    (b.fecha ?? b.proximaFecha ?? '').localeCompare(a.fecha ?? a.proximaFecha ?? ''),
  );

  return (
    <div className="space-y-6">
      <Link to="/animales" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        <ArrowLeft size={14} /> Volver al hato
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Animal N° {animal.numeroInterno}</h1>
          <p className="text-sm text-gray-500">{animal.loteNombre}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold text-brand-700">{pesoActual(animal)} kg</p>
          <p className="text-xs text-gray-400">Meta: {animal.pesoObjetivo} kg · {avance}% de avance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
            <Tag size={16} className="text-brand-600" /> Identificación
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Marca de finca" value={animal.marcaFinca} />
            <Row label="Chapeta ICA / Sinigán" value={animal.chapetaICA} />
            <Row label="Sexo" value={animal.sexo} />
            <Row label="Origen" value={animal.origen} />
            <Row label="Fecha de ingreso" value={formatFecha(animal.fechaIngreso)} />
            <Row label="Peso de ingreso" value={`${animal.pesoIngreso} kg`} />
            {animal.costoCompra && <Row label="Costo de compra" value={`$${formatCOP(animal.costoCompra)} COP`} />}
            <Row
              label="Esquema"
              value={
                animal.esquema === 'Al partir'
                  ? `Al partir — ${animal.tenedor} (${animal.porcentajeTenedor}%)`
                  : 'Propio'
              }
            />
          </dl>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <ScaleIcon size={16} className="text-brand-600" /> Historial de peso
            </h2>
            {puedeRegistrar && (
              <button
                onClick={() => setShowPesoForm((s) => !s)}
                className="flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
              >
                <Plus size={14} /> Registrar peso
              </button>
            )}
          </div>
          {showPesoForm && (
            <PesoForm
              onCancel={() => setShowPesoForm(false)}
              onSave={(registro) => {
                addPeso(animal.id, registro);
                setShowPesoForm(false);
              }}
            />
          )}
          <WeightChart pesos={animal.pesos} pesoObjetivo={animal.pesoObjetivo} />
          <p className="mt-1 text-xs text-gray-400">Último pesaje: {formatFecha(fechaUltimoPesaje(animal))}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <Syringe size={16} className="text-brand-600" /> Historial sanitario
          </h2>
          {puedeRegistrar && (
            <button
              onClick={() => setShowSanidadForm((s) => !s)}
              className="flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Plus size={14} /> Registrar evento
            </button>
          )}
        </div>
        {showSanidadForm && (
          <SanidadForm
            onCancel={() => setShowSanidadForm(false)}
            onSave={(evento) => {
              addSanidad(animal.id, evento);
              setShowSanidadForm(false);
            }}
          />
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-4">Fecha</th>
              <th className="py-2 pr-4">Tipo</th>
              <th className="py-2">Descripción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sanidadOrdenada.map((s, i) => (
              <tr key={i}>
                <td className="py-2 pr-4 text-gray-600">
                  {s.pendiente ? (
                    <span className={diasHasta(s.proximaFecha) < 0 ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
                      Pendiente — {formatFecha(s.proximaFecha)}
                    </span>
                  ) : (
                    formatFecha(s.fecha)
                  )}
                </td>
                <td className="py-2 pr-4">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{s.tipo}</span>
                </td>
                <td className="py-2 text-gray-700">{s.descripcion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-50 pb-1.5">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{value}</dd>
    </div>
  );
}

function PesoForm({ onSave, onCancel }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [pesoKg, setPesoKg] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pesoKg) return;
        onSave({ fecha, pesoKg: Number(pesoKg) });
      }}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3"
    >
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Fecha</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Peso (kg)</span>
        <input type="number" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} className="input" required />
      </label>
      <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Guardar
      </button>
      <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
        Cancelar
      </button>
    </form>
  );
}

function SanidadForm({ onSave, onCancel }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState('Vacuna');
  const [descripcion, setDescripcion] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!descripcion) return;
        onSave({ fecha, tipo, descripcion });
      }}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3"
    >
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Fecha</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Tipo</span>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input">
          <option>Vacuna</option>
          <option>Tratamiento</option>
        </select>
      </label>
      <label className="text-sm flex-1 min-w-[180px]">
        <span className="mb-1 block text-gray-600">Descripción</span>
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="input" required />
      </label>
      <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Guardar
      </button>
      <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
        Cancelar
      </button>
    </form>
  );
}
