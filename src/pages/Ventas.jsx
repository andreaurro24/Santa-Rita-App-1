import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, BadgeDollarSign, CheckCircle2, XCircle } from 'lucide-react';
import { useVentas, useRegistrarVenta } from '../data/ventas';
import { useAnalisisLotes, useAnalisisLote } from '../data/analisis';
import { pesoActual, formatCOP } from '../domain/breakeven';
import { costoAcumuladoAnimal } from '../domain/costos';
import { HEMBRAS_REPRODUCTIVAS } from '../domain/lotes';
import { resultadoVenta, siguioRecomendacion } from '../domain/decision';
import { ConDatos } from '../components/EstadoCarga';
import RecomendacionBadge from '../components/RecomendacionBadge';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Chapeta from '../components/ui/Chapeta';
import Stat from '../components/ui/Stat';
import EmptyState from '../components/ui/EmptyState';
import { Field, Input, Select, FormError } from '../components/ui/Field';
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
                const r = resultadoVenta(v.animales, v);
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

function NuevaVentaContenido({ datos }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const registrar = useRegistrarVenta();
  const lotes = datos.lotes.data.filter((l) => l.estado === 'activo' || l.estado === 'listo');
  const [loteId, setLoteId] = useState(params.get('lote') ?? lotes[0]?.id ?? '');
  const [form, setForm] = useState({
    fecha: hoyISO(),
    comprador: '',
    precioKg: String(datos.precios.data.precioActual?.precioCOP ?? ''),
    destarePct: numeroParaCampo(datos.parametros.data.destarePct),
    notas: '',
  });
  const set = (c, v) => setForm((f) => ({ ...f, [c]: v }));
  const analisis = useAnalisisLote(datos, loteId, form.precioKg);

  const animalesLote = useMemo(() => datos.hato.data.animales.filter((a) => a.loteId === loteId), [datos.hato.data, loteId]);
  const vendibles = animalesLote
    .filter((a) => a.estado === 'Activo' && a.categoria !== 'vientre') // R2 / D2
    .sort((a, b) => a.numeroInterno.localeCompare(b.numeroInterno));
  const vientres = animalesLote.filter((a) => a.estado === 'Activo' && a.categoria === 'vientre').length;

  const [seleccion, setSeleccion] = useState(null); // Map animalId → peso (texto); null = todos con su peso actual
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
  const precio = Number(form.precioKg);
  const destare = Number(String(form.destarePct).replace(',', '.'));
  const vista = resultadoVenta(
    incluidos.map((f) => ({
      pesoKg: Number(String(f.peso).replace(',', '.')) || 0,
      costoCop: costoAcumuladoAnimal(f.animal, datos.costos.reparto).total,
      contratoId: f.animal.contratoId,
      porcentajeTenedor: f.animal.porcentajeTenedor,
    })),
    { precioKg: precio || 0, destarePct: destare || 0 },
  );
  const terneras = incluidos.filter((f) => HEMBRAS_REPRODUCTIVAS.includes(f.animal.categoria)).length;

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.comprador.trim()) return setError('Escribe el nombre del comprador.');
    if (!Number.isInteger(precio) || precio <= 0) return setError('El precio por kilo debe ser un número entero mayor que cero.');
    if (!(destare >= 0 && destare <= 15)) return setError('El destare debe estar entre 0 y 15 %.');
    if (!form.fecha || form.fecha > hoyISO()) return setError('La fecha de la venta no puede ser futura.');
    if (!incluidos.length) return setError('Selecciona al menos un animal.');
    const animales = [];
    for (const f of incluidos) {
      const p = Math.round(Number(String(f.peso).replace(',', '.')) * 10) / 10;
      if (!(p > 0 && p < 1500)) return setError(`El peso de ${f.animal.numeroInterno} debe estar entre 0,1 y 1.499 kg.`);
      animales.push({ animalId: f.animal.id, pesoKg: p, costoCop: costoAcumuladoAnimal(f.animal, datos.costos.reparto).total });
    }
    setError('');
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
      <Link to="/ventas" className="inline-flex min-h-12 items-center gap-1 text-sm text-gray-600 hover:text-brand-700 md:min-h-0">
        <ArrowLeft size={16} aria-hidden="true" /> Ventas
      </Link>
      <h1 className="text-3xl font-bold text-gray-900">Registrar venta</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Lote" className="md:col-span-3">
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
            <Field label="Comprador" required>
              <Input value={form.comprador} onChange={(e) => set('comprador', e.target.value)} />
            </Field>
            <Field label="Precio por kilo (COP)" required>
              <Input type="text" inputMode="numeric" value={form.precioKg} onChange={(e) => set('precioKg', e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Destare (%)">
              <Input type="text" inputMode="decimal" value={form.destarePct} onChange={(e) => set('destarePct', e.target.value)} />
            </Field>
            <Field label="Fecha de la venta">
              <Input type="date" value={form.fecha} max={hoyISO()} onChange={(e) => set('fecha', e.target.value)} />
            </Field>
            <Field label="Notas" className="md:col-span-2">
              <Input value={form.notas} onChange={(e) => set('notas', e.target.value)} />
            </Field>
          </div>
        </Card>

        {analisis?.resultado && (
          <Card titulo="Lo que recomienda el sistema hoy">
            <div className="flex flex-wrap items-center gap-3">
              <RecomendacionBadge recomendacion={analisis.resultado.recomendacion} />
              <p className="text-sm text-gray-700">{analisis.resultado.razones[0]}</p>
            </div>
          </Card>
        )}

        <Card titulo={`Animales (${incluidos.length} de ${vendibles.length})`}>
          {vientres > 0 && <p className="mb-2 text-sm text-gray-600">{vientres === 1 ? '1 vientre no aparece: no se vende.' : `${vientres} vientres no aparecen: no se venden.`}</p>}
          {terneras > 0 && (
            <p role="status" className="mb-2 rounded-lg bg-alerta-50 px-3 py-2 text-sm text-alerta-900">
              Incluye {terneras} {terneras === 1 ? 'ternera' : 'terneras'}. Verifica que no tengan potencial reproductivo antes de venderlas.
            </p>
          )}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filas.map((f) => (
              <li key={f.animal.id} className="flex min-h-12 items-center gap-2 rounded-lg border border-gray-200 px-2 py-1">
                <input type="checkbox" className="size-5 accent-brand-700" checked={f.incluido} onChange={() => alternar(f.animal)} aria-label={`Vender ${f.animal.numeroInterno}`} />
                <Chapeta numero={f.animal.numeroInterno} />
                <label className="ml-auto w-28">
                  <span className="sr-only">Peso de venta de {f.animal.numeroInterno} (kg)</span>
                  <Input type="text" inputMode="decimal" value={f.peso} disabled={!f.incluido} onChange={(e) => cambiarPeso(f.animal, e.target.value)} className="text-right" />
                </label>
              </li>
            ))}
          </ul>
        </Card>

        <Card titulo="Resultado de esta venta">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Ingreso" value={pesos(vista.ingreso)} />
            <Stat label="Costo acumulado" value={pesos(vista.costo)} />
            <Stat label="A los tenedores" value={pesos(vista.participacion)} />
            <Stat label="Margen neto" value={pesos(vista.margenNeto)} tono={tono(vista.margenNeto)} />
          </div>
        </Card>

        <FormError>{error}</FormError>
        <div className="flex justify-end gap-2">
          <Button variante="fantasma" onClick={() => navigate('/ventas')}>
            Cancelar
          </Button>
          <Button type="submit" icono={BadgeDollarSign} disabled={registrar.isPending}>
            {registrar.isPending ? 'Guardando…' : 'Guardar venta'}
          </Button>
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
          <DetalleVenta venta={v} />
        ) : (
          <EmptyState titulo="Esa venta no existe" accion={<Link to="/ventas" className="font-medium text-brand-700">Ver ventas</Link>} />
        );
      }}
    </ConDatos>
  );
}

function DetalleVenta({ venta: v }) {
  const r = resultadoVenta(v.animales, v);
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
                <span className="font-medium text-gray-900">
                  {tenedorDe(l.contratoId)}: {cantidad(l.animales, 'res', 'reses')}, ganancia neta {pesos(l.ganancia)}
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
