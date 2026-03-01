import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Sprint 2.3 — CSV Export — Wren

// ─── Mock metric data generator ───────────────────────────────────────────────

function generateMonthlyData(months: number) {
  const rows: string[] = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = d.toISOString().slice(0, 7)
    const mrr = Math.round(4000 + Math.random() * 2000 + i * 150)
    const arr = mrr * 12
    const activeSubs = Math.round(80 + Math.random() * 40 + i * 5)
    const newSubs = Math.round(8 + Math.random() * 12)
    const churned = Math.round(1 + Math.random() * 5)
    const churnRate = ((churned / activeSubs) * 100).toFixed(2)
    const growth = i > 0 ? (Math.random() * 10 - 2).toFixed(2) : '0.00'
    rows.push(`${month},${mrr},${arr},${activeSubs},${newSubs},${churned},${churnRate},${growth}`)
  }

  return rows
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "12";
  const months = Math.min(Math.max(parseInt(range) || 12, 1), 36);
  const metric = searchParams.get("metric") ?? "all";

  const header = "Month,MRR ($),ARR ($),Active Subscribers,New Subscribers,Churned,Churn Rate (%),MRR Growth (%)"
  const rows = generateMonthlyData(months)
  const csv = [header, ...rows].join("\n")

  const filename = `metricshub-export-${metric}-${months}mo-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache",
    },
  });
}
