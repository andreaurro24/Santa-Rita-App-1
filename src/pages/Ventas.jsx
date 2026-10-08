import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, BadgeDollarSign, CheckCircle2, XCircle } from 'lucide-react';
import { useVentas, useRegistrarVenta } from '../data/ventas';
import { useAnalisisLotes, analizarLote } from '../data/analisis';
import { pesoActual, formatCOP } from '../domain/breakeven';
import { costoAcumuladoAnimal } from '../domain/costos';
import { esVientre } from '../domain/animales';
import { precioPorAnimal, rangosVigentes } from '../domain/precios';
import { estadoContratos, resultadoVenta, simularVenta, siguioRecomendacion } from '../domain/decision';
import { ConDatos } from '../components/EstadoCarga';
import RecomendacionBadge from '../components/RecomendacionBadge';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Chapeta from '../components/ui/Chapeta';
import Stat from '../components/ui/Stat';
import EmptyState from '../components/ui/EmptyState';
import { Field, Input, FormError } from '../components/ui/Field';
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
          Simular y registrar venta
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
                        <h2 className="mr-auto text-lg font-bold text-gray-900">{v.titulo}</h2>
                        <Seguimiento recomendacion={v.recomendacion} />
                      </div>
                      <p className="mb-3 text-sm text-gray-600">
                        {formatFecha(v.fecha)}, a {v.comprador}. {cantidad(v.animales.length, 'res', 'reses')} a {pesos(v.precioKg)}/kg
                        {v.gastosVenta ? `, con ${pesos(v.gastosVenta)} de comisiones y transporte` : ''}.
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

// Spec 025 · simulador de venta por lotes y venta de varios lotes. Spec 019 · R1: `?animal=<id>`
// arranca solo con ese animal (R9); `?lote=<id>` con todo ese lote.
export function NuevaVenta() {
  const datos = useAnalisisLotes();
  return <ConDatos queries={datos.queries}>{() => <Simulador datos={datos} />}</ConDatos>;
}

const PASOS = ['Simular', 'Datos de la venta', 'Confirmar'];
const leerNumero = (t) => Number(String(t).replace(',', '.'));

function Simulador({ datos }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const registrar = useRegistrarVenta();
  const animalUnico = params.get('animal');
  const reparto = datos.costos.reparto;

  // R1/R4: lotes abiertos con sus animales vendibles (activos y que no son vientres).
  const lotes = useMemo(() => {
    const abiertos = datos.lotes.data.filter((l) => l.estado === 'activo' || l.estado === 'listo');
    return abiertos
      .map((l) => {
        const suyos = datos.hato.data.animales.filter((a) => a.loteId === l.id && a.estado === 'Activo');
        const vendibles = suyos.filter((a) => !esVientre(a.categoria)).sort((a, b) => a.numeroInterno.localeCompare(b.numeroInterno, 'es', { numeric: true }));
        return { ...l, vendibles, vientres: suyos.length - vendibles.length };
      })
      .filter((l) => l.vendibles.length || l.vientres);
  }, [datos.lotes.data, datos.hato.data]);
  const porId = useMemo(() => new Map(lotes.flatMap((l) => l.vendibles.map((a) => [a.id, a]))), [lotes]);

  // Selección: animalId → peso de venta (texto). Arranca con el animal o el lote de la URL.
  const [seleccion, setSeleccion] = useState(() => {
    const unico = animalUnico && porId.get(animalUnico);
    if (unico) return new Map([[unico.id, numeroParaCampo(pesoActual(unico))]]);
    const lote = lotes.find((l) => l.id === params.get('lote'));
    return new Map((lote?.vendibles ?? []).map((a) => [a.id, numeroParaCampo(pesoActual(a))]));
  });
  const [abiertos, setAbiertos] = useState(() => new Set(animalUnico && porId.get(animalUnico) ? [porId.get(animalUnico).loteId] : []));
  const [paso, setPaso] = useState(0);
  // Verificación Sprint 05 (A1): "Guardar venta" se habilita un momento después de mostrar el
  // resumen, para que un doble toque no guarde sin verlo (spec 019, 025 · R5).
  const [listoParaGuardar, setListoParaGuardar] = useState(false);
  useEffect(() => {
    if (paso !== 2) return undefined;
    const t = setTimeout(() => setListoParaGuardar(true), 800);
    return () => clearTimeout(t);
  }, [paso]);
  function irAPaso(n) {
    setListoParaGuardar(false);
    setError('');
    setPaso(n);
    window.scrollTo?.({ top: 0 });
  }

  const [form, setForm] = useState({
    fecha: hoyISO(),
    comprador: '',
    precioKg: '',
    gastos: '',
    destarePct: numeroParaCampo(datos.parametros.data.destarePct),
    notas: '',
  });
  const set = (c, v) => setForm((f) => ({ ...f, [c]: v }));
  const [error, setError] = useState('');

  const elegidos = [...seleccion.entries()].map(([id, peso]) => ({ animal: porId.get(id), peso })).filter((f) => f.animal);
  const pesoDe = (f) => Math.round((leerNumero(f.peso) || 0) * 10) / 10; // corrección r1 (B7): igual que lo guardado
  const destare = leerNumero(form.destarePct);

  // R3: precio de la zona de cada animal, ponderado por su peso.
  const porAnimal = useMemo(
    () => precioPorAnimal(rangosVigentes(datos.referencia.data), datos.precios.data.precioActual?.precioCOP ?? null),
    [datos.referencia.data, datos.precios.data],
  );
  function precioZona(lista) {
    let total = 0;
    let kilos = 0;
    for (const f of lista) {
      const p = porAnimal(f.animal, pesoDe(f));
      if (!(p > 0)) return null;
      total += p * pesoDe(f);
      kilos += pesoDe(f);
    }
    return kilos > 0 ? Math.round(total / kilos) : null;
  }
  const sugerido = precioZona(elegidos);
  const precio = form.precioKg ? pesosANumero(form.precioKg) : (sugerido ?? 0);
  const gastos = pesosANumero(form.gastos) || 0;

  const filasVenta = elegidos.map((f) => ({
    pesoKg: pesoDe(f),
    costoCop: costoAcumuladoAnimal(f.animal, reparto).total,
    contratoId: f.animal.contratoId,
    porcentajeTenedor: f.animal.porcentajeTenedor,
  }));
  // D8 acumulado (011 R5): cuentan todas las ventas ya registradas, sea cual sea la fecha de esta.
  const r = simularVenta({ animales: filasVenta, precioKg: precio, destarePct: destare || 0, gastosVenta: gastos, previo: estadoContratos(datos.ventas.data) });
  const lotesElegidos = lotes.filter((l) => l.vendibles.some((a) => seleccion.has(a.id)));
  const terneras = elegidos.filter((f) => f.animal.categoria === 'ternera').length;

  function marcarLote(l, marcar) {
    setSeleccion((s) => {
      const m = new Map(s);
      for (const a of l.vendibles) {
        if (marcar) m.set(a.id, m.get(a.id) ?? numeroParaCampo(pesoActual(a)));
        else m.delete(a.id);
      }
      return m;
    });
  }
  function alternarAnimal(a) {
    setSeleccion((s) => {
      const m = new Map(s);
      if (m.has(a.id)) m.delete(a.id);
      else m.set(a.id, numeroParaCampo(pesoActual(a)));
      return m;
    });
  }
  function cambiarPeso(id, valor) {
    setSeleccion((s) => new Map(s).set(id, valor));
  }
  const todos = lotes.length > 0 && lotes.every((l) => l.vendibles.every((a) => seleccion.has(a.id)));

  function validarPaso(n) {
    if (n === 0) {
      if (!elegidos.length) return 'Marca al menos un lote o un animal para vender.';
      if (!(precio > 0)) return 'Escribe el precio de venta por kilo.';
      if (precio > 100_000) return 'Revisa el precio por kilo: parece tener un cero de más.';
    }
    if (n === 1) {
      for (const f of elegidos) {
        const p = Math.round(pesoDe(f) * 10) / 10;
        if (!(p > 0 && p < 1500)) return `El peso de ${f.animal.numeroInterno} debe estar entre 0,1 y 1.499 kg.`;
      }
      const nombre = mensajeNombre(form.comprador, 'el nombre del comprador');
      if (nombre) return nombre;
      if (!(destare >= 0 && destare <= 15)) return 'El destare debe estar entre 0 y 15 %.';
      if (!form.fecha || form.fecha > hoyISO()) return 'La fecha de la venta no puede ser futura.';
    }
    return null;
  }

  function siguiente() {
    const problema = validarPaso(paso);
    if (problema) return setError(problema);
    if (paso === 0 && !form.precioKg && sugerido) set('precioKg', numeroAPesos(sugerido));
    irAPaso(paso + 1);
  }

  // R8 (spec 011 · R4): copia de lo que recomendaba el sistema para los lotes vendidos.
  function recomendacionActual() {
    const analisis = lotesElegidos.map((l) => analizarLote(datos, l.id, precio)?.resultado).filter(Boolean);
    if (!analisis.length) return null;
    const conteo = new Map();
    for (const a of analisis) conteo.set(a.recomendacion, (conteo.get(a.recomendacion) ?? 0) + 1);
    const recomendacion = [...conteo.entries()].sort((x, y) => y[1] - x[1])[0][0];
    return {
      recomendacion,
      razon: analisis.length === 1 ? analisis[0].razones[0] : lotesElegidos.map((l, i) => `${l.nombre}: ${analisis[i]?.razones[0] ?? 'sin datos'}`).join(' · '),
      equilibrioKg: analisis.length === 1 ? (analisis[0].hoy?.equilibrioKg ?? null) : null,
      // Corrección r1/r2 (M2): el margen esperado es el que el sistema calculaba para ESTOS animales
      // con el precio de la zona (y las mismas comisiones). La diferencia con el real muestra cuánto
      // se ganó o se perdió al negociar el precio y con el peso de báscula.
      margenNeto: Math.round(
        simularVenta({ animales: filasVenta, precioKg: sugerido ?? precio, destarePct: destare || 0, gastosVenta: gastos, previo: estadoContratos(datos.ventas.data) }).margenNeto,
      ),
      fecha: hoyISO(),
    };
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (paso < 2) return siguiente();
    if (!listoParaGuardar || registrar.isPending) return;
    const problema = validarPaso(0) || validarPaso(1);
    if (problema) return setError(problema);
    setError('');
    registrar.mutate(
      {
        fecha: form.fecha,
        comprador: form.comprador,
        notas: form.notas,
        precioKg: precio,
        destarePct: destare,
        gastosVenta: gastos,
        recomendacion: recomendacionActual(),
        animales: elegidos.map((f) => ({ animalId: f.animal.id, pesoKg: Math.round(pesoDe(f) * 10) / 10, costoCop: costoAcumuladoAnimal(f.animal, reparto).total })),
      },
      { onSuccess: (id) => navigate(`/ventas/${id}`), onError: (err) => setError(mensajeError(err)) },
    );
  }

  if (!lotes.length) {
    return (
      <div className="space-y-5">
        <h1 className="text-3xl font-bold text-gray-900">Simulador de venta</h1>
        <EmptyState titulo="No hay lotes con animales para vender">Registra animales en un lote; cuando estén listos, véndelos desde aquí o desde su ficha.</EmptyState>
      </div>
    );
  }

  const panel = (
    <PanelVenta
      r={r}
      lotes={lotesElegidos.length}
      precioKg={form.precioKg}
      onPrecio={paso === 0 ? (v) => set('precioKg', v) : null}
      sugerido={sugerido}
      gastos={form.gastos}
      onGastos={paso === 0 ? (v) => set('gastos', v) : null}
      destare={destare}
    />
  );

  return (
    <div className={`space-y-5 ${paso === 0 && elegidos.length ? 'pb-24 xl:pb-0' : ''}`}>
      <Link to="/ventas" className="inline-flex min-h-12 items-center gap-1 text-base text-gray-600 hover:text-brand-700">
        <ArrowLeft size={18} aria-hidden="true" /> Ventas
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Simulador de venta</h1>
        <p className="text-base text-gray-600">Marca los lotes que vas a vender y mira cuánto queda limpio antes de confirmar.</p>
      </div>

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

      <form id="form-venta" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="space-y-4">
          {paso === 0 && (
            <>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                <input type="checkbox" className="size-6 accent-brand-700" checked={todos} onChange={() => lotes.forEach((l) => marcarLote(l, !todos))} aria-label="Seleccionar todos los lotes" />
                <span className="text-base font-semibold text-gray-900">Seleccionar todos ({cantidad(lotes.length, 'lote', 'lotes')})</span>
              </label>
              <ul className="space-y-3">
                {lotes.map((l) => (
                  <TarjetaLoteVenta
                    key={l.id}
                    lote={l}
                    seleccion={seleccion}
                    precio={precio}
                    destare={destare || 0}
                    abierto={abiertos.has(l.id)}
                    onAbrir={() =>
                      setAbiertos((s) => {
                        const n = new Set(s);
                        if (n.has(l.id)) n.delete(l.id);
                        else n.add(l.id);
                        return n;
                      })
                    }
                    onMarcar={(marcar) => marcarLote(l, marcar)}
                    onAnimal={alternarAnimal}
                  />
                ))}
              </ul>
              {terneras > 0 && (
                <p role="status" className="rounded-lg bg-alerta-50 px-3 py-2 text-base text-alerta-900">
                  Incluye {terneras} {terneras === 1 ? 'ternera' : 'terneras'}. Verifica que no tengan potencial reproductivo antes de venderlas.
                </p>
              )}
            </>
          )}

          {paso === 1 && (
            <Card titulo="Datos de la venta">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Comprador" required>
                  <Input value={form.comprador} maxLength={80} onChange={(e) => set('comprador', e.target.value)} />
                </Field>
                <Field label="Fecha de la venta">
                  <Input type="date" value={form.fecha} max={hoyISO()} onChange={(e) => set('fecha', e.target.value)} />
                </Field>
                <Field label="Destare (%)" ayuda="Lo que se descuenta del peso al pesar en la báscula del comprador.">
                  <Input type="text" inputMode="decimal" value={form.destarePct} onChange={(e) => set('destarePct', e.target.value)} />
                </Field>
                <Field label="Notas" ayuda="Opcional">
                  <Input value={form.notas} maxLength={500} onChange={(e) => set('notas', e.target.value)} />
                </Field>
              </div>
              <details className="mt-4 rounded-lg border border-gray-200">
                <summary className="flex min-h-12 cursor-pointer items-center px-3 text-base font-semibold text-brand-800">Pesos de báscula de cada animal (opcional)</summary>
                <ul className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                  {elegidos.map((f) => (
                    <li key={f.animal.id} className="flex items-center gap-3">
                      <Chapeta numero={f.animal.numeroInterno} />
                      <label className="ml-auto w-32">
                        <span className="sr-only">Peso de venta de {f.animal.numeroInterno} (kg)</span>
                        <Input type="text" inputMode="decimal" value={f.peso} onChange={(e) => cambiarPeso(f.animal.id, e.target.value)} className="text-right" />
                      </label>
                      <span className="text-sm text-gray-600">kg</span>
                    </li>
                  ))}
                </ul>
              </details>
            </Card>
          )}

          {paso === 2 && (
            <Card titulo="Confirma la venta">
              <p className="text-base text-gray-800">
                {cantidad(elegidos.length, 'res', 'reses')} de {lotesElegidos.map((l) => l.nombre).join(', ')}, a {form.comprador.trim()}, el {formatFecha(form.fecha)}, a{' '}
                {pesos(precio)}/kg con {formatPct(destare || 0)} de destare{gastos ? ` y ${pesos(gastos)} de comisiones y transporte` : ''}.
              </p>
              {r.liquidaciones.length > 0 && (
                <p className="mt-2 text-base text-gray-700">
                  A los tenedores: {pesos(r.participacion)}
                  {r.liquidaciones.some((l) => l.pagadoAntes > 0 || l.gananciaAcumulada !== l.ganancia) ? ' (con lo acumulado y lo ya pagado del contrato)' : ''}.
                </p>
              )}
            </Card>
          )}
        </div>

        {/* R2: el panel a la derecha (abajo en el celular). Dos columnas solo desde xl (1280 px): con el
            menú lateral de 240 px, por debajo de eso la columna de lotes quedaba de 8 a 264 px y el
            panel tapaba las tarjetas (de 768 a ~1000 px). */}
        <aside className="xl:sticky xl:top-6">{panel}</aside>

        {/* Solo en la columna izquierda: si abarcara las dos, "Confirmar venta" (a la derecha) quedaba
            debajo del panel sticky y en pantallas de portátil (1280x720, 1366x768) no recibía el clic. */}
        <div className="space-y-3 xl:col-start-1">
          <FormError>{error}</FormError>
          <div className="flex flex-wrap justify-between gap-2">
            {paso === 0 ? (
              <Button variante="fantasma" onClick={() => navigate(animalUnico ? `/animales/${animalUnico}` : '/ventas')}>
                Cancelar
              </Button>
            ) : (
              <Button variante="secundario" icono={ArrowLeft} onClick={() => irAPaso(paso - 1)}>
                Atrás
              </Button>
            )}
            {paso < 2 ? (
              <Button key="siguiente" type="submit" icono={paso === 0 ? BadgeDollarSign : undefined} className={paso === 0 && elegidos.length ? 'max-xl:hidden' : ''}>
                {paso === 0 ? 'Confirmar venta' : 'Siguiente'}
              </Button>
            ) : (
              <Button key="guardar" type="submit" icono={BadgeDollarSign} disabled={registrar.isPending || !listoParaGuardar}>
                {registrar.isPending ? 'Guardando…' : 'Guardar venta'}
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* R2: mientras el panel no está a la derecha (por debajo de xl), el beneficio neto queda a la
          vista: en el celular encima del menú inferior; en tableta, al fondo junto al menú lateral. */}
      {paso === 0 && elegidos.length > 0 && (
        <div className="no-print fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-gray-200 bg-white px-4 py-2 shadow-lg md:bottom-0 md:left-60 xl:hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base">
              <span className="block text-sm text-gray-600">Beneficio neto</span>
              <span className={`cifra text-xl font-bold ${r.margenNeto < 0 ? 'text-peligro' : 'text-brand-800'}`}>{pesos(r.margenNeto)}</span>
            </p>
            <Button type="submit" form="form-venta" icono={BadgeDollarSign}>
              Confirmar venta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// R1: tarjeta de un lote en el simulador: casilla, cabezas, peso promedio, ganancia de peso y valor.
function TarjetaLoteVenta({ lote, seleccion, precio, destare, abierto, onAbrir, onMarcar, onAnimal }) {
  const n = lote.vendibles.length;
  const marcados = lote.vendibles.filter((a) => seleccion.has(a.id)).length;
  const pesoProm = n ? lote.vendibles.reduce((s, a) => s + pesoActual(a), 0) / n : null;
  const ganancia = n ? lote.vendibles.reduce((s, a) => s + (pesoActual(a) - (a.pesoIngreso ?? pesoActual(a))), 0) / n : null;
  const valor = lote.vendibles.reduce((s, a) => s + pesoActual(a) * (1 - destare / 100) * precio, 0);
  const casilla = (el) => {
    if (el) el.indeterminate = marcados > 0 && marcados < n;
  };
  return (
    <li className={`rounded-xl border-2 bg-white ${marcados ? 'border-brand-600 bg-brand-50/50' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3 p-4">
        {/* Corrección r1 (M3): el área táctil de la casilla mide 48 px. */}
        <label className="-m-2.5 flex size-12 shrink-0 cursor-pointer items-center justify-center">
          <input
            ref={casilla}
            type="checkbox"
            className="size-7 accent-brand-700"
            checked={n > 0 && marcados === n}
            disabled={!n}
            onChange={() => onMarcar(marcados < n)}
            aria-label={`Vender el lote ${lote.nombre}`}
          />
        </label>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-gray-900">
              {lote.nombre} <span className="text-base font-normal text-gray-600">{cantidad(n, 'cabeza', 'cabezas')}</span>
            </h2>
            <span className="cifra text-lg font-bold text-gray-900">{precio > 0 ? pesos(valor) : '—'}</span>
          </div>
          <p className="flex flex-wrap gap-x-4 text-base text-gray-700">
            <span>
              Peso prom.: <strong className="cifra">{pesoProm != null ? formatKg(Math.round(pesoProm)) : '—'}</strong>
            </span>
            <span>
              Ganancia peso: <strong className="cifra text-ok">{ganancia != null ? `${ganancia >= 0 ? '+' : ''}${formatKg(Math.round(ganancia * 10) / 10)}` : '—'}</strong>
            </span>
          </p>
          {lote.vientres > 0 && <p className="text-sm text-gray-600">{lote.vientres === 1 ? '1 vientre no se vende.' : `${lote.vientres} vientres no se venden.`}</p>}
          {n > 0 && (
            <button type="button" onClick={onAbrir} aria-expanded={abierto} className="inline-flex min-h-12 items-center gap-1 text-base font-semibold text-brand-700">
              {abierto ? 'Ocultar animales' : `Elegir animales (${marcados} de ${n})`}
            </button>
          )}
        </div>
      </div>
      {abierto && (
        <ul className="grid grid-cols-1 gap-2 border-t border-gray-200 p-3 sm:grid-cols-2">
          {lote.vendibles.map((a) => (
            <li key={a.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-gray-50">
                <input type="checkbox" className="size-6 accent-brand-700" checked={seleccion.has(a.id)} onChange={() => onAnimal(a)} aria-label={`Vender ${a.numeroInterno}`} />
                <Chapeta numero={a.numeroInterno} />
                <span className="cifra ml-auto font-semibold text-gray-900">{formatKg(pesoActual(a))}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// R2: el panel del simulador, como en la referencia.
function PanelVenta({ r, lotes, precioKg, onPrecio, sugerido, gastos, onGastos, destare }) {
  const fila = 'flex items-baseline justify-between gap-3 border-b border-gray-100 py-2 text-base';
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <p className="flex flex-wrap items-center gap-2">
        <Badge tono="potrero">{cantidad(lotes, 'lote', 'lotes')}</Badge>
        <span className="text-base text-gray-600">{cantidad(r.cabezas, 'cabeza', 'cabezas')}</span>
      </p>
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">Peso total estimado</p>
        <p className="cifra text-2xl font-bold text-gray-900">{formatKg(Math.round(r.pesoTotal))}</p>
      </div>
      <div className="rounded-lg bg-gray-50 p-3">
        {onPrecio ? (
          <Field label="Precio de venta por kilo">
            <CampoPesos value={precioKg} onChange={onPrecio} placeholder={sugerido ? numeroAPesos(sugerido) : ''} />
          </Field>
        ) : (
          <p className="text-base">
            Precio de venta por kilo: <strong className="cifra">{pesos(pesosANumero(precioKg) || sugerido)}</strong>
          </p>
        )}
        <p className="mt-1 text-sm text-gray-600">{sugerido ? `Precio de la zona: ${pesos(sugerido)}/kg (promedio de los animales).` : 'Sin precio de la zona para estos animales: escríbelo.'}</p>
      </div>
      <dl>
        <div className={fila}>
          <dt className="font-semibold text-gray-900">Valor bruto</dt>
          <dd className="cifra font-bold text-gray-900">{pesos(r.ingreso)}</dd>
        </div>
        {destare > 0 && <p className="pt-1 text-sm text-gray-600">Con {formatPct(destare)} de destare.</p>}
        <div className={fila}>
          <dt className="text-gray-700">Costos operativos (reales)</dt>
          <dd className="cifra text-gray-900">− {pesos(r.costo)}</dd>
        </div>
        <div className={`${fila} flex-wrap`}>
          <dt className="text-gray-700">Comisiones y transporte</dt>
          {onGastos ? (
            <dd className="w-40">
              <CampoPesos value={gastos} onChange={onGastos} aria-label="Comisiones y transporte" placeholder="0" />
            </dd>
          ) : (
            <dd className="cifra text-gray-900">− {pesos(r.gastosVenta)}</dd>
          )}
        </div>
        {r.participacion > 0 && (
          <div className={fila}>
            <dt className="text-gray-700">A los tenedores (Al partir)</dt>
            <dd className="cifra text-gray-900">− {pesos(r.participacion)}</dd>
          </div>
        )}
      </dl>
      <div className={`rounded-xl border p-4 ${r.margenNeto < 0 ? 'border-peligro bg-peligro-50' : 'border-gray-200 bg-gray-50'}`}>
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">Beneficio neto para Santa Rita</p>
        <p data-testid="beneficio-neto" className={`cifra text-3xl font-bold ${r.margenNeto < 0 ? 'text-peligro' : 'text-brand-800'}`}>
          {r.margenNeto > 0 ? '+' : ''}
          {pesos(r.margenNeto)}
        </p>
        <p className="text-sm text-gray-600">{r.margenPct != null ? `${formatPct(Math.round(r.margenPct * 10) / 10)} de margen sobre el valor bruto` : 'Marca animales para ver el margen'}</p>
      </div>
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
        <h1 className="text-3xl font-bold text-gray-900">Venta de {v.titulo}</h1>
        <p className="text-sm text-gray-600">
          {formatFecha(v.fecha)}, a {v.comprador}. {pesos(v.precioKg)}/kg con {formatPct(v.destarePct)} de destare
          {v.gastosVenta ? ` y ${pesos(v.gastosVenta)} de comisiones y transporte` : ''}.
        </p>
      </div>

      <Card titulo="Resultado real">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Stat label="Reses vendidas" value={v.animales.length} sub={`${formatKg(Math.round(r.pesoVendible))} pagados`} />
          <Stat label="Valor bruto" value={pesos(r.ingreso)} />
          <Stat label="Costo acumulado" value={pesos(r.costo)} />
          <Stat label="Comisiones y transporte" value={pesos(r.gastosVenta)} />
          <Stat label="A los tenedores" value={pesos(r.participacion)} />
          <Stat
            label="Margen neto"
            value={pesos(r.margenNeto)}
            tono={tono(r.margenNeto)}
            sub={r.margenPct != null ? `Para Santa Rita, ${formatPct(Math.round(r.margenPct * 10) / 10)} del valor bruto` : 'Para Santa Rita'}
          />
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
        {/* Spec 025 · R8: agrupados por el lote en que estaban. */}
        <div className="space-y-4">
          {v.lotes.map((l) => (
            <div key={l.id}>
              {v.lotes.length > 1 && <h3 className="mb-2 text-base font-semibold text-gray-800">{l.nombre}</h3>}
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(12rem,100%),1fr))] gap-2">
                {v.animales
                  .filter((a) => a.loteId === l.id)
                  .map((a) => (
                    <li key={a.animalId}>
                      <Link to={`/animales/${a.animalId}`} className="flex min-h-12 items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
                        <Chapeta numero={a.numeroInterno} />
                        <span className="cifra ml-auto whitespace-nowrap font-bold text-gray-900">{formatKg(a.pesoKg)}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        {v.notas && <p className="mt-3 text-sm text-gray-600">{v.notas}</p>}
      </Card>
    </div>
  );
}
