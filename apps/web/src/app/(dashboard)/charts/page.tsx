"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import type { Metadata } from "next";

// ─── Data ──────────────────────────────────────────────────────────────────────

const ALL_DATA = [
  { month: "Jan '25", mrr: 5200, arr: 62400 },
  { month: "Feb '25", mrr: 5800, arr: 69600 },
  { month: "Mar '25", mrr: 6100, arr: 73200 },
  { month: "Apr '25", mrr: 6900, arr: 82800 },
  { month: "May '25", mrr: 7400, arr: 88800 },
  { month: "Jun '25", mrr: 7800, arr: 93600 },
  { month: "Jul '25", mrr: 8600, arr: 103200 },
  { month: "Aug '25", mrr: 9100, arr: 109200 },
  { month: "Sep '25", mrr: 9700, arr: 116400 },
  { month: "Oct '25", mrr: 10400, arr: 124800 },
  { month: "Nov '25", mrr: 11200, arr: 134400 },
  { month: "Dec '25", mrr: 12450, arr: 149400 },
];

function getDataForPeriod(period: "1M" | "3M" | "6M" | "1Y") {
  const slices = { "1M": 2, "3M": 4, "6M": 7, "1Y": 12 };
  return ALL_DATA.slice(-slices[period]);
}

function fmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function MRRTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2128] border border-[#30363d] rounded-lg px-3 py-2 shadow-xl text-sm">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-blue-400 font-semibold">{fmt(payload[0]?.value ?? 0)}</p>
    </div>
  );
}

function ARRTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2128] border border-[#30363d] rounded-lg px-3 py-2 shadow-xl text-sm">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-indigo-400 font-semibold">{fmt(payload[0]?.value ?? 0)}</p>
    </div>
  );
}

// ─── Chart Card ───────────────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative";
  dataKey: "mrr" | "arr";
  gradientId: string;
  color: string;
  data: typeof ALL_DATA;
  tooltipComponent: React.FC<TooltipProps<number, string>>;
}

function ChartCard({
  title,
  value,
  change,
  changeType,
  dataKey,
  gradientId,
  color,
  data,
  tooltipComponent: TooltipComp,
}: ChartCardProps) {
  return (
    <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        </div>
        <span
          className={`text-sm font-medium px-2 py-0.5 rounded-full ${
            changeType === "positive"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {changeType === "positive" ? "↑" : "↓"} {change}
        </span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmt(v)}
            />
            <Tooltip content={<TooltipComp />} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "3 3" }} />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Quick Stat ───────────────────────────────────────────────────────────────

function QuickStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </div>
  );
}

// ─── Period Button ────────────────────────────────────────────────────────────

type Period = "1M" | "3M" | "6M" | "1Y";

function PeriodBtn({
  label,
  active,
  onClick,
}: {
  label: Period;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
        active
          ? "bg-blue-600 text-white"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChartsPage() {
  const [period, setPeriod] = useState<Period>("1Y");
  const data = getDataForPeriod(period);

  // Use last data point for headline values
  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const mrrChange =
    prev ? (((latest.mrr - prev.mrr) / prev.mrr) * 100).toFixed(1) + "%" : "—";
  const arrChange =
    prev ? (((latest.arr - prev.arr) / prev.arr) * 100).toFixed(1) + "%" : "—";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Revenue Charts</h1>
          <p className="text-gray-400 text-sm">MRR and ARR trends over time.</p>
        </div>
        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-[#1c2128] border border-[#30363d] rounded-xl p-1">
          {(["1M", "3M", "6M", "1Y"] as Period[]).map((p) => (
            <PeriodBtn key={p} label={p} active={period === p} onClick={() => setPeriod(p)} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Charts (3/4 width) */}
        <div className="xl:col-span-3 space-y-4">
          <ChartCard
            title="Monthly Recurring Revenue"
            value={`$${latest.mrr.toLocaleString()}`}
            change={mrrChange}
            changeType="positive"
            dataKey="mrr"
            gradientId="mrrGradient"
            color="#3b82f6"
            data={data}
            tooltipComponent={MRRTooltip}
          />
          <ChartCard
            title="Annual Recurring Revenue"
            value={`$${latest.arr.toLocaleString()}`}
            change={arrChange}
            changeType="positive"
            dataKey="arr"
            gradientId="arrGradient"
            color="#818cf8"
            data={data}
            tooltipComponent={ARRTooltip}
          />
        </div>

        {/* Quick Stats (1/4 width) */}
        <div className="xl:col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-1">
            Snapshot
          </h3>
          <QuickStat label="MoM Growth" value="+11.2%" sub="vs last month" />
          <QuickStat label="Net Churn" value="1.2%" sub="monthly rate" />
          <QuickStat label="LTV" value="$450" sub="avg lifetime value" />
          <QuickStat label="ARPU" value="$36.26" sub="avg rev per user" />
          <QuickStat label="NRR" value="108%" sub="net revenue retention" />

          {/* Trend indicator */}
          <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Trend</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-sm text-emerald-400 font-medium">Growing</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              12 consecutive months of positive MRR growth
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
