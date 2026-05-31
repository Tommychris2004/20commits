import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface BarChartProps {
  data: Array<{ date: string; value: number; [key: string]: unknown }>;
  valueKey?: string;
  color?: string;
  unit?: string;
  formatValue?: (v: number) => string;
  height?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit: string;
  formatValue: (v: number) => string;
}

function CustomTooltip({ active, payload, label, unit, formatValue }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <p className="text-text-secondary mb-0.5">{label}</p>
      <p className="font-bold text-brand-gold">
        {formatValue(payload[0].value)} {unit}
      </p>
    </div>
  );
}

export function WeeklyBarChart({
  data,
  color = '#F1C40F',
  unit = '₦',
  formatValue = (v) => v.toLocaleString('en-NG'),
  height = 160,
}: BarChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: (() => {
      try {
        return format(parseISO(d.date), 'EEE');
      } catch {
        return d.date;
      }
    })(),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#5A5A5A', fontSize: 11 }}
        />
        <YAxis hide />
        <Tooltip
          content={<CustomTooltip unit={unit} formatValue={formatValue} />}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <Bar
          dataKey="value"
          fill={color}
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
          opacity={0.9}
        />
      </ReBarChart>
    </ResponsiveContainer>
  );
}

interface HourlyChartProps {
  data: Array<{ hour: number; total_kwh: number; is_peak: boolean }>;
  height?: number;
}

export function HourlyChart({ data, height = 120 }: HourlyChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: d.hour === 0 ? '12am' : d.hour === 12 ? '12pm' : d.hour < 12 ? `${d.hour}am` : `${d.hour - 12}pm`,
    value: d.total_kwh,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#5A5A5A', fontSize: 10 }}
          interval={3}
        />
        <YAxis hide />
        <Tooltip
          content={
            <CustomTooltip
              unit="kWh"
              formatValue={(v) => v.toFixed(2)}
            />
          }
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <ReferenceLine
          y={Math.max(...data.map((d) => d.total_kwh))}
          stroke="rgba(241,196,15,0.3)"
          strokeDasharray="3 3"
        />
        <Bar
          dataKey="value"
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
          fill="#6E1A1A"
          className="transition-all"
        />
      </ReBarChart>
    </ResponsiveContainer>
  );
}
