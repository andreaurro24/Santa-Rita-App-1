import { useState } from 'react';
import { Plus, MapPin } from 'lucide-react';
import { useFincas, useCrearPotrero } from '../data/fincas';
import { useHato } from '../data/hato';
import { ConDatos } from '../components/EstadoCarga';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Field, Input, FormError } from '../components/ui/Field';
import { mensajeError } from '../lib/errores';

// Spec 006 · R5: fincas (propia y de tenedores) con sus potreros y cuántos animales tiene cada uno.
export default function Fincas() {
  const fincas = useFincas();
  const hato = useHato();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Fincas y potreros</h1>
        <p className="text-sm text-gray-500">Dónde está el hato: Santa Rita y las fincas de los tenedores "Al partir".</p>
      </div>
      <ConDatos queries={[fincas, hato]}>
        {() => {
          const activos = hato.data.animales.filter((a) => a.estado === 'Activo');
          return (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {fincas.data.map((f) => (
                <FincaCard key={f.id} finca={f} animales={activos.filter((a) => a.fincaId === f.id)} />
              ))}
            </div>
          );
        }}
      </ConDatos>
    </div>
  );
}

function FincaCard({ finca, animales }) {
  const [agregando, setAgregando] = useState(false);
  const sinPotrero = animales.filter((a) => !a.potreroId).length;
  return (
    <Card
      as="article"
      titulo={finca.nombre}
      icono={MapPin}
      accion={<Badge tono={finca.tipo === 'propia' ? 'potrero' : 'cuero'}>{finca.tipo === 'propia' ? 'Propia' : 'Tenedor'}</Badge>}
    >
      <p className="mb-3 text-sm text-gray-600">
        {animales.length} reses activas{finca.municipio ? `, ${finca.municipio}` : ''}
      </p>
      <ul className="mb-3 divide-y divide-gray-100">
        {finca.potreros.map((p) => (
          <li key={p.id} className="flex min-h-12 items-center justify-between gap-2 text-sm">
            <span className="font-medium text-gray-800">
              {p.nombre}
              {p.areaHa != null && <span className="font-normal text-gray-500"> ({p.areaHa} ha)</span>}
            </span>
            <span className="text-gray-600">{animales.filter((a) => a.potreroId === p.id).length} reses</span>
          </li>
        ))}
        {finca.potreros.length > 0 && sinPotrero > 0 && (
          <li className="flex min-h-12 items-center justify-between gap-2 text-sm text-gray-500">
            <span>Sin potrero asignado</span>
            <span>{sinPotrero} reses</span>
          </li>
        )}
      </ul>
      {agregando ? (
        <PotreroForm fincaId={finca.id} onClose={() => setAgregando(false)} />
      ) : (
        <Button variante="suave" tamano="sm" icono={Plus} onClick={() => setAgregando(true)}>
          Agregar potrero
        </Button>
      )}
    </Card>
  );
}

function PotreroForm({ fincaId, onClose }) {
  const crear = useCrearPotrero();
  const [nombre, setNombre] = useState('');
  const [areaHa, setAreaHa] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!nombre.trim()) return setError('Escribe el nombre del potrero.');
    if (areaHa !== '' && !(Number(areaHa) > 0)) return setError('El área debe ser mayor que cero.');
    setError('');
    crear.mutate({ fincaId, nombre, areaHa }, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
      <Field label="Nombre del potrero">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="La Ceiba" />
      </Field>
      <Field label="Área (ha)">
        <Input type="number" min="0.1" step="0.1" inputMode="decimal" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} />
      </Field>
      <div className="col-span-2 flex gap-2">
        <Button type="submit" disabled={crear.isPending}>
          {crear.isPending ? 'Guardando…' : 'Guardar potrero'}
        </Button>
        <Button variante="fantasma" onClick={onClose}>
          Cancelar
        </Button>
      </div>
      <div className="col-span-2">
        <FormError>{error}</FormError>
      </div>
    </form>
  );
}
