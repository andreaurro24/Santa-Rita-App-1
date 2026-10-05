import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, BadgeDollarSign, CheckCircle2, XCircle } from 'lucide-react';
import { useVentas, useRegistrarVenta } from '../data/ventas';
import { useAnalisisLotes, useAnalisisLote } from '../data/analisis';
import { pesoActual, formatCOP } from '../domain/breakeven';
import { costoAcumuladoAnimal } from '../domain/costos';
import { esVientre } from '../domain/animales';
import { precioPorAnimal } from '../domain/precios';
import { estadoContratos, resultadoVenta, siguioRecomendacion } from '../domain/decision';
import { ConDatos } from '../components/EstadoCarga';
import RecomendacionBadge from '../components/RecomendacionBadge';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Chapeta from '../components/ui/Chapeta';
import Stat from '../components/ui/Stat';
import EmptyState from '../components/ui/EmptyState';
import { Field, Input, Select, FormError } from '../components/ui/Field';
import CampoPesos from '../components/ui/CampoPesos';
import { mensajeNombre, numeroAPesos, pesosANumero } from '../utils/validar';
import { formatFecha, hoyISO, formatKg, formatPct, numeroParaCampo, cantidad } from '../utils/format';
import { mensajeError } from '../lib/errores';

const pesos = (n) => (n == null ? '—' : `${n < 0 ? '−' : ''}$${formatCOP(Math.round(Math.abs(n)))}`);
const tono = (n) => (n > 0 ? 'ok' : n < 0 ? 'peligro' : 'neutro');

function Seguimiento({ recomendacion }) {
  const siguio = siguioRecomendacion(recomendacion?.recomendacion);
  if (siguio == null) return <Badge>Sin recomendación guardada</Badge>;
  return siguio ? (
    <Badge tono="ok" icono={CheckCircle2}>
      Siguió la recomendación
    </Badge>
  ) : (
    <Badge tono="alerta" icono={XCircle}>
      No siguió la recomendación
    </Badge>
  );
}

// Spec 011 · R6: lista de ventas.
export function VentasLista() {
  const ventas = useVentas();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
          <p className="text-sm text-gray-500">Cada venta real con su resultado y lo que había recomendado el sistema.</p>
        </div>
        <Link
          to="/ventas/nueva"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-base font-semibold text-white hover:bg-brand-800 md:min-h-10 md:text-sm"
        >
          <Plus size={18} aria-hidden="true" />
          Registrar venta
        </Link>
      </div>
      <ConDatos queries={ventas}>
        {() =>
          ventas.data.length === 0 ? (
            <EmptyState titulo="Todavía no hay ventas">Cuando vendas un lote, regístralo aquí para comparar el resultado con la recomendación.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {ventas.data.map((v) => {
                const r = resultadoVenta(v.animales, v, estadoContratos(ventas.data, { antesDe: v.id }));
                return (
                  <li key={v.id}>
                    <Link to={`/ventas/${v.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-300">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="mr-auto text-lg font-bold text-gray-900">{v.lote?.nombre}</h2>
                        <Seguimiento recomendacion={v.recomendacion} />
                      </div>
                      <p className="mb-3 text-sm text-gray-600">
                        {formatFecha(v.fecha)}, a {v.comprador}. {cantidad(v.animales.length, 'res', 'reses')} a {pesos(v.precioKg)}/kg.
                      </p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <Stat label="Ingreso" value={pesos(r.ingreso)} />
                        <Stat label="Margen neto" value={pesos(r.margenNeto)} tono={tono(r.margenNeto)} />
                        <Stat label="A los tenedores" value={pesos(r.participacion)} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        }
      </ConDatos>
    </div>
  );
}

// Spec 011 · R1–R4: asistente para registrar la venta de un lote.
export function NuevaVenta() {
  const datos = useAnalisisLotes();
  return <ConDatos queries={datos.queries}>{() => <NuevaVentaContenido datos={datos} />}</ConDatos>;
}

const PASOS = ['¿Qué vende?', '¿A quién y a cuánto?', 'Confirmar'];

// Spec 019 · R2: asistente de venta en 3 pasos. R1: `?animal=<id>` vende solo ese animal.
function NuevaVentaContenido({ datos }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const registrar = useRegistrarVenta();
  const lotes = datos.lotes.data.filter((l) => l.estado === 'activo' || l.estado === 'listo');
  const animalUnico = params.get('animal');
  const [paso, setPaso] = useState(0);
  const [loteId, setLoteId] = useState(params.get('lote') ?? lotes[0]?.id ?? '');
  const [form, setForm] = useState({
    fecha: hoyISO(),
    comprador: '',
    precioKg: '',
    destarePct: numeroParaCampo(datos.parametros.data.destarePct),
    notas: '',
  });
  const set = (c, v) => setForm((f) => ({ ...f, [c]: v }));
  const precio = pesosANumero(form.precioKg);
  const analisis = useAnalisisLote(datos, loteId, precio);

  const animalesLote = useMemo(() => datos.hato.data.animales.filter((a) => a.loteId === loteId), [datos.hato.data, loteId]);
  const vendibles = animalesLote
    .filter((a) => a.estado === 'Activo' && !esVientre(a.categoria)) // R2 / D2 (los tres tipos de vientre)
    .sort((a, b) => a.numeroInterno.localeCompare(b.numeroInterno, 'es', { numeric: true }));
  const vientres = animalesLote.filter((a) => a.estado === 'Activo' && esVientre(a.categoria)).length;

  // Map animalId → peso (texto); null = todos con su peso actual. Con ?animal= arranca solo con ese.
  const [seleccion, setSeleccion] = useState(() => {
    const unico = animalUnico && datos.hato.data.animales.find((a) => a.id === animalUnico);
    return unico ? new Map([[unico.id, numeroParaCampo(pesoActual(unico))]]) : null;
  });
  const filas = vendibles.map((a) => ({
    animal: a,
    incluido: seleccion ? seleccion.has(a.id) : true,
    peso: seleccion?.get(a.id) ?? numeroParaCampo(pesoActual(a)),
  }));
  const [error, setError] = useState('');

  function alternar(a) {
    const m = new Map(seleccion ?? filas.map((f) => [f.animal.id, f.peso]));
    if (m.has(a.id)) m.delete(a.id);
    else m.set(a.id, numeroParaCampo(pesoActual(a)));
    setSeleccion(m);
  }
  function cambiarPeso(a, valor) {
    const m = new Map(seleccion ?? filas.map((f) => [f.animal.id, f.peso]));
    m.set(a.id, valor);
    setSeleccion(m);
  }

  const incluidos = filas.filter((f) => f.incluido);
  const pesoDe = (f) => Number(String(f.peso).replace(',', '.')) || 0;
  const destare = Number(String(form.destarePct).replace(',', '.'));
  const vista = resultadoVenta(
    incluidos.map((f) => ({
      pesoKg: pesoDe(f),
      costoCop: costoAcumuladoAnimal(f.animal, datos.costos.reparto).total,
      contratoId: f.animal.contratoId,
      porcentajeTenedor: f.animal.porcentajeTenedor,
    })),
    { precioKg: precio || 0, destarePct: destare || 0 },
    // D8 acumulado (011 R5): cuentan todas las ventas ya registradas, sea cual sea la fecha de esta.
    estadoContratos(datos.ventas.data),
  );
  const terneras = incluidos.filter((f) => f.animal.categoria === 'ternera').length;
  const kilos = incluidos.reduce((s, f) => s + pesoDe(f), 0);

  // Spec 021: precio sugerido = precio de la zona de cada animal, ponderado por su peso.
  function precioSugerido() {
    if (!analisis?.rangos) return null;
    const porAnimal = precioPorAnimal(analisis.rangos, datos.precios.data.precioActual?.precioCOP ?? null);
    let total = 0;
    let peso = 0;
    for (const f of incluidos) {
      const p = porAnimal(f.animal, pesoDe(f));
      if (!(p > 0)) return null;
      total += p * pesoDe(f);
      peso += pesoDe(f);
    }
    return peso > 0 ? Math.round(total / peso) : null;
  }

  function validarPaso(n) {
    if (n === 0) {
      if (!incluidos.length) return 'Selecciona al menos un animal.';
      for (const f of incluidos) {
        const p = Math.round(pesoDe(f) * 10) / 10;
        if (!(p > 0 && p < 1500)) return `El peso de ${f.animal.numeroInterno} debe estar entre 0,1 y 1.499 kg.`;
      }
    }
    if (n === 1) {
      const nombre = mensajeNombre(form.comprador, 'el nombre del comprador');
      if (nombre) return nombre;
      if (!(precio > 0)) return 'Escribe el precio por kilo.';
      if (precio > 100_000) return 'Revisa el precio por kilo: parece tener un cero de más.';
      if (!(destare >= 0 && destare <= 15)) return 'El destare debe estar entre 0 y 15 %.';
      if (!form.fecha || form.fecha > hoyISO()) return 'La fecha de la venta no puede ser futura.';
    }
    return null;
  }

  function siguiente() {
    const problema = validarPaso(paso);
    if (problema) return setError(problema);
    setError('');
    if (paso === 0 && !form.precioKg) {
      const sugerido = precioSugerido();
      if (sugerido) set('precioKg', numeroAPesos(sugerido));
    }
    setPaso((p) => p + 1);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (paso < 2) return siguiente();
    const problema = validarPaso(0) || validarPaso(1);
    if (problema) return setError(problema);
    setError('');
    const animales = incluidos.map((f) => ({ animalId: f.animal.id, pesoKg: Math.round(pesoDe(f) * 10) / 10, costoCop: costoAcumuladoAnimal(f.animal, datos.costos.reparto).total }));
    const r = analisis?.resultado;
    registrar.mutate(
      {
        loteId,
        ...form,
        precioKg: precio,
        destarePct: destare,
        // R4: copia de lo que recomendaba el sistema en este momento.
        recomendacion: r
          ? { recomendacion: r.recomendacion, razon: r.razones[0], equilibrioKg: r.hoy?.equilibrioKg ?? null, margenNeto: r.hoy?.margenNeto ?? null, fecha: hoyISO() }
          : null,
        animales,
      },
      { onSuccess: (id) => navigate(`/ventas/${id}`), onError: (err) => setError(mensajeError(err)) },
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/ventas" className="inline-flex min-h-12 items-center gap-1 text-base text-gray-600 hover:text-brand-700">
        <ArrowLeft size={18} aria-hidden="true" /> Ventas
      </Link>
      <h1 className="text-3xl font-bold text-gray-900">Registrar venta</h1>

      <ol className="grid grid-cols-3 gap-2" aria-label="Pasos">
        {PASOS.map((p, i) => (
          <li
            key={p}
            aria-current={i === paso ? 'step' : undefined}
            className={`rounded-lg px-2 py-2 text-center text-sm font-semibold ${i === paso ? 'bg-brand-700 text-white' : i < paso ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-600'}`}
          >
            {i + 1}. {p}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {paso === 0 && (
          <>
            <Card>
              <Field label="Lote">
                <Select
                  value={loteId}
                  onChange={(e) => {
                    setLoteId(e.target.value);
                    setSeleccion(null);
                  }}
                >
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
            </Card>
            <Card titulo={`Animales (${incluidos.length} de ${vendibles.length})`}>
              {vientres > 0 && <p className="mb-2 text-base text-gray-600">{vientres === 1 ? '1 vientre no aparece: no se vende.' : `${vientres} vientres no aparecen: no se venden.`}</p>}
              <div className="mb-3 flex flex-wrap gap-2">
                <Button variante="secundario" tamano="sm" onClick={() => setSeleccion(null)}>
                  Todos
                </Button>
                <Button variante="secundario" tamano="sm" onClick={() => setSeleccion(new Map())}>
                  Ninguno
                </Button>
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filas.map((f) => (
                  <li key={f.animal.id} className={`flex min-h-16 items-center gap-3 rounded-xl border-2 px-3 py-2 ${f.incluido ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white'}`}>
                    {/* Spec 019 · R2 (verificación 011): toda la fila izquierda es el control para incluir el animal. */}
                    <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3">
                      <input type="checkbox" className="size-7 accent-brand-700" checked={f.incluido} onChange={() => alternar(f.animal)} aria-label={`Vender ${f.animal.numeroInterno}`} />
                      <Chapeta numero={f.animal.numeroInterno} />
                    </label>
                    <label className="w-28">
                      <span className="sr-only">Peso de venta de {f.animal.numeroInterno} (kg)</span>
                      <Input type="text" inputMode="decimal" value={f.peso} disabled={!f.incluido} onChange={(e) => cambiarPeso(f.animal, e.target.value)} className="text-right" />
                    </label>
                  </li>
                ))}
              </ul>
              {terneras > 0 && (
                <p role="status" className="mt-3 rounded-lg bg-alerta-50 px-3 py-2 text-base text-alerta-900">
                  Incluye {terneras} {terneras === 1 ? 'ternera' : 'terneras'}. Verifica que no tengan potencial reproductivo antes de venderlas.
                </p>
              )}
            </Card>
          </>
        )}

        {paso === 1 && (
          <Card>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Comprador" required>
                <Input value={form.comprador} maxLength={80} onChange={(e) => set('comprador', e.target.value)} />
              </Field>
              <Field label="Precio por kilo" required ayuda="Viene con el precio de la zona; cámbialo por el que se negoció.">
                <CampoPesos value={form.precioKg} onChange={(v) => set('precioKg', v)} />
              </Field>
              <Field label="Destare (%)">
                <Input type="text" inputMode="decimal" value={form.destarePct} onChange={(e) => set('destarePct', e.target.value)} />
              </Field>
              <Field label="Fecha de la venta">
                <Input type="date" value={form.fecha} max={hoyISO()} onChange={(e) => set('fecha', e.target.value)} />
              </Field>
              <Field label="Notas" ayuda="Opcional" className="md:col-span-2">
                <Input value={form.notas} maxLength={500} onChange={(e) => set('notas', e.target.value)} />
              </Field>
            </div>
          </Card>
        )}

        {paso === 2 && (
          <>
            <Card titulo="Resultado de esta venta">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Stat label="Reses" value={incluidos.length} sub={`${formatKg(Math.round(kilos))} en total`} />
                <Stat label="Precio por kilo" value={pesos(precio)} sub={`Destare ${formatPct(destare || 0)}`} />
                <Stat label="Ingreso" value={pesos(vista.ingreso)} />
                <Stat label="Costo acumulado" value={pesos(vista.costo)} />
                <Stat
                  label="A los tenedores"
                  value={pesos(vista.participacion)}
                  sub={vista.liquidaciones.some((l) => l.pagadoAntes > 0 || l.gananciaAcumulada !== l.ganancia) ? 'Con lo acumulado y lo ya pagado del contrato' : undefined}
                />
                <Stat label="Margen neto" value={pesos(vista.margenNeto)} tono={tono(vista.margenNeto)} sub="Para Santa Rita" />
              </div>
              <p className="mt-3 text-base text-gray-700">
                A {form.comprador.trim()}, el {formatFecha(form.fecha)}.
              </p>
            </Card>
            {analisis?.resultado && (
              <Card titulo="Lo que recomienda el sistema hoy">
                <div className="flex flex-wrap items-center gap-3">
                  <RecomendacionBadge recomendacion={analisis.resultado.recomendacion} />
                  <p className="text-base text-gray-700">{analisis.resultado.razones[0]}</p>
                </div>
              </Card>
            )}
          </>
        )}

        <FormError>{error}</FormError>
        <div className="flex flex-wrap justify-between gap-2">
          {paso === 0 ? (
            <Button variante="fantasma" onClick={() => navigate(animalUnico ? `/animales/${animalUnico}` : '/ventas')}>
              Cancelar
            </Button>
          ) : (
            <Button variante="secundario" icono={ArrowLeft} onClick={() => (setError(''), setPaso((p) => p - 1))}>
              Atrás
            </Button>
          )}
          {paso < 2 ? (
            <Button type="submit">Siguiente</Button>
          ) : (
            <Button type="submit" icono={BadgeDollarSign} disabled={registrar.isPending}>
              {registrar.isPending ? 'Guardando…' : 'Guardar venta'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

// Spec 011 · R4, R5: detalle con la comparación y la liquidación.
export function VentaDetalle() {
  const { ventaId } = useParams();
  const ventas = useVentas();
  return (
    <ConDatos queries={ventas}>
      {() => {
        const v = ventas.data.find((x) => x.id === ventaId);
        return v ? (
          <DetalleVenta venta={v} ventas={ventas.data} />
        ) : (
          <EmptyState titulo="Esa venta no existe" accion={<Link to="/ventas" className="font-medium text-brand-700">Ver ventas</Link>} />
        );
      }}
    </ConDatos>
  );
}

function DetalleVenta({ venta: v, ventas }) {
  const r = resultadoVenta(v.animales, v, estadoContratos(ventas, { antesDe: v.id }));
  const rec = v.recomendacion;
  const tenedorDe = (contratoId) => v.animales.find((a) => a.contratoId === contratoId)?.tenedor ?? 'Tenedor';
  return (
    <div className="space-y-5">
      <Link to="/ventas" className="inline-flex min-h-12 items-center gap-1 text-sm text-gray-600 hover:text-brand-700 md:min-h-0">
        <ArrowLeft size={16} aria-hidden="true" /> Ventas
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Venta de {v.lote?.nombre}</h1>
        <p className="text-sm text-gray-600">
          {formatFecha(v.fecha)}, a {v.comprador}. {pesos(v.precioKg)}/kg con {formatPct(v.destarePct)} de destare.
        </p>
      </div>

      <Card titulo="Resultado real">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Reses vendidas" value={v.animales.length} sub={`${formatKg(Math.round(r.pesoVendible))} pagados`} />
          <Stat label="Ingreso" value={pesos(r.ingreso)} />
          <Stat label="Costo acumulado" value={pesos(r.costo)} />
          <Stat label="Margen neto" value={pesos(r.margenNeto)} tono={tono(r.margenNeto)} sub="Para Santa Rita" />
        </div>
      </Card>

      <Card titulo="Recomendación del sistema frente al resultado">
        {rec ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <RecomendacionBadge recomendacion={rec.recomendacion} />
              <Seguimiento recomendacion={rec} />
            </div>
            <p className="text-sm text-gray-700">{rec.razon}</p>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Margen esperado" value={pesos(rec.margenNeto)} />
              <Stat label="Margen real" value={pesos(r.margenNeto)} tono={tono(r.margenNeto)} sub={rec.margenNeto != null ? `Diferencia: ${pesos(r.margenNeto - rec.margenNeto)}` : undefined} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Esta venta no guardó la recomendación del sistema.</p>
        )}
      </Card>

      <Card titulo="Liquidación de tenedores (Al partir)">
        {r.liquidaciones.length === 0 ? (
          <p className="text-sm text-gray-500">No se vendieron animales de contratos Al partir.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {r.liquidaciones.map((l) => (
              <li key={l.contratoId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-gray-900">
                  <span className="font-medium">
                    {tenedorDe(l.contratoId)}: {cantidad(l.animales, 'res', 'reses')}, ganancia neta {pesos(l.ganancia)}
                  </span>
                  {/* D8 acumulado (DT-04-9): el contrato ya tuvo ventas antes de esta. */}
                  {(l.pagadoAntes > 0 || l.gananciaAcumulada !== l.ganancia) && (
                    <span className="block text-gray-600">
                      Acumulada del contrato {pesos(l.gananciaAcumulada)}; ya se le pagaron {pesos(l.pagadoAntes)}.
                    </span>
                  )}
                  {l.saldoAFavor > 0 && (
                    <span className="block text-peligro">Saldo a favor de Santa Rita: {pesos(l.saldoAFavor)} (se descuenta de las próximas ventas del contrato o se cobra al cerrarlo).</span>
                  )}
                </span>
                <span className="cifra text-base font-bold text-earth-700">Pagar {pesos(l.monto)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card titulo="Animales vendidos">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {v.animales.map((a) => (
            <li key={a.animalId}>
              <Link to={`/animales/${a.animalId}`} className="flex min-h-12 items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
                <Chapeta numero={a.numeroInterno} />
                <span className="cifra font-bold text-gray-900">{formatKg(a.pesoKg)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {v.notas && <p className="mt-3 text-sm text-gray-600">{v.notas}</p>}
      </Card>
    </div>
  );
}
