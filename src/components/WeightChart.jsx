import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { formatFecha } from '../utils/format';

// Serie única (peso de un animal en el tiempo): un solo hue validado (verde, slot
// categórico 6 de la paleta de referencia), meta pactada como línea de referencia
// punteada en gris muted — evita necesitar un segundo color categórico para "meta".
const LINE_COLOR = '#008300';
const GRID_COLOR = '#e1e0d9';
const AXIS_COLOR = '#898781';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-gray-700">{formatFecha(label)}</p>
      <p className="text-gray-600">{payload[0].value} kg</p>
    </div>
  );
}

export default function WeightChart({ pesos, pesoObjetivo, height = 220 }) {
  const data = [...pesos].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="fecha"
          tickFormatter={(v) => formatFecha(v)}
          tick={{ fontSize: 11, fill: AXIS_COLOR }}
          axisLine={{ stroke: GRID_COLOR }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: AXIS_COLOR }}
          axisLine={false}
          tickLine={false}
          width={56}
          allowDecimals={false}
          domain={[(min) => Math.floor((min - 10) / 10) * 10, (max) => Math.ceil((max + 20) / 10) * 10]}
        />
        <Tooltip content={<CustomTooltip />} />
        {pesoObjetivo && (
          <ReferenceLine
            y={pesoObjetivo}
            stroke="#c3c2b7"
            strokeDasharray="4 4"
            label={{ value: `Meta ${pesoObjetivo} kg`, position: 'insideTopRight', fontSize: 11, fill: '#898781' }}
          />
        )}
        <Line
          type="monotone"
          dataKey="pesoKg"
          stroke={LINE_COLOR}
          strokeWidth={2}
          dot={{ r: 3, fill: LINE_COLOR, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
