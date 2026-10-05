import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import { useHato } from '../data/hato';
import { useLotes } from '../data/lotes';
import { useVentas } from '../data/ventas';
import { usePrecios, usePreciosReferencia } from '../data/precios';
import { useCondicionPasto } from '../data/pasto';
import { rangosVigentes } from '../domain/precios';
import { calcularKpis, LINEA_BASE } from '../domain/kpis';
import { diasEntre } from '../domain/gdp';
import { ConDatos } from '../components/EstadoCarga';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { formatFecha, hoyISO, formatPct, cantidad } from '../utils/format';

// Spec 012 · R1: los KPI del proyecto calculados con los datos reales, frente a la línea base.
export default function Indicadores() {
  const hato = useHato();
  const lotes = useLotes();
  const ventas = useVentas();
  const precios = usePrecios();
  const referencia = usePreciosReferencia();
  const pasto = useCondicionPasto();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Indicadores del proyecto</h1>
        <p className="text-sm text-gray-500">Las metas del proyecto frente al punto de partida (AS-IS), calculadas con los datos de la finca.</p>
      </div>
      <ConDatos queries={[hato, lotes, ventas, precios, referencia, pasto]}>
        {() => {
          const hoy = hoyISO();
          const precio = precios.data.precioActual;
          const fuentes = [
            { nombre: 'Precio del kilo en pie', activa: Boolean(precio && diasEntre(precio.fecha, hoy) <= 45), detalle: precio ? `boletín del ${formatFecha(precio.fecha)}` : 'sin registrar' },
            // Spec 015 · R1: sin clima ni TRM; spec 021: precios de la zona por categoría.
            (() => {
              const gordo = rangosVigentes(referencia.data).get('gordo');
              return { nombre: 'Precios de la zona por categoría', activa: Boolean(gordo && diasEntre(gordo.fecha, hoy) <= 45), detalle: gordo ? `actualizados el ${formatFecha(gordo.fecha)}` : 'sin registrar' };
            })(),
            (() => {
              const ultimo = [...pasto.data].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
              return { nombre: 'Estado del pasto', activa: Boolean(ultimo && diasEntre(ultimo.fecha, hoy) <= 30), detalle: ultimo ? `registrado el ${formatFecha(ultimo.fecha)}` : 'sin registrar' };
            })(),
          ];
          const k = calcularKpis({ animales: hato.data.animales, lotes: lotes.data, ventas: ventas.data, hoy, fuentes });
          const filas = [
            { kpi: 'Hato con registro digital individual', base: LINEA_BASE.registroDigital, hoy: `${formatPct(k.registroDigitalPct ?? 0)} de ${cantidad(k.activos, 'res activa', 'reses activas')}`, cumple: k.registroDigitalPct === 100 },
            { kpi: 'Historial de peso consolidado (2 o más pesajes)', base: LINEA_BASE.historialPeso, hoy: `${formatPct(k.historialPesoPct ?? 0)} (${cantidad(k.conHistorial, 'res', 'reses')})`, cumple: k.historialPesoPct >= 90 },
            { kpi: 'Fuentes externas en la decisión de venta', base: LINEA_BASE.fuentes, hoy: `${k.fuentesActivas} de 3 activas`, cumple: k.fuentesActivas >= 2 },
            {
              kpi: 'Reporte del sistema usado en una venta real',
              base: LINEA_BASE.ventasConReporte,
              hoy: k.ventasConRecomendacion ? `${cantidad(k.ventasConRecomendacion, 'venta', 'ventas')} con recomendación; ${k.ventasQueSiguieron} la ${k.ventasQueSiguieron === 1 ? 'siguió' : 'siguieron'}` : 'Sin ventas registradas todavía',
              cumple: k.ventasConRecomendacion > 0,
            },
          ];
          return (
            <>
              <Card titulo="Metas frente a la línea base" icono={Target}>
                <dl className="divide-y divide-gray-100">
                  {filas.map((f) => (
                    <div key={f.kpi} className="grid gap-1 py-3 md:grid-cols-[2fr_2fr_2fr_auto] md:items-center md:gap-4">
                      <dt className="font-medium text-gray-900">{f.kpi}</dt>
                      <dd className="text-sm text-gray-500">Antes: {f.base}</dd>
                      <dd className="text-sm font-semibold text-gray-900">Hoy: {f.hoy}</dd>
                      <dd>{f.cumple ? <Badge tono="ok">Cumple</Badge> : <Badge tono="alerta">En progreso</Badge>}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <Card titulo="Tiempo desde el último pesaje por lote">
                <p className="mb-3 text-sm text-gray-600">Antes: {LINEA_BASE.diasEstadoLote}. Hoy el estado se consulta al instante; esto muestra qué tan fresco es.</p>
                <ul className="divide-y divide-gray-100">
                  {k.porLote.map((l) => (
                    <li key={l.id} className="flex min-h-12 flex-wrap items-center justify-between gap-2 text-sm">
                      <Link to={`/lotes/${l.id}`} className="font-medium text-gray-900 hover:text-brand-700">
                        {l.nombre}
                      </Link>
                      <span className={l.dias != null && l.dias > 35 ? 'font-semibold text-brasa' : 'text-gray-700'}>
                        {l.ultimoPesaje ? `hace ${l.dias} días (${formatFecha(l.ultimoPesaje)})` : 'sin pesajes'}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card titulo="Fuentes externas">
                <ul className="divide-y divide-gray-100">
                  {fuentes.map((f) => (
                    <li key={f.nombre} className="flex min-h-12 items-center justify-between gap-2 text-sm">
                      <span className="text-gray-900">{f.nombre}</span>
                      {f.activa ? <Badge tono="ok">{f.detalle}</Badge> : <Badge tono="alerta">{f.detalle}</Badge>}
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          );
        }}
      </ConDatos>
    </div>
  );
}
