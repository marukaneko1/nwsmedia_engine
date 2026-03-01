"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { DailyLeadCount } from "@/types/database";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LeadsChartProps {
  data: DailyLeadCount[];
}

function formatChartDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function LeadsChart({ data }: LeadsChartProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-foreground">Leads Over Time</h3>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity={0.1} />
                <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartDate}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length || !label) return null;
                return (
                  <div className="rounded-lg border border-border bg-card p-2 shadow-lg">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(typeof label === "string" ? label : String(label))}
                    </p>
                    <p className="font-medium">{payload[0].value} leads</p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="rgb(59 130 246)"
              strokeWidth={2}
              fill="url(#fillBlue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
