"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact } from "@/lib/utils";
import { ACCENT, AXIS, GRID, SERIES } from "@/components/charts/palette";
import { ChartTooltip, shortDate } from "@/components/charts/chart-tooltip";

type Point = { date: string; total: number; active: number; shares: number };

/** Total vs. active listeners (same unit, one axis). */
export function ListenerGrowthChart({ data, height = 280 }: { data: Point[]; height?: number }) {
  const names: Record<string, string> = { total: "Total listeners", active: "Active listeners" };
  return (
    <div>
      <ul className="mb-3 flex gap-4 text-xs text-muted" aria-label="Legend">
        <li className="flex items-center gap-1.5"><span className="h-[3px] w-3.5 rounded-full" style={{ background: SERIES[0] }} />Total listeners</li>
        <li className="flex items-center gap-1.5"><span className="h-[3px] w-3.5 rounded-full" style={{ background: SERIES[2] }} />Active listeners (daily)</li>
      </ul>
      <div style={{ height }} role="img" aria-label="Listener growth over time">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="g-total" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.25} />
                <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} stroke={AXIS} tickLine={false} axisLine={false} fontSize={11} minTickGap={28} />
            <YAxis tickFormatter={(v) => formatCompact(v)} stroke={AXIS} tickLine={false} axisLine={false} fontSize={11} width={48} />
            <Tooltip cursor={{ stroke: "#3a3a44" }} content={<ChartTooltip labelFormatter={shortDate} nameFor={(k) => names[k] ?? k} />} />
            <Area type="monotone" dataKey="total" stroke={SERIES[0]} strokeWidth={2} fill="url(#g-total)" isAnimationActive={false} />
            <Area type="monotone" dataKey="active" stroke={SERIES[2]} strokeWidth={2} fill="transparent" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Songs shared per day. */
export function SharesChart({ data, height = 200 }: { data: Point[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Songs shared per day">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barCategoryGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} stroke={AXIS} tickLine={false} axisLine={false} fontSize={11} minTickGap={28} />
          <YAxis tickFormatter={(v) => formatCompact(v)} stroke={AXIS} tickLine={false} axisLine={false} fontSize={11} width={48} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip labelFormatter={shortDate} nameFor={() => "Shares"} />} />
          <Bar dataKey="shares" fill={ACCENT} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series listener sparkline/area for a song page. */
export function SongListenersChart({ data, height = 220 }: { data: { date: string; listeners: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Daily listeners">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="g-song" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} stroke={AXIS} tickLine={false} axisLine={false} fontSize={11} minTickGap={28} />
          <YAxis tickFormatter={(v) => formatCompact(v)} stroke={AXIS} tickLine={false} axisLine={false} fontSize={11} width={48} />
          <Tooltip cursor={{ stroke: "#3a3a44" }} content={<ChartTooltip labelFormatter={shortDate} nameFor={() => "Listeners"} />} />
          <Area type="monotone" dataKey="listeners" stroke={ACCENT} strokeWidth={2} fill="url(#g-song)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
