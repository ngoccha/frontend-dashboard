"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { TierBadge, type TierLevel } from "@/components/dashboard/tier-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Users, Home, Target, BrainCircuit, AlertCircle, Download } from "lucide-react"
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
import { fetchOverview, fetchSessionActivity, fetchStudents, fetchRooms } from "@/lib/fetch-data"
import { hasPrediction, TIER_COLORS, isSpam, downloadCSV } from "@/lib/utils"
import { useDashboard } from "@/lib/dashboard-context"
import type { OverviewData, SessionActivityByTier, StudentRecord, RoomInfo } from "@/lib/types"

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

const ROOM_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  weekly: { label: "Weekly", className: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  selfpaced: { label: "Self-paced", className: "bg-purple-500/15 text-purple-400 border border-purple-500/30" },
}

function StudentTable({
  students,
  showPredictionCols,
  hideSpam,
  searchQuery,
  onExport,
}: {
  students: StudentRecord[]
  showPredictionCols: boolean
  hideSpam: boolean
  searchQuery: string
  onExport?: (data: StudentRecord[]) => void
}) {
  const [page, setPage] = useState(0)

  const displayed = useMemo(() => {
    let result = students
    if (hideSpam) result = result.filter((s) => !isSpam(s))
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (s) =>
          s.student_id.toLowerCase().includes(q) ||
          (s.student_display_id ?? "").toLowerCase().includes(q) ||
          s.student_name.toLowerCase().includes(q),
      )
    }
    return result
  }, [students, hideSpam, searchQuery])

  const totalPages = Math.ceil(displayed.length / PAGE_SIZE)
  const paged = displayed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => {
    setPage(0)
  }, [students, hideSpam, searchQuery])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">
          {displayed.length.toLocaleString()} student{displayed.length !== 1 ? "s" : ""}
          {hideSpam && students.filter(isSpam).length > 0 && (
            <span className="ml-2 text-amber-400">
              ({students.filter(isSpam).length} high-rate hidden)
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {onExport && (
            <button
              onClick={() => onExport(displayed)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
              aria-label="Export to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
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
                    Engagement Score
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
                Room Type
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Sessions Early
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Active Clicks
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Flags
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s) => {
              const tierKey = s.predicted_tier?.toLowerCase() || 'disengaged'
              const tierDisplay =
                TIER_LABEL[tierKey] ??
                ((tierKey.charAt(0).toUpperCase() + tierKey.slice(1)) as TierLevel)
              const engScore = (s as any).engagement_score_early ?? (s as any).engagement_score
              return (
                <tr
                  key={`${s.student_id}-${s.course_id}`}
                  className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${
                    showPredictionCols ? (TIER_ROW_BG[tierKey] ?? "") : ""
                  }`}
                >
                  <td className="py-3 px-4 text-sm font-mono text-foreground">
                    {s.student_display_id ?? s.student_id}
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground">{s.student_name}</td>
                  {showPredictionCols && (
                    <>
                      <td className="py-3 px-4">
                        <TierBadge tier={tierDisplay} />
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {engScore != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all"
                                style={{ 
                                  width: `${(engScore * 100)}%`,
                                  backgroundColor: engScore >= 0.6 ? TIER_COLORS.high : engScore >= 0.4 ? TIER_COLORS.moderate : engScore >= 0.2 ? TIER_COLORS.low : TIER_COLORS.disengaged
                                }}
                              />
                            </div>
                            <span className="text-foreground font-mono text-xs">{(engScore * 100).toFixed(0)}%</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {s.p_disengaged != null ? `${(s.p_disengaged * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {s.p_high != null ? `${(s.p_high * 100).toFixed(1)}%` : "—"}
                      </td>
                    </>
                  )}
                  <td className="py-3 px-4">
                    {s.room_type ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROOM_TYPE_BADGE[s.room_type]?.className ?? ""}`}>
                        {ROOM_TYPE_BADGE[s.room_type]?.label ?? s.room_type}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground">{s.n_sessions_early ?? 0}</td>
                  <td className="py-3 px-4 text-sm text-foreground">
                    {s.n_active_early ?? "—"}
                  </td>
                  <td className="py-3 px-4">
                    {isSpam(s) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        High event rate
                      </span>
                    )}
                  </td>
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

type RoomTypeFilter = "All" | "weekly" | "selfpaced"

export function ClassEngagement() {
  // Use global filters from context for persistence across screens
  const { filters, setFilters } = useDashboard()
  
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activity, setActivity] = useState<SessionActivityByTier | null>(null)
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activityMetric, setActivityMetric] = useState<ActivityMetric>("avg_events")
  
  // Use context filters with local fallback
  const selectedCourseId = filters.selectedCourseId
  const roomTypeFilter = filters.roomTypeFilter as RoomTypeFilter
  const hideSpam = filters.hideSpam
  const searchQuery = filters.searchQuery
  
  // Update context when filters change
  const setSelectedCourseId = (value: string) => setFilters({ selectedCourseId: value })
  const setRoomTypeFilter = (value: RoomTypeFilter) => setFilters({ roomTypeFilter: value })
  const setHideSpam = (value: boolean) => setFilters({ hideSpam: value })
  const setSearchQuery = (value: string) => setFilters({ searchQuery: value })

  useEffect(() => {
    Promise.all([fetchOverview(), fetchSessionActivity(), fetchStudents()])
      .then(([ov, act, stu]) => {
        setOverview(ov)
        setActivity(act)
        setStudents(stu)
      })
      .finally(() => setLoading(false))
  }, [])

  const courseIds = useMemo(() => {
    if (!students) return []
    const courses = new Set(students.map(s => s.course_id || s.room_id))
    return Array.from(courses).sort()
  }, [students])

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchCourse = selectedCourseId === "All" || (s.course_id || s.room_id) === selectedCourseId
      const matchType = roomTypeFilter === "All" || s.room_type === roomTypeFilter
      return matchCourse && matchType
    })
  }, [students, selectedCourseId, roomTypeFilter])

  const activityBySession = useMemo(
    () => (activity ? buildActivityChart(activity, activityMetric) : []),
    [activity, activityMetric],
  )

  const predictedStudents = useMemo(
    () => filteredStudents.filter((s) => hasPrediction(s)),
    [filteredStudents],
  )

  const tierCounts = useMemo(() => {
    if (selectedCourseId === "All") return overview?.tier_counts ?? {}
    const counts: Record<string, number> = {}
    filteredStudents.forEach(s => {
      const tier = s.predicted_tier?.toLowerCase()
      if (tier) counts[tier] = (counts[tier] || 0) + 1
    })
    return counts
  }, [selectedCourseId, overview, filteredStudents])

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Class Engagement</h2>
          <p className="text-muted-foreground">
            Monitor student engagement tiers and early activity patterns
          </p>
        </div>
        {!loading && (
          <div className="flex items-center gap-3">
            {/* Room type toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs" role="group" aria-label="Room type filter">
              {(["All", "weekly", "selfpaced"] as RoomTypeFilter[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setRoomTypeFilter(t)}
                  aria-pressed={roomTypeFilter === t}
                  aria-label={`Filter by ${t === "All" ? "all room types" : t === "weekly" ? "weekly rooms" : "self-paced rooms"}`}
                  className={`px-3 py-1.5 transition-colors ${
                    roomTypeFilter === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {t === "All" ? "All Types" : t === "weekly" ? "Weekly" : "Self-paced"}
                </button>
              ))}
            </div>
            {courseIds.length > 0 && (
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId} aria-label="Filter by course">
                <SelectTrigger className="w-[200px]" aria-label="Select course filter">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Courses</SelectItem>
                  {courseIds.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard
          title="Students"
          value={filteredStudents.length.toLocaleString()}
          subtitle={roomTypeFilter === "All" ? "Cohort total" : `${roomTypeFilter === "weekly" ? "Weekly" : "Self-paced"} rooms`}
          icon={Users}
        />
        <KpiCard
          title="Weekly Rooms"
          value={overview?.cohort_weekly_students?.toLocaleString() ?? "—"}
          subtitle="Students in weekly courses"
          icon={Home}
        />
        <KpiCard
          title="Self-paced Rooms"
          value={overview?.cohort_sp_students?.toLocaleString() ?? "—"}
          subtitle="Students in self-paced courses"
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

      {/* Self-paced warning */}
      {roomTypeFilter === "selfpaced" && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold">Self-paced rooms are shared across multiple classes.</span>{" "}
            A student may appear to have few sessions not because they are absent, but because only a subset of the room timeline belongs to their class. Attendance and session count features should be interpreted with caution for self-paced rooms.
          </p>
        </div>
      )}

      {/* Student Tables — tabbed predicted vs all */}
      <Card className="p-5">
        <Tabs defaultValue="predicted">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-foreground">Students</h3>
            <TabsList>
              <TabsTrigger value="predicted">
                With Predictions ({predictedStudents.length})
              </TabsTrigger>
              <TabsTrigger value="all">
                All Students ({filteredStudents.length.toLocaleString()})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Search + spam toggle */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Search student ID or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search students by ID or name"
                className="w-full pl-9 pr-4 py-1.5 text-sm bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <button
              onClick={() => setHideSpam(!hideSpam)}
              aria-label={hideSpam ? "Show high-rate students" : "Hide high-rate students"}
              aria-pressed={hideSpam}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                hideSpam
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                  : "text-muted-foreground border-border hover:bg-muted/50"
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              {hideSpam ? "Showing filtered" : "Hide high-rate students"}
            </button>
          </div>

          <TabsContent value="predicted">
            <StudentTable 
              students={predictedStudents} 
              showPredictionCols 
              hideSpam={hideSpam} 
              searchQuery={searchQuery}
              onExport={(data) => downloadCSV(data as unknown as Record<string, unknown>[], `students_predicted_${selectedCourseId}_${new Date().toISOString().split('T')[0]}.csv`)}
            />
          </TabsContent>

          <TabsContent value="all">
            <StudentTable 
              students={filteredStudents} 
              showPredictionCols={false} 
              hideSpam={hideSpam} 
              searchQuery={searchQuery}
              onExport={(data) => downloadCSV(data as unknown as Record<string, unknown>[], `students_all_${selectedCourseId}_${new Date().toISOString().split('T')[0]}.csv`)}
            />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
