"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Brain, Info } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  fetchShapGlobal,
  fetchFeatureDescriptions,
  fetchShapLocal,
} from "@/lib/fetch-data"
import type {
  ShapFeature,
  FeatureDescriptions,
  ShapLocalExplanation,
} from "@/lib/types"

const TIER_COLORS: Record<string, string> = {
  high: "text-emerald-400",
  moderate: "text-amber-400",
  low: "text-yellow-400",
  disengaged: "text-red-400",
}

const TIER_BG: Record<string, string> = {
  high: "bg-emerald-500/15 border-emerald-500/30",
  moderate: "bg-amber-500/15 border-amber-500/30",
  low: "bg-yellow-500/15 border-yellow-500/30",
  disengaged: "bg-red-500/15 border-red-500/30",
}

export function XaiInsights() {
  const [shapGlobal, setShapGlobal] = useState<ShapFeature[] | null>(null)
  const [descriptions, setDescriptions] = useState<FeatureDescriptions | null>(null)
  const [shapLocal, setShapLocal] = useState<ShapLocalExplanation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetchShapGlobal(),
      fetchFeatureDescriptions(),
      fetchShapLocal(),
    ])
      .then(([global, desc, local]) => {
        setShapGlobal(global)
        setDescriptions(desc)
        setShapLocal(local)
      })
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <p>Failed to load XAI data: {error}</p>
      </div>
    )
  }

  const isLoading = !shapGlobal || !descriptions || !shapLocal

  const sortedFeatures = shapGlobal
    ? [...shapGlobal].sort((a, b) => b.mean_abs_shap - a.mean_abs_shap)
    : []

  const maxShap = sortedFeatures.length > 0 ? sortedFeatures[0].mean_abs_shap : 0.1
  const chartDomain = [0, Math.ceil(maxShap * 100) / 100 + 0.01]

  const sampleStudents = shapLocal ? shapLocal.slice(0, 5) : []

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">XAI Insights</h2>
        <p className="text-muted-foreground">
          Explainable AI - Understanding model predictions through SHAP analysis
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Feature Importance Chart */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              Key Risk Factors (Disengaged vs High)
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            The chart shows the impact of behaviors in the first 5 sessions on the risk of dropping out of the course.
          </p>
          {isLoading ? (
            <div className="space-y-3 h-80 flex flex-col justify-center">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6 rounded" style={{ width: `${90 - i * 8}%` }} />
              ))}
            </div>
          ) : (
            <div className="h-[520px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sortedFeatures}
                  layout="vertical"
                  margin={{ left: 170 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.04 250)" />
                  <XAxis
                    type="number"
                    stroke="oklch(0.65 0.02 250)"
                    fontSize={11}
                    domain={chartDomain}
                    tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    stroke="oklch(0.65 0.02 250)"
                    fontSize={10}
                    width={165}
                    tick={{ fill: "oklch(0.85 0.02 250)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.18 0.035 250)",
                      border: "1px solid oklch(0.28 0.04 250)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [
                      `${(value * 100).toFixed(2)}%`,
                      "Mean |SHAP|",
                    ]}
                  />
                  <Bar
                    dataKey="mean_abs_shap"
                    fill="oklch(0.65 0.15 250)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Feature Descriptions */}
        <Card className="p-5 max-h-[580px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              Feature Descriptions
            </h3>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedFeatures.map((item) => (
                <div
                  key={item.feature}
                  className="p-3 rounded-lg bg-secondary/30 border border-border/50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-foreground">
                      {item.feature}
                    </p>
                    <span className="text-xs font-mono text-primary shrink-0 ml-2">
                      {(item.mean_abs_shap * 100).toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {descriptions?.[item.feature] ?? "No description available"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Sample Student Explanations */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Sample Student Explanations
          </h3>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sampleStudents.map((student) => (
              <div
                key={`${student.student_display_id ?? student.student_id}-${student.room_id}`}
                className={`p-4 rounded-lg border ${TIER_BG[student.predicted_tier] ?? "bg-secondary/30 border-border/50"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    {student.student_name}
                  </h4>
                  <span
                    className={`text-xs font-medium capitalize ${TIER_COLORS[student.predicted_tier] ?? "text-muted-foreground"}`}
                  >
                    {student.predicted_tier}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
                  <p>
                    True:{" "}
                    <span className="capitalize">
                      {student.true_tier ?? "unknown"}
                    </span>
                  </p>
                  <p>
                    P(high) = {Number((student.p_high ?? 0) * 100).toFixed(1)}% ·
                    P(disengaged) ={" "}
                    {Number((student.p_disengaged ?? 0) * 100).toFixed(1)}%
                  </p>
                </div>

                {/* Top 3 Features */}
                <div className="mb-3">
                  <p className="text-xs font-medium text-foreground mb-1.5">Top Features</p>
                  <div className="space-y-1">
                    {student.top_features.slice(0, 3).map((f) => (
                      <div key={f.feature} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate mr-2">{f.feature}</span>
                        <span className={`font-mono shrink-0 ${f.shap_value > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {f.shap_value > 0 ? "+" : ""}
                          {Number(f.shap_value ?? 0).toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reasons */}
                {(student.reasons ?? []).length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-foreground mb-1">Reasons</p>
                    <ul className="space-y-0.5">
                      {(student.reasons ?? []).slice(0, 3).map((r, i) => (
                        <li key={i} className="text-xs text-muted-foreground leading-snug">
                          • {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggestions */}
                {(student.suggestions ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">Suggestions</p>
                    <ul className="space-y-0.5">
                      {(student.suggestions ?? []).slice(0, 2).map((s, i) => (
                        <li key={i} className="text-xs text-muted-foreground/80 italic leading-snug">
                          → {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Footer Note */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
        <Info className="w-3 h-3" />
        <span>Data from the first 3-5 sessions only. SHAP values computed using TreeExplainer.</span>
      </div>
    </div>
  )
}
