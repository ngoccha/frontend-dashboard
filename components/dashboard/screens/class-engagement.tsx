"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { TierBadge, type TierLevel } from "@/components/dashboard/tier-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Users, Home, Target, BrainCircuit } from "lucide-react"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts"
import { fetchOverview, fetchSessionActivity, fetchStudents } from "@/lib/fetch-data"
import type { OverviewData, SessionActivityByTier, StudentRecord } from "@/lib/types"

const TIER_COLORS: Record<string, string> = {
  high: "oklch(0.7 0.18 145)",
  moderate: "oklch(0.8 0.16 85)",
  low: "oklch(0.78 0.12 70)",
  disengaged: "oklch(0.65 0.18 25)",
}

const TIER_LABEL: Record<string, TierLevel> = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
  disengaged: "Disengaged",
}

const TIER_ROW_BG: Record<string, string> = {
  high: "bg-tier-high-bg/20",
  moderate: "bg-tier-moderate-bg/20",
  low: "bg-tier-low-bg/20",
  disengaged: "bg-tier-disengaged-bg/20",
}

const PAGE_SIZE = 50

type ActivityMetric = "avg_events" | "avg_dur_min"

interface ActivityRow {
  session: string
  // dynamic keys: tier -> value, `n_${tier}` -> n_students
  [key: string]: string | number
}

function buildActivityChart(
  raw: SessionActivityByTier,
  metric: ActivityMetric,
  maxSessions = 10,
): ActivityRow[] {
  const merged: Record<number, ActivityRow> = {}
  const tiers = Object.keys(raw)

  for (const tier of tiers) {
    const series = raw[tier]
    if (!Array.isArray(series)) continue
    for (const entry of series) {
      if (entry.session_idx < 1 || entry.session_idx > maxSessions) continue
      if (!merged[entry.session_idx]) {
        merged[entry.session_idx] = {
          session: `S${entry.session_idx}`,
        }
      }
      const value = metric === "avg_dur_min" ? entry.avg_dur_min : entry.avg_events
      merged[entry.session_idx][tier] = Math.round(value * 100) / 100
      merged[entry.session_idx][`n_${tier}`] = entry.n_students
    }
  }

  return Object.keys(merged)
    .map(Number)
    .sort((a, b) => a - b)
    .map((idx) => merged[idx])
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ActivityTooltip({ active, payload, label, metricLabel }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border p-3 text-sm"
      style={{
        backgroundColor: "oklch(0.18 0.035 250)",
        border: "1px solid oklch(0.28 0.04 250)",
      }}
    >
      <p className="font-medium text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => {
        const nStudents = entry.payload[`n_${entry.dataKey}`]
        return (
          <div
            key={entry.dataKey}
            className="flex justify-between gap-4 py-0.5"
            style={{ color: entry.color }}
          >
            <span>{entry.name}</span>
            <span className="font-mono">
              {entry.value} {metricLabel}
              <span className="text-muted-foreground ml-1.5 text-xs">(n={nStudents})</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="px-3 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Prev
      </button>
      <span className="text-muted-foreground">
        {page + 1} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        className="px-3 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  )
}

function StudentTable({
  students,
  showPredictionCols,
}: {
  students: StudentRecord[]
  showPredictionCols: boolean
}) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(students.length / PAGE_SIZE)
  const paged = students.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => {
    setPage(0)
  }, [students])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">
          {students.length.toLocaleString()} student{students.length !== 1 ? "s" : ""}
        </span>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Student ID
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Name
              </th>
              {showPredictionCols && (
                <>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Predicted Tier
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    P(Disengaged)
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    P(High)
                  </th>
                </>
              )}
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Sessions Early
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Duration (min)
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                CodeSubmit
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Quiz
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s) => {
              const tierKey = s.predicted_tier.toLowerCase()
              const tierDisplay =
                TIER_LABEL[tierKey] ??
                ((tierKey.charAt(0).toUpperCase() + tierKey.slice(1)) as TierLevel)
              return (
                <tr
                  key={`${s.student_id}-${s.room_id}`}
                  className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${
                    showPredictionCols ? (TIER_ROW_BG[tierKey] ?? "") : ""
                  }`}
                >
                  <td className="py-3 px-4 text-sm font-mono text-foreground">{s.student_id}</td>
                  <td className="py-3 px-4 text-sm text-foreground">{s.student_name}</td>
                  {showPredictionCols && (
                    <>
                      <td className="py-3 px-4">
                        <TierBadge tier={tierDisplay} />
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {s.p_disengaged != null ? `${(s.p_disengaged * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {s.p_high != null ? `${(s.p_high * 100).toFixed(1)}%` : "—"}
                      </td>
                    </>
                  )}
                  <td className="py-3 px-4 text-sm text-foreground">{s.n_sessions_early}</td>
                  <td className="py-3 px-4 text-sm text-foreground">
                    {Math.round(s.total_dur_early)}
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground">{s.n_codesubmit_early}</td>
                  <td className="py-3 px-4 text-sm text-foreground">{s.n_quiz_early}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex justify-end mt-3">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}

export function ClassEngagement() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activity, setActivity] = useState<SessionActivityByTier | null>(null)
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activityMetric, setActivityMetric] = useState<ActivityMetric>("avg_events")

  useEffect(() => {
    Promise.all([fetchOverview(), fetchSessionActivity(), fetchStudents()])
      .then(([ov, act, stu]) => {
        setOverview(ov)
        setActivity(act)
        setStudents(stu)
      })
      .finally(() => setLoading(false))
  }, [])

  const activityBySession = useMemo(
    () => (activity ? buildActivityChart(activity, activityMetric) : []),
    [activity, activityMetric],
  )

  const predictedStudents = useMemo(
    () => students.filter((s) => s.has_prediction),
    [students],
  )

  const tierCounts = overview?.tier_counts ?? {}
  const tierOrder =
    (Array.isArray(overview?.config?.TIER_NAMES)
      ? (overview?.config?.TIER_NAMES as string[])
      : ["disengaged", "low", "moderate", "high"]) ?? []

  const totalEnrollments =
    Object.values(tierCounts).reduce((sum, v) => sum + (v ?? 0), 0) ?? 0

  const tierData =
    overview && totalEnrollments > 0
      ? tierOrder.map((key) => {
          const count = (tierCounts as Record<string, number | undefined>)[key] ?? 0
          return {
            key,
            label:
              TIER_LABEL[key] ??
              ((key.charAt(0).toUpperCase() + key.slice(1)) as TierLevel),
            count,
            pct: ((count / totalEnrollments) * 100).toFixed(1),
            color: TIER_COLORS[key] ?? "oklch(0.65 0.15 250)",
          }
        })
      : []

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const metricLabel = activityMetric === "avg_dur_min" ? "min" : "events"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Class Engagement</h2>
        <p className="text-muted-foreground">
          Monitor student engagement tiers and early activity patterns
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          title="Students"
          value={overview?.cohort_students.toLocaleString() ?? "—"}
          subtitle="Cohort total"
          icon={Users}
        />
        <KpiCard
          title="Rooms"
          value={overview?.cohort_rooms ?? "—"}
          subtitle={`${overview?.cohort_courses.toLocaleString() ?? "—"} courses`}
          icon={Home}
        />
        <KpiCard
          title="Predicted"
          value={predictedStudents.length.toLocaleString()}
          subtitle="Students with model predictions"
          icon={BrainCircuit}
        />
        <KpiCard
          title="High Engagement"
          value={`${Number(
            tierData.find((t) => t.key === "high")?.pct ?? 0,
          ).toFixed(1)}%`}
          subtitle={`${
            (tierCounts as Record<string, number | undefined>).high ?? 0
          } of ${totalEnrollments.toLocaleString()} enrollments`}
          icon={Target}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Tier Distribution — stacked bar + stat cards */}
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Engagement Tier Distribution
          </h3>

          <div className="h-8 rounded-lg overflow-hidden flex w-full mb-5">
            {tierData.map((t) => (
              <div
                key={t.key}
                className="h-full transition-all"
                style={{
                  width: `${(t.count / totalEnrollments) * 100}%`,
                  backgroundColor: t.color,
                  minWidth: t.count > 0 ? "3px" : 0,
                }}
                title={`${t.label}: ${t.count.toLocaleString()} (${t.pct}%)`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {tierData.map((t) => (
              <div
                key={t.key}
                className="rounded-lg border-2 p-3 text-center"
                style={{ borderColor: t.color }}
              >
                <p className="text-xs font-medium text-muted-foreground mb-1">{t.label}</p>
                <p className="text-xl font-bold text-foreground">{t.count.toLocaleString()}</p>
                <p className="text-sm font-semibold" style={{ color: t.color }}>
                  {t.pct}%
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Based on {totalEnrollments.toLocaleString()} course enrollments (students can appear in
            multiple courses)
          </p>
        </Card>

        {/* Activity by Session — line chart with metric toggle */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold text-foreground">
              Avg Early Activity by Session
            </h3>
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button
                onClick={() => setActivityMetric("avg_events")}
                className={`px-3 py-1.5 transition-colors ${
                  activityMetric === "avg_events"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Events
              </button>
              <button
                onClick={() => setActivityMetric("avg_dur_min")}
                className={`px-3 py-1.5 transition-colors ${
                  activityMetric === "avg_dur_min"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Duration
              </button>
            </div>
          </div>

          <p className="text-xs text-amber-500 mb-3">
            ⚠ Disengaged tier has very few students (1–6 per session) — interpret with caution
          </p>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityBySession}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.04 250)" />
                <XAxis dataKey="session" stroke="oklch(0.65 0.02 250)" fontSize={12} />
                <YAxis
                  stroke="oklch(0.65 0.02 250)"
                  fontSize={12}
                  label={{
                    value: activityMetric === "avg_dur_min" ? "Avg duration (min)" : "Avg events",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "oklch(0.65 0.02 250)", fontSize: 11 },
                  }}
                />
                <Tooltip content={<ActivityTooltip metricLabel={metricLabel} />} />
                <Legend />
                {tierOrder.map((tierKey) => (
                  <Line
                    key={tierKey}
                    type="monotone"
                    dataKey={tierKey}
                    name={TIER_LABEL[tierKey] ?? tierKey}
                    stroke={TIER_COLORS[tierKey] ?? "oklch(0.65 0.15 250)"}
                    strokeWidth={2}
                    dot={{ fill: TIER_COLORS[tierKey] ?? "oklch(0.65 0.15 250)" }}
                    strokeDasharray={tierKey === "disengaged" ? "5 3" : undefined}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Student Tables — tabbed predicted vs all */}
      <Card className="p-5">
        <Tabs defaultValue="predicted">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Students</h3>
            <TabsList>
              <TabsTrigger value="predicted">
                With Predictions ({predictedStudents.length})
              </TabsTrigger>
              <TabsTrigger value="all">
                All Students ({students.length.toLocaleString()})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="predicted">
            <StudentTable students={predictedStudents} showPredictionCols />
          </TabsContent>

          <TabsContent value="all">
            <StudentTable students={students} showPredictionCols={false} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
