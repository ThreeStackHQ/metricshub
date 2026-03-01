"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  type TooltipProps,
} from "recharts";

// ─── Data ──────────────────────────────────────────────────────────────────────

const subscriberData = [
  { month: "Jan", newSubs: 38, churnedSubs: 5 },
  { month: "Feb", newSubs: 42, churnedSubs: 6 },
  { month: "Mar", newSubs: 35, churnedSubs: 4 },
  { month: "Apr", newSubs: 51, churnedSubs: 7 },
  { month: "May", newSubs: 48, churnedSubs: 8 },
  { month: "Jun", newSubs: 44, churnedSubs: 6 },
  { month: "Jul", newSubs: 56, churnedSubs: 9 },
  { month: "Aug", newSubs: 53, churnedSubs: 7 },
  { month: "Sep", newSubs: 60, churnedSubs: 8 },
  { month: "Oct", newSubs: 65, churnedSubs: 10 },
  { month: "Nov", newSubs: 58, churnedSubs: 7 },
  { month: "Dec", newSubs: 47, churnedSubs: 8 },
];

const churnRateData = [
  { month: "Jan", rate: 3.1 },
  { month: "Feb", rate: 3.4 },
  { month: "Mar", rate: 2.9 },
  { month: "Apr", rate: 3.2 },
  { month: "May", rate: 3.6 },
  { month: "Jun", rate: 2.8 },
  { month: "Jul", rate: 3.0 },
  { month: "Aug", rate: 2.5 },
  { month: "Sep", rate: 2.4 },
  { month: "Oct", rate: 2.3 },
  { month: "Nov", rate: 2.2 },
  { month: "Dec", rate: 2.1 },
];

// Cohort retention (% staying per month)
const cohortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const cohortData = [
  { cohort: "Jul '25", m1: 100, m2: 96, m3: 93, m4: 91, m5: 89, m6: 87 },
  { cohort: "Aug '25", m1: 100, m2: 97, m3: 94, m4: 92, m5: 90, m6: null },
  { cohort: "Sep '25", m1: 100, m2: 96, m3: 93, m4: 91, m5: null, m6: null },
  { cohort: "Oct '25", m1: 100, m2: 97, m3: 95, m4: null, m5: null, m6: null },
  { cohort: "Nov '25", m1: 100, m2: 98, m3: null, m4: null, m5: null, m6: null },
  { cohort: "Dec '25", m1: 100, m2: null, m3: null, m4: null, m5: null, m6: null },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-5">
      <p className="text-sm text-gray-400 mb-2">{label}</p>
      <p
        className={`text-2xl font-bold tracking-tight ${
          positive === undefined
            ? "text-white"
            : positive
              ? "text-emerald-400"
              : "text-red-400"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function SubsTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2128] border border-[#30363d] rounded-lg px-3 py-2 shadow-xl text-sm">
      <p className="text-gray-400 mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-semibold" style={{ color: p.color }}>
          {p.dataKey === "newSubs" ? "New: " : "Churned: "}
          {p.value}
        </p>
      ))}
    </div>
  );
}

function ChurnTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2128] border border-[#30363d] rounded-lg px-3 py-2 shadow-xl text-sm">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-orange-400 font-semibold">{payload[0]?.value}% churn</p>
    </div>
  );
}

// ─── Heatmap Cell ─────────────────────────────────────────────────────────────

function HeatCell({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <td className="px-3 py-2 text-center text-gray-600 text-xs bg-[#161b22]">—</td>
    );
  }
  const opacity = value / 100;
  return (
    <td
      className="px-3 py-2 text-center text-xs font-medium"
      style={{
        background: `rgba(59, 130, 246, ${opacity * 0.35})`,
        color: value > 90 ? "#93c5fd" : value > 85 ? "#60a5fa" : "#3b82f6",
      }}
    >
      {value}%
    </td>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GrowthPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Growth & Churn</h1>
        <p className="text-gray-400 text-sm">
          Subscriber acquisition, cancellations, and cohort retention analysis.
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="New MRR" value="+$1,702" sub="from new subscribers" positive />
        <StatCard label="Churned MRR" value="−$290" sub="from cancellations" positive={false} />
        <StatCard label="Net New MRR" value="+$1,752" sub="total net change" />
      </div>

      {/* Subscriber growth bar chart */}
      <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Subscriber Growth</h2>
            <p className="text-xs text-gray-500">New vs churned subscribers per month</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> New
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-400/60 inline-block" /> Churned
            </span>
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subscriberData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<SubsTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="newSubs" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="churnedSubs" fill="rgba(248,113,113,0.55)" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Churn rate line chart */}
      <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Churn Rate</h2>
            <p className="text-xs text-gray-500">Monthly churn rate — current: 2.1%</p>
          </div>
          <span className="px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-full">
            ↓ Improving
          </span>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={churnRateData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 7]}
              />
              <ReferenceLine
                y={6}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{ value: "Critical 6%", position: "insideTopRight", fill: "#ef4444", fontSize: 10 }}
              />
              <Tooltip content={<ChurnTooltip />} cursor={{ stroke: "#f97316", strokeWidth: 1, strokeDasharray: "3 3" }} />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: "#f97316", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#f97316", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cohort Retention Heatmap */}
      <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Cohort Retention</h2>
          <p className="text-xs text-gray-500">% of subscribers still active after N months</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#30363d]">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cohort
                </th>
                {cohortMonths.map((m) => (
                  <th
                    key={m}
                    className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Month {cohortMonths.indexOf(m) + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {cohortData.map((row) => (
                <tr key={row.cohort}>
                  <td className="px-3 py-2 text-xs font-medium text-gray-300 whitespace-nowrap">
                    {row.cohort}
                  </td>
                  <HeatCell value={row.m1} />
                  <HeatCell value={row.m2} />
                  <HeatCell value={row.m3} />
                  <HeatCell value={row.m4} />
                  <HeatCell value={row.m5} />
                  <HeatCell value={row.m6} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
