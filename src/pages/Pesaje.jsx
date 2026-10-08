import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, SkipForward, Scale, CircleStop } from 'lucide-react';
import { useHato } from '../data/hato';
import { useAbrirJornada, useCerrarJornada, useJornada, useJornadasLote, useRegistrarEnJornada } from '../data/pesajes';
import { ConDatos } from '../components/EstadoCarga';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Chapeta from '../components/ui/Chapeta';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { Field, Input, Select, FormError } from '../components/ui/Field';
import { pesoActual, fechaUltimoPesaje } from '../domain/breakeven';
import { variacionSospechosa } from '../domain/gdp';
import { formatFecha, hoyISO, formatKg, formatPct, cantidad } from '../utils/format';
import { mensajeError } from '../lib/errores';

// Spec 004 · R1, R8: elegir el lote y abrir (o retomar) una jornada; ver las anteriores.
export function PesajeInicio() {
  const hato = useHato();
  return <ConDatos queries={hato}>{() => <InicioContenido lotes={hato.data.lotes} />}</ConDatos>;
}

function InicioContenido({ lotes }) {
  const conActivos = lotes.filter((l) => l.animales.some((a) => a.estado === 'Activo'));
  // Verificación Sprint 05 (M4): con la base vacía no hay lote que pesar; la consulta de jornadas
  // quedaría deshabilitada y la pantalla, cargando para siempre.
  if (!conActivos.length) {
    return (
      <div className="space-y-5">
        <h1 className="text-3xl font-bold text-gray-900">Jornada de pesaje</h1>
        <EmptyState titulo="Todavía no hay animales para pesar">
          Registra animales en un lote y vuelve aquí para pesarlos.{' '}
          <Link to="/animales?nuevo=1" className="font-semibold text-brand-700 underline">
            Registrar animal
          </Link>
        </EmptyState>
      </div>
    );
  }
  return <InicioConLotes conActivos={conActivos} />;
}

function InicioConLotes({ conActivos }) {
  const navigate = useNavigate();
  const [loteId, setLoteId] = useState(conActivos[0]?.id ?? '');
  const [fecha, setFecha] = useState(hoyISO());
  const [error, setError] = useState('');
  const abrir = useAbrirJornada();
  const jornadas = useJornadasLote(loteId);
  const abierta = jornadas.data?.find((j) => j.estado === 'abierta');

  function handleAbrir(e) {
    e.preventDefault();
    if (!fecha || fecha > hoyISO()) return setError('La fecha de la jornada no puede ser futura.');
    setError('');
    abrir.mutate({ loteId, fecha }, { onSuccess: (id) => navigate(`/pesaje/${id}`), onError: (err) => setError(mensajeError(err)) });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Jornada de pesaje</h1>
        <p className="text-sm text-gray-500">Pesa el lote animal por animal. Cada peso se guarda al confirmarlo.</p>
      </div>

      <Card>
        <form onSubmit={handleAbrir} noValidate className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end">
          <Field label="Lote">
            <Select value={loteId} onChange={(e) => setLoteId(e.target.value)}>
              {conActivos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre} ({cantidad(l.animales.filter((a) => a.estado === 'Activo').length, 'res', 'reses')})
                </option>
              ))}
            </Select>
          </Field>
          {!abierta && (
            <Field label="Fecha de la jornada">
              <Input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
            </Field>
          )}
          {abierta ? (
            <Button icono={Scale} onClick={() => navigate(`/pesaje/${abierta.id}`)} className="md:col-span-2">
              Continuar la jornada del {formatFecha(abierta.fecha)}
            </Button>
          ) : (
            <Button type="submit" icono={Scale} disabled={abrir.isPending || !loteId}>
              {abrir.isPending ? 'Abriendo…' : 'Abrir jornada'}
            </Button>
          )}
        </form>
        <div className="mt-3">
          <FormError>{error}</FormError>
        </div>
      </Card>

      <Card titulo="Jornadas anteriores de este lote">
        <ConDatos queries={jornadas}>
          {() =>
            jornadas.data.length === 0 ? (
              <EmptyState titulo="Todavía no hay jornadas">Cuando cierres la primera, aparecerá aquí con su peso promedio.</EmptyState>
            ) : (
              <ul className="divide-y divide-gray-100">
                {jornadas.data.map((j) => (
                  <li key={j.id}>
                    <Link to={`/pesaje/${j.id}`} className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1 py-2 hover:bg-gray-50">
                      <span className="w-28 font-medium text-gray-900">{formatFecha(j.fecha)}</span>
                      <span className="text-sm text-gray-600">{j.nPesados} pesados</span>
                      <span className="text-sm text-gray-600">{j.pesoPromedio != null ? `promedio ${formatKg(j.pesoPromedio)}` : 'sin pesos'}</span>
                      {j.estado === 'abierta' ? <Badge tono="alerta">Abierta</Badge> : <Badge>Cerrada</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )
          }
        </ConDatos>
      </Card>
    </div>
  );
}

// Spec 004 · R1–R4: captura animal por animal.
export function PesajeJornada() {
  const { jornadaId } = useParams();
  const hato = useHato();
  const jornada = useJornada(jornadaId);
  return (
    <ConDatos queries={[hato, jornada]}>
      {() =>
        jornada.data ? (
          <JornadaContenido jornada={jornada.data} lotes={hato.data.lotes} />
        ) : (
          <EmptyState titulo="Esa jornada no existe" accion={<Link to="/pesaje" className="font-medium text-brand-700">Ir a Pesaje</Link>} />
        )
      }
    </ConDatos>
  );
}

function JornadaContenido({ jornada, lotes }) {
  const lote = lotes.find((l) => l.id === jornada.loteId);
  const animales = useMemo(
    () => (lote?.animales ?? []).filter((a) => a.estado === 'Activo').sort((a, b) => a.numeroInterno.localeCompare(b.numeroInterno)),
    [lote],
  );
  const [saltados, setSaltados] = useState(() => new Set());
  const [elegidoId, setElegidoId] = useState(null);
  const [cerrando, setCerrando] = useState(false);

  const pendientes = animales.filter((a) => !jornada.pesados.has(a.id));
  const enCola = pendientes.filter((a) => !saltados.has(a.id));
  const actual = pendientes.find((a) => a.id === elegidoId) ?? enCola[0] ?? null;
  const abierta = jornada.estado === 'abierta';

  function saltar(animal) {
    setSaltados((s) => new Set(s).add(animal.id));
    setElegidoId(null);
  }

  return (
    <div className="space-y-5">
      <Link to="/pesaje" className="inline-flex min-h-12 items-center gap-1 text-sm text-gray-600 hover:text-brand-700 md:min-h-0">
        <ArrowLeft size={16} aria-hidden="true" /> Jornadas
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{lote?.nombre ?? 'Lote'}</h1>
          <p className="text-sm text-gray-600">
            Jornada del {formatFecha(jornada.fecha)}, {abierta ? 'abierta' : 'cerrada'}
          </p>
        </div>
        {abierta && (
          <Button variante="secundario" icono={CircleStop} onClick={() => setCerrando(true)}>
            Cerrar jornada
          </Button>
        )}
      </div>

      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-gray-600">Avance</span>
          <span className="font-semibold text-gray-900" data-testid="avance">
            {jornada.nPesados} de {animales.length} pesados
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${animales.length ? (jornada.nPesados / animales.length) * 100 : 0}%` }} />
        </div>
      </div>

      {abierta && actual && (
        <CapturaPeso key={actual.id} jornada={jornada} animal={actual} onSaltar={() => saltar(actual)} onGuardado={() => setElegidoId(null)} />
      )}
      {abierta && !actual && pendientes.length === 0 && (
        <EmptyState titulo="Todo el lote está pesado" accion={<Button onClick={() => setCerrando(true)}>Cerrar jornada</Button>}>
          Cierra la jornada para dejarla en el historial del lote.
        </EmptyState>
      )}
      {abierta && !actual && pendientes.length > 0 && (
        <EmptyState titulo="Saltaste los que faltan">Toca un animal de la lista de pendientes para pesarlo, o cierra la jornada.</EmptyState>
      )}

      {pendientes.length > 0 && (
        <Card titulo={`Sin pesar (${pendientes.length})`}>
          <ul className="flex flex-wrap gap-2">
            {pendientes.map((a) => (
              <li key={a.id}>
                <button
                  disabled={!abierta}
                  onClick={() => setElegidoId(a.id)}
                  className={`flex min-h-12 items-center gap-1 rounded-lg px-1 ${actual?.id === a.id ? 'ring-2 ring-brand-600' : ''}`}
                  aria-label={`Pesar ${a.numeroInterno}${saltados.has(a.id) ? ' (saltado)' : ''}`}
                >
                  <Chapeta numero={a.numeroInterno} className={saltados.has(a.id) ? 'opacity-60' : ''} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {jornada.nPesados > 0 && (
        <Card titulo={`Pesados (${jornada.nPesados})`}>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(12rem,100%),1fr))] gap-2">
            {animales
              .filter((a) => jornada.pesados.has(a.id))
              .map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
                  <Chapeta numero={a.numeroInterno} />
                  <span className="cifra ml-auto whitespace-nowrap font-bold text-gray-900">{formatKg(jornada.pesados.get(a.id))}</span>
                </li>
              ))}
          </ul>
          {jornada.pesoPromedio != null && <p className="mt-3 text-sm text-gray-600">Peso promedio de la jornada: {formatKg(jornada.pesoPromedio)}</p>}
        </Card>
      )}

      {cerrando && <CerrarJornada jornada={jornada} pendientes={pendientes} onClose={() => setCerrando(false)} />}
    </div>
  );
}

function CapturaPeso({ jornada, animal, onSaltar, onGuardado }) {
  const registrar = useRegistrarEnJornada();
  const [peso, setPeso] = useState('');
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(null);
  const campo = useRef(null);
  const anterior = pesoActual(animal);

  function guardar(valor) {
    registrar.mutate(
      { jornada, animalId: animal.id, pesoKg: valor },
      {
        onSuccess: () => {
          setConfirmar(null);
          onGuardado();
        },
        onError: (err) => {
          setConfirmar(null);
          setError(mensajeError(err));
        },
      },
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    const valor = Math.round(Number(String(peso).replace(',', '.')) * 10) / 10;
    if (!(valor > 0 && valor < 1500)) return setError('El peso debe estar entre 0,1 y 1.499 kg.');
    setError('');
    // R3: más de 15 % de diferencia con el último peso pide confirmación.
    if (variacionSospechosa(valor, anterior)) return setConfirmar(valor);
    guardar(valor);
  }

  const cambio = confirmar ? Math.round(((confirmar - anterior) / anterior) * 100) : 0;

  return (
    <Card className="border-brand-300">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <Chapeta numero={animal.numeroInterno} tamano="lg" />
          <div className="text-sm text-gray-600">
            <p>
              Último peso: <span className="cifra text-lg font-bold text-gray-900">{formatKg(anterior)}</span>
            </p>
            <p>{formatFecha(fechaUltimoPesaje(animal))}</p>
          </div>
        </div>
        <Field label={`Peso de ${animal.numeroInterno} (kg)`}>
          <Input
            ref={campo}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            className="cifra text-3xl font-bold"
          />
        </Field>
        <FormError>{error}</FormError>
        <div className="grid grid-cols-1 gap-2 md:flex">
          <Button type="submit" icono={Check} disabled={registrar.isPending}>
            {registrar.isPending ? 'Guardando…' : 'Guardar peso'}
          </Button>
          <Button variante="secundario" icono={SkipForward} onClick={onSaltar}>
            Saltar
          </Button>
        </div>
      </form>

      {confirmar != null && (
        <Modal
          titulo="¿El peso es correcto?"
          onClose={() => {
            setConfirmar(null);
            campo.current?.focus();
          }}
          pie={
            <>
              <Button
                variante="fantasma"
                onClick={() => {
                  setConfirmar(null);
                  campo.current?.focus();
                }}
              >
                Corregir
              </Button>
              <Button onClick={() => guardar(confirmar)} disabled={registrar.isPending}>
                Guardar igual
              </Button>
            </>
          }
        >
          <p className="text-gray-800">
            {animal.numeroInterno} pesaba {formatKg(anterior)} y ahora escribiste {formatKg(confirmar)}: {cambio > 0 ? '+' : ''}
            {formatPct(cambio)}. Puede ser un error de digitación.
          </p>
        </Modal>
      )}
    </Card>
  );
}

function CerrarJornada({ jornada, pendientes, onClose }) {
  const cerrar = useCerrarJornada();
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');
  return (
    <Modal
      titulo="Cerrar jornada"
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Seguir pesando
          </Button>
          <Button
            disabled={cerrar.isPending}
            onClick={() => cerrar.mutate({ id: jornada.id, notas }, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) })}
          >
            {cerrar.isPending ? 'Cerrando…' : 'Cerrar jornada'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {pendientes.length > 0 ? (
          <>
            <p className="text-gray-800">{pendientes.length === 1 ? 'Queda 1 animal sin pesar. Quedará anotado' : `Quedan ${pendientes.length} animales sin pesar. Quedarán anotados`} en la jornada:</p>
            <ul className="flex flex-wrap gap-2">
              {pendientes.map((a) => (
                <li key={a.id}>
                  <Chapeta numero={a.numeroInterno} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-gray-800">Todos los animales activos del lote quedaron pesados.</p>
        )}
        <Field label="Notas (opcional)">
          <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Por ejemplo: 0212 no entró al corral" />
        </Field>
        <FormError>{error}</FormError>
      </div>
    </Modal>
  );
}
