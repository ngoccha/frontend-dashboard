"use client"

import { useEffect, useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { TierBadge, type TierLevel } from "@/components/dashboard/tier-badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  User,
  BookOpen,
  Clock,
  Lightbulb,
  Bot,
  AlertCircle,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  BarChart3,
} from "lucide-react"
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
  Legend,
  Cell,
} from "recharts"
import { fetchShapLocal, fetchStudentSessions, fetchStudents } from "@/lib/fetch-data"
import type { ShapLocalExplanation, StudentSessionsDetail, StudentRecord } from "@/lib/types"

const ACTIVITY_COLORS: Record<string, string> = {
  codesubmit: "oklch(0.65 0.15 250)",
  quiz: "oklch(0.7 0.18 145)",
  raisehand: "oklch(0.8 0.16 85)",
  aitutor: "oklch(0.6 0.15 280)",
  scrollposition: "oklch(0.7 0.12 30)",
  help: "oklch(0.65 0.18 330)",
}

function getActivityColor(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z]/g, "")
  return ACTIVITY_COLORS[key] ?? "oklch(0.6 0.1 200)"
}

function capitalizeTier(tier: string): TierLevel {
  const map: Record<string, TierLevel> = {
    high: "High",
    moderate: "Moderate",
    low: "Low",
    disengaged: "Disengaged",
  }
  return map[tier.toLowerCase()] ?? "Moderate"
}

interface StudentDetailProps {
  studentId?: string
}

export function StudentDetail({ studentId: propStudentId }: StudentDetailProps) {
  const [shapData, setShapData] = useState<ShapLocalExplanation[] | null>(null)
  const [sessionsData, setSessionsData] = useState<StudentSessionsDetail | null>(null)
  const [studentsData, setStudentsData] = useState<StudentRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchShapLocal(), fetchStudentSessions(), fetchStudents()])
      .then(([shap, sessions, students]) => {
        setShapData(shap)
        setSessionsData(sessions)
        setStudentsData(students)

        if (propStudentId) {
          const match = shap.find((s) => s.student_id === propStudentId)
          if (match) {
            setSelectedKey(`${match.student_id}|${match.room_id}`)
          } else if (shap.length > 0) {
            setSelectedKey(`${shap[0].student_id}|${shap[0].room_id}`)
          }
        } else if (shap.length > 0) {
          setSelectedKey(`${shap[0].student_id}|${shap[0].room_id}`)
        }
      })
      .finally(() => setLoading(false))
  }, [propStudentId])

  const currentShap = useMemo(() => {
    if (!shapData || !selectedKey) return null
    const [sid, rid] = selectedKey.split("|")
    return shapData.find((s) => s.student_id === sid && s.room_id === rid) ?? null
  }, [shapData, selectedKey])

  const currentStudentRecord = useMemo(() => {
    if (!studentsData || !currentShap) return null
    return (
      studentsData.find(
        (s) => s.student_id === currentShap.student_id && s.room_id === currentShap.room_id,
      ) ?? null
    )
  }, [studentsData, currentShap])

  const sessionTimeline = useMemo(() => {
    if (!sessionsData || !selectedKey) return []
    const entries = sessionsData[selectedKey]
    if (!entries) return []
    return entries.map((e) => ({
      session: `S${e.session_idx}`,
      events: e.n_events,
      duration: Math.round(e.dur_min * 100) / 100,
    }))
  }, [sessionsData, selectedKey])

  const activityBreakdown = useMemo(() => {
    if (!sessionsData || !selectedKey) return []
    const entries = sessionsData[selectedKey]
    if (!entries) return []
    const totals: Record<string, number> = {}
    for (const session of entries) {
      for (const [action, count] of Object.entries(session.actions)) {
        totals[action] = (totals[action] ?? 0) + count
      }
    }
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value, color: getActivityColor(name) }))
      .sort((a, b) => b.value - a.value)
  }, [sessionsData, selectedKey])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!shapData || shapData.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Student Detail</h2>
          <p className="text-muted-foreground">
            Individual student engagement analysis and AI explanations
          </p>
        </div>
        <Card className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No prediction data available.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Student Detail</h2>
        <p className="text-muted-foreground">
          Individual student engagement analysis and AI explanations
        </p>
      </div>

      {/* Student Selector */}
      <Select value={selectedKey ?? undefined} onValueChange={setSelectedKey}>
        <SelectTrigger className="w-[360px]">
          <SelectValue placeholder="Select a student" />
        </SelectTrigger>
        <SelectContent>
          {shapData.map((s) => {
            const key = `${s.student_id}|${s.room_id}`
            return (
              <SelectItem key={key} value={key}>
                {s.student_name} — {s.room_id} ({capitalizeTier(s.predicted_tier)})
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      {!currentShap ? (
        <Card className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Select a student to view details.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {/* Left Panel - Student Info */}
          <Card className="p-5 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {currentShap.student_name}
                </h3>
                <p className="text-sm text-muted-foreground font-mono">
                  {currentShap.student_id.slice(0, 12)}…
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Room:</span>
                <span className="text-foreground">{currentShap.room_id}</span>
              </div>
                  {currentStudentRecord && (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Sessions (early):</span>
                        <span className="text-foreground">
                          {currentStudentRecord.n_sessions_early}
                        </span>
                      </div>
                      {currentStudentRecord.label_full && (
                        <div className="flex items-center gap-2 text-sm">
                          <BarChart3 className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">True tier:</span>
                          <TierBadge
                            tier={capitalizeTier(currentStudentRecord.label_full)}
                            size="sm"
                          />
                        </div>
                      )}
                    </>
                  )}
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">
                  Predicted Tier
                </span>
                <TierBadge tier={capitalizeTier(currentShap.predicted_tier)} size="lg" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-tier-high">P(High)</span>
                  <span className="font-medium text-tier-high">
                    {Number((currentShap.p_high ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={currentShap.p_high * 100} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-tier-disengaged">P(Disengaged)</span>
                  <span className="font-medium text-tier-disengaged">
                    {Number((currentShap.p_disengaged ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={currentShap.p_disengaged * 100} className="h-2" />
              </div>
            </div>
          </Card>

          {/* Middle Panel - Charts */}
          <Card className="p-5 space-y-6">
            {sessionTimeline.length > 0 ? (
              <>
                <div>
                  <h4 className="text-base font-semibold text-foreground mb-4">
                    Session Timeline
                  </h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sessionTimeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.04 250)" />
                        <XAxis
                          dataKey="session"
                          stroke="oklch(0.65 0.02 250)"
                          fontSize={11}
                        />
                        <YAxis stroke="oklch(0.65 0.02 250)" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "oklch(0.18 0.035 250)",
                            border: "1px solid oklch(0.28 0.04 250)",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="events"
                          name="Events"
                          stroke="oklch(0.65 0.15 250)"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="duration"
                          name="Duration (min)"
                          stroke="oklch(0.7 0.18 145)"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h4 className="text-base font-semibold text-foreground mb-4">
                    Activity Breakdown
                  </h4>
                  {activityBreakdown.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={activityBreakdown} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.04 250)" />
                          <XAxis type="number" stroke="oklch(0.65 0.02 250)" fontSize={11} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            stroke="oklch(0.65 0.02 250)"
                            fontSize={11}
                            width={100}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "oklch(0.18 0.035 250)",
                              border: "1px solid oklch(0.28 0.04 250)",
                              borderRadius: "8px",
                            }}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {activityBreakdown.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No activity data recorded.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <Clock className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-sm">
                  No session data available for this student/room combination.
                </p>
              </div>
            )}
          </Card>

          {/* Right Panel - Explanations */}
          <Card className="p-5 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-primary" />
                <h4 className="text-base font-semibold text-foreground">
                  Why this engagement tier?
                </h4>
              </div>
              {(currentShap.reasons ?? []).length > 0 ? (
                <ul className="space-y-3">
                  {(currentShap.reasons ?? []).map((reason, index) => (
                    <li key={index} className="flex items-start gap-2">
                      {reason.includes("increases") || reason.includes("↑") ? (
                        <TrendingUp className="w-4 h-4 text-tier-disengaged mt-0.5 shrink-0" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-tier-high mt-0.5 shrink-0" />
                      )}
                      <span className="text-sm text-foreground">{reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No explanation reasons available.</p>
              )}
            </div>

            {/* Top SHAP Features */}
            {currentShap.top_features.length > 0 && (
              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground mb-3">Top Features (SHAP)</h4>
                <div className="space-y-2">
                  {currentShap.top_features.slice(0, 6).map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[140px]" title={f.feature}>
                        {f.feature}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-mono">
                          {f.feature_value >= 0 ? "+" : ""}
                          {Number(f.feature_value ?? 0).toFixed(3)}
                        </span>
                        <span
                          className={
                            f.shap_value > 0
                              ? "text-tier-disengaged font-mono"
                              : "text-tier-high font-mono"
                          }
                        >
                          ({f.shap_value >= 0 ? "+" : ""}
                          {Number(f.shap_value ?? 0).toFixed(4)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-5 h-5 text-primary" />
                <h4 className="text-base font-semibold text-foreground">
                  Suggestions
                </h4>
              </div>
              {(currentShap.suggestions ?? []).length > 0 ? (
                <ul className="space-y-3">
                  {(currentShap.suggestions ?? []).map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-primary">
                          {index + 1}
                        </span>
                      </div>
                      <span className="text-sm text-foreground">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No suggestions available.</p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
