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
import { ordenarPesajes } from '../domain/breakeven';
import { COLOR } from '../styles/tokens';

// Serie única (peso de un animal en el tiempo) en verde potrero; la meta pactada va como
// línea punteada suave, así no hace falta un segundo color para distinguirla.
const LINE_COLOR = COLOR.potrero;
const GRID_COLOR = COLOR.linea;
const AXIS_COLOR = COLOR.eje;

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
  const data = ordenarPesajes(pesos);

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
            stroke={COLOR.meta}
            strokeDasharray="4 4"
            label={{ value: `Meta ${pesoObjetivo} kg`, position: 'insideTopRight', fontSize: 11, fill: AXIS_COLOR }}
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
