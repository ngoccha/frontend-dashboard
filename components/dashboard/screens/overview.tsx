"use client"

import { useEffect, useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { TierBadge, type TierLevel } from "@/components/dashboard/tier-badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TrendingUp,
  AlertTriangle,
  Activity,
  Target,
  Database,
  Brain,
  Layers,
  ArrowRight,
  Filter,
  Info,
  Shuffle,
  Users,
  BookOpen,
} from "lucide-react"
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
  fetchOverview,
  fetchRooms,
  fetchTransitionMatrix,
  fetchStudents,
} from "@/lib/fetch-data"
import { hasPrediction } from "@/lib/utils"
import type { OverviewData, RoomInfo, TransitionMatrix, StudentRecord } from "@/lib/types"

const TIER_COLORS: Record<string, string> = {
  high: "oklch(0.7 0.18 145)",
  moderate: "oklch(0.8 0.16 85)",
  low: "oklch(0.78 0.12 70)",
  disengaged: "oklch(0.65 0.18 25)",
}

/* ── Skeleton placeholders ─────────────────────────────── */

function FunnelSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-6 w-48 mb-4" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-32 flex-1 rounded-lg" />
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-32 flex-1 rounded-lg" />
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-32 flex-1 rounded-lg" />
      </div>
    </Card>
  )
}

function KpiSkeleton() {
  return (
    <Card className="p-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-32" />
      </div>
    </Card>
  )
}

function ChartSkeleton() {
  return (
    <Card className="col-span-2 p-5">
      <Skeleton className="h-6 w-48 mb-4" />
      <Skeleton className="h-24 w-full" />
    </Card>
  )
}

function ContextSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-6 w-36 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </Card>
  )
}

function RoomsSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-6 w-40 mb-4" />
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    </Card>
  )
}

/* ── Main component ────────────────────────────────────── */

export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return "0"; 
  return num.toLocaleString("en-US");
}

export function Overview() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null)
  const [transition, setTransition] = useState<TransitionMatrix | null>(null)
  const [students, setStudents] = useState<StudentRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRoomId, setSelectedRoomId] = useState<string>("All")

  useEffect(() => {
    Promise.all([
      fetchOverview(),
      fetchRooms(),
      fetchTransitionMatrix(),
      fetchStudents(),
    ])
      .then(([ov, rm, tr, st]) => {
        setOverview(ov)
        setRooms(rm)
        setTransition(tr)
        setStudents(st)
      })
      .finally(() => setLoading(false))
  }, [])

  /* ── Derived data ── */

  const selectedRoomData = useMemo(() => {
    if (selectedRoomId === "All" || !rooms) return null
    return rooms.find(r => r.room_id === selectedRoomId) ?? null
  }, [selectedRoomId, rooms])

  const tierCounts = selectedRoomId === "All" ? (overview?.tier_counts ?? {}) : (selectedRoomData?.tier_counts ?? {})
  const tierOrder =
    (Array.isArray(overview?.config?.TIER_NAMES)
      ? (overview?.config?.TIER_NAMES as string[])
      : ["disengaged", "low", "moderate", "high"]) ?? []

  const totalTierLabels =
    Object.values(tierCounts).reduce((sum, v) => sum + (v ?? 0), 0) ?? 0

  const tierData =
    overview && totalTierLabels > 0
      ? tierOrder.map((key) => {
          const count = (tierCounts as Record<string, number | undefined>)[key] ?? 0
          return {
            key,
            label: (key.charAt(0).toUpperCase() + key.slice(1)) as TierLevel,
            count,
            pct: (count / totalTierLabels) * 100,
            color: TIER_COLORS[key] ?? "oklch(0.65 0.15 250)",
          }
        })
      : []

  const predictionCount = students
    ? students.filter((s) => {
        const studentRoomId = s.course_id || s.room_id
        if (selectedRoomId !== "All" && studentRoomId !== selectedRoomId) return false
        return hasPrediction(s)
      }).length
    : 0

  const labelStability = transition ? transition.stability : 0

  const topRooms = rooms
    ? [...rooms].sort((a, b) => b.n_students - a.n_students).slice(0, 10)
    : []

  const roomSizeBins =
    rooms && rooms.length > 0
      ? (() => {
          const sizes = rooms.map((r) => r.n_students)
          const min = Math.min(...sizes)
          const max = Math.max(...sizes)
          const range = max - min
          const step = range === 0 ? 1 : Math.max(1, Math.ceil(range / 6))
          const bins: { range: string; count: number }[] = []
          for (let lo = min; lo <= max; lo += step) {
            const hi = Math.min(lo + step - 1, max)
            const count = sizes.filter((s) => s >= lo && s <= hi).length
            bins.push({ range: `${lo}–${hi}`, count })
          }
          return bins
        })()
      : []

  /* ── Render ── */

  const displayStudentCount = selectedRoomId === "All" 
    ? overview?.cohort_students 
    : selectedRoomData?.n_students

  return (
    <div className="space-y-6">
      {/* Page Title & Room Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Overview</h2>
          <p className="text-muted-foreground">
            Data pipeline summary, engagement tiers, and model performance
          </p>
        </div>
        {!loading && rooms && (
          <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Rooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Rooms</SelectItem>
              {rooms.map((r) => (
                <SelectItem key={r.room_id} value={r.room_id}>
                  {r.room_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ────────── 1. MAIN KPIs (Redesigned) ────────── */}
      {loading ? (
        <div className="grid grid-cols-3 gap-6">
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          <KpiCard
            title="Valid Students"
            value={formatNumber(displayStudentCount)}
            subtitle={selectedRoomId === "All" ? "Total students after filtering" : `Students in ${selectedRoomId}`}
            icon={Users}
          />
          <KpiCard
            title="Courses Analyzed"
            value={selectedRoomId === "All" ? formatNumber(overview?.cohort_courses) : "1"}
            subtitle={selectedRoomId === "All" ? "Number of course enrollments" : "Room corresponds to 1 course"}
            icon={BookOpen}
          />
          <KpiCard
            title="AI Engine"
            value={overview?.best_model ?? "N/A"}
            subtitle="Current architecture"
            icon={Brain}
          />
        </div>
      )}

      {/* ────────── 2. KEY INSIGHT CARDS ────────── */}
      <div className="grid grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              title="Middle Tiers"
              value={`${(() => {
                const totalMiddle = tierData
                  .filter((t) => t.key !== "high" && t.key !== "disengaged")
                  .reduce((sum, t) => sum + (t.pct ?? 0), 0)
                return Number.isFinite(totalMiddle)
                  ? Number(totalMiddle).toFixed(1)
                  : "0.0"
              })()}%`}
              subtitle="Separating extremes from middle tiers"
              icon={Layers}
            />
            <KpiCard
              title="Label Stability"
              value={`${Number(labelStability * 100).toFixed(1)}%`}
              subtitle="Same tier from early → full period"
              icon={Shuffle}
            />
            <KpiCard
              title="Predictions"
              value={predictionCount}
              subtitle={selectedRoomId === "All" ? `Of ${overview?.cohort_students ?? 0} students` : `Of ${selectedRoomData?.n_students ?? 0} students`}
              icon={Target}
            />
            <KpiCard
              title="Model Accuracy"
              value={`${Number((overview?.metrics?.accuracy ?? 0) * 100).toFixed(1)}%`}
              subtitle="Two-Stage Hierarchical Model"
              icon={Brain}
            />
            <div title="Quadratic Weighted Kappa - Chỉ số đánh giá độ tin cậy phân loại cấp bậc">
              <KpiCard
                title="QWK Score"
                value={Number(overview?.metrics?.qwk ?? 0).toFixed(4)}
                subtitle="Agreement with actual tiers"
                icon={Brain}
              />
            </div>
          </>
        )}
      </div>

      {/* ────────── 3. TIER DISTRIBUTION + CONTEXT ────────── */}
      <div className="grid grid-cols-3 gap-6">
        {loading ? (
          <ChartSkeleton />
        ) : (
          <Card className="col-span-2 p-5">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Engagement Tier Distribution
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {totalTierLabels.toLocaleString()} course-level tier labels — students
              can appear in multiple courses
            </p>

            {/* Horizontal stacked bar */}
            <div className="w-full h-11 rounded-lg overflow-hidden flex text-[11px] font-bold">
              {tierData.map((t) => (
                <div
                  key={t.key}
                  className="h-full flex items-center justify-center"
                  style={{
                    width: `${t.pct}%`,
                    minWidth: t.pct > 0 ? "3.5rem" : 0,
                    backgroundColor: t.color,
                    color: "oklch(0.15 0.02 250)",
                  }}
                >
                  {t.label} {Number(t.pct ?? 0).toFixed(1)}%
                </div>
              ))}
            </div>

            {/* Legend with counts */}
            <div className="flex items-center gap-6 mt-4">
              {tierData.map(({ key, label, count, color }) => (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-foreground">
                    {label}{" "}
                    <span className="text-muted-foreground">
                      ({count.toLocaleString()})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Tier Definitions */}
        {loading ? (
          <ContextSkeleton />
        ) : (
          <Card className="p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Tier Definitions
            </h3>
            <div className="space-y-3">
              {tierData.map((t) => (
                <div
                  key={t.key}
                  className="p-3 rounded-lg bg-secondary/30 border border-border/50"
                >
                  <TierBadge tier={t.label} size="sm" />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {t.label === "High"
                      ? "Highest engagement group in their room (attendance, code, quiz, etc.)"
                      : t.label === "Disengaged"
                        ? "Lowest engagement group — consistently low activity relative to peers"
                        : "Middle engagement group based on composite score across early activity features"}
                  </p>
                </div>
              ))}

              <div className="p-3 rounded-lg border border-dashed border-border/50">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Note:</span>{" "}
                  Tiers are assigned per-room per-course. A student may receive
                  different labels in different courses, so total labels (
                  {totalTierLabels.toLocaleString()}) exceeds cohort size (
                  {overview?.cohort_students}).
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ────────── 4. ROOM OVERVIEW (Only show if "All" is selected) ────────── */}
      {loading ? (
        <RoomsSkeleton />
      ) : selectedRoomId === "All" && (
        <div className="grid grid-cols-3 gap-6">
          {/* Top 10 rooms grid */}
          <Card className="col-span-2 p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Room Performance{" "}
              <span className="text-sm font-normal text-muted-foreground">
                — Top 10 by student count
              </span>
            </h3>
            <div className="grid grid-cols-5 gap-3">
                {topRooms.map((room) => {
                const roomTierCounts = room.tier_counts ?? {}
                const high = (roomTierCounts as Record<string, number | undefined>).high ?? 0
                const low = (roomTierCounts as Record<string, number | undefined>).low ?? 0
                const moderate =
                  (roomTierCounts as Record<string, number | undefined>).moderate ?? 0
                const disengaged =
                  (roomTierCounts as Record<string, number | undefined>).disengaged ?? 0
                const total = high + low + moderate + disengaged
                const highRatio = total > 0 ? high / total : 0

                return (
                  <div
                    key={room.room_id}
                    className="p-3 rounded-lg bg-secondary/30 border border-border/50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {room.room_id}
                      </p>
                      {highRatio >= 0.2 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-tier-high shrink-0" />
                      ) : disengaged > 0 ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-tier-disengaged shrink-0" />
                      ) : (
                        <Activity className="w-3.5 h-3.5 text-tier-mid shrink-0" />
                      )}
                    </div>
                    {room.room_type && (
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium mb-1 ${
                        room.room_type === "weekly"
                          ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          : "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                      }`}>
                        {room.room_type === "weekly" ? "Weekly" : "Self-paced"}
                      </span>
                    )}
                    <p className="text-2xl font-bold text-foreground">
                      {room.n_students}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Number(room.n_sessions_avg ?? 0).toFixed(1)} avg sessions
                    </p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {high > 0 && <TierBadge tier="High" size="sm" />}
                      {moderate > 0 && <TierBadge tier="Moderate" size="sm" />}
                      {low > 0 && <TierBadge tier="Low" size="sm" />}
                      {disengaged > 0 && <TierBadge tier="Disengaged" size="sm" />}
                    </div>
                    <div className="mt-2 w-full h-1.5 rounded-full bg-secondary overflow-hidden flex">
                      {high > 0 && (
                        <div
                          className="h-full"
                          style={{
                            width: `${(high / total) * 100}%`,
                            backgroundColor: TIER_COLORS.high,
                          }}
                        />
                      )}
                      {moderate > 0 && (
                        <div
                          className="h-full"
                          style={{
                            width: `${(moderate / total) * 100}%`,
                            backgroundColor: TIER_COLORS.moderate,
                          }}
                        />
                      )}
                      {low > 0 && (
                        <div
                          className="h-full"
                          style={{
                            width: `${(low / total) * 100}%`,
                            backgroundColor: TIER_COLORS.low,
                          }}
                        />
                      )}
                      {disengaged > 0 && (
                        <div
                          className="h-full"
                          style={{
                            width: `${(disengaged / total) * 100}%`,
                            backgroundColor: TIER_COLORS.disengaged,
                          }}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Room Size Distribution Histogram */}
          <Card className="p-5">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Room Size Distribution
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {rooms?.length ?? 0} cohort rooms
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roomSizeBins} margin={{ bottom: 16 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(0.28 0.04 250)"
                  />
                  <XAxis
                    dataKey="range"
                    stroke="oklch(0.65 0.02 250)"
                    fontSize={10}
                    label={{
                      value: "students per room",
                      position: "insideBottom",
                      offset: -8,
                      fontSize: 10,
                      fill: "oklch(0.55 0.02 250)",
                    }}
                  />
                  <YAxis
                    stroke="oklch(0.65 0.02 250)"
                    fontSize={10}
                    allowDecimals={false}
                    label={{
                      value: "rooms",
                      angle: -90,
                      position: "insideLeft",
                      offset: 8,
                      fontSize: 10,
                      fill: "oklch(0.55 0.02 250)",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.18 0.035 250)",
                      border: "1px solid oklch(0.28 0.04 250)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`${value} rooms`, "Count"]}
                  />
                  <Bar
                    dataKey="count"
                    radius={[4, 4, 0, 0]}
                    fill="oklch(0.6 0.15 250)"
                    fillOpacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
