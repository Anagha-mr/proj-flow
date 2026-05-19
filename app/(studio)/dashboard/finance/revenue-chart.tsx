"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { MonthlyRevenue } from "@/app/actions/studio-finance"

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n}`
}

interface Props {
  data: MonthlyRevenue[]
}

export function RevenueChart({ data }: Props) {
  if (data.length < 3) {
    return (
      <div className="flex items-center justify-center h-48 rounded-xl border border-dashed text-sm text-muted-foreground">
        Add more data to see trends
      </div>
    )
  }

  const chartData = data.map((d) => ({
    month: MONTH_LABELS[d.month.slice(5, 7)] ?? d.month.slice(5, 7),
    Revenue: d.revenue,
    "Project Costs": d.project_costs,
    "Studio Expenses": d.studio_expenses,
  }))

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 480 }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barGap={2} barCategoryGap="20%">
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmt}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) =>
                Number(value).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
              }
            />
            <Legend />
            <Bar dataKey="Revenue" fill="#1a1a2e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Project Costs" fill="#e94560" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Studio Expenses" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
