"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { fmtCompact, fmtMoney } from "@/lib/format";

export type Serie = { key: string; color: string; label: string };

type Row = Record<string, string | number>;

const gradId = (key: string) => `barra-${key.replace(/\W/g, "")}`;

function ChartTooltip({
  active,
  payload,
  label,
  money = true,
  colores,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string;
  money?: boolean;
  /** Color real por serie: el `color` del payload trae el url() del degradado SVG, que no sirve como CSS. */
  colores?: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3.5 py-2.5 text-[12.5px]"
      // Fijo oscuro en ambos temas: sobre el fondo claro un tooltip oscuro
      // sigue siendo lo más legible y no depende de las variables del tema.
      style={{
        background: "#1f1a12",
        border: "1px solid #2a251c",
        boxShadow: "0 10px 28px rgba(0,0,0,0.5)",
        color: "#f2ecdd",
      }}
    >
      <div className="font-semibold mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <i
            className="w-2 h-2 rounded-full inline-block shrink-0"
            style={{ background: colores?.[p.name ?? ""] ?? p.color }}
          />
          <span style={{ color: "#8f8674" }}>{p.name}:</span>{" "}
          <span className="font-semibold tnum">
            {money ? fmtMoney(Number(p.value)) : Number(p.value).toLocaleString("es-MX")}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Barras verticales, 1 o 2 series (hue = sucursal, fijo), con relleno degradado. */
export function Bars({
  data,
  xKey,
  series,
  height = 260,
  tickEvery = 1,
  money = true,
  zeroLine = false,
}: {
  data: Row[];
  xKey: string;
  series: Serie[];
  height?: number;
  tickEvery?: number;
  money?: boolean;
  zeroLine?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, left: 4, bottom: 0 }} barGap={3}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={gradId(s.key)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={1} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.4} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 6" />
        {/* Densidad adaptable: Recharts omite etiquetas si no caben (móvil);
            tickEvery expresa la densidad deseada cuando hay espacio. */}
        <XAxis
          dataKey={xKey}
          interval="equidistantPreserveStart"
          minTickGap={tickEvery > 1 ? 22 : 10}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          dy={4}
        />
        <YAxis
          tickFormatter={(v: number) => (money ? fmtCompact(v) : v.toLocaleString("es-MX"))}
          tickLine={false}
          axisLine={false}
          width={54}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: "var(--rail)", radius: 6 }}
          content={
            <ChartTooltip
              money={money}
              colores={Object.fromEntries(series.map((s) => [s.label, s.color]))}
            />
          }
        />
        {zeroLine && <ReferenceLine y={0} stroke="var(--muted)" />}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={`url(#${gradId(s.key)})`}
            maxBarSize={24}
            radius={[6, 6, 0, 0]}
            animationDuration={650}
            animationEasing="ease-out"
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barras horizontales sobre riel, con etiqueta de valor al final (categorías, pagos). */
export function HBars({
  data,
  color = "var(--accent)",
  money = true,
}: {
  data: { name: string; value: number; extra?: string }[];
  color?: string;
  money?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="grid gap-2.5">
      {data.map((d) => (
        <div key={d.name} className="grid grid-cols-[92px_1fr] sm:grid-cols-[130px_1fr] items-center gap-3">
          <div
            className="text-[12.5px] text-right truncate"
            style={{ color: "var(--ink-2)" }}
            title={d.name}
          >
            {d.name}
          </div>
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="relative flex-1 h-[16px] rounded-full overflow-hidden"
              style={{ background: "var(--rail)" }}
            >
              <div
                className="hbar-fill absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.max((d.value / max) * 100, 1.5)}%`,
                  background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})`,
                  minWidth: 5,
                }}
              />
            </div>
            <span className="text-[12px] font-semibold whitespace-nowrap tnum">
              {money ? fmtCompact(d.value) : d.value.toLocaleString("es-MX")}
              {d.extra && (
                <span className="font-normal" style={{ color: "var(--muted)" }}>
                  {" "}
                  · {d.extra}
                </span>
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
