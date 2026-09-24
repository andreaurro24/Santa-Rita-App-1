import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatFecha } from '../utils/format';
import { formatCOP } from '../utils/breakeven';

// Serie única (precio del kilo en pie): hue categórico slot 1 (azul) de la paleta de
// referencia, distinto del verde usado para peso, para que ambos gráficos nunca se
// confundan si aparecen juntos en el mismo panel.
const LINE_COLOR = '#2a78d6';
const GRID_COLOR = '#e1e0d9';
const AXIS_COLOR = '#898781';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-gray-700">{formatFecha(label)}</p>
      <p className="text-gray-600">${formatCOP(payload[0].value)} COP/kg</p>
    </div>
  );
}

export default function PriceChart({ precios, height = 220 }) {
  const data = [...precios].sort((a, b) => a.fecha.localeCompare(b.fecha));

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
          width={64}
          allowDecimals={false}
          domain={[(min) => Math.floor((min - 100) / 50) * 50, (max) => Math.ceil((max + 100) / 50) * 50]}
          tickFormatter={(v) => formatCOP(v)}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="precioCOP"
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
