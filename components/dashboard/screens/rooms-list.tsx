"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { TierBadge, type TierLevel } from "@/components/dashboard/tier-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, ChevronDown, ChevronRight, Search, Users, X } from "lucide-react"
import { fetchRooms, fetchStudents } from "@/lib/fetch-data"
import type { RoomInfo, StudentRecord } from "@/lib/types"

const TIER_COLORS: Record<string, string> = {
  high: "oklch(0.7 0.18 145)",
  moderate: "oklch(0.8 0.16 85)",
  low: "oklch(0.78 0.12 70)",
  disengaged: "oklch(0.65 0.18 25)",
}

const TIER_ORDER = ["disengaged", "low", "moderate", "high"]

const ROOM_TYPE_STYLE: Record<string, string> = {
  weekly: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  selfpaced: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
}

function isSpam(s: StudentRecord): boolean {
  if (s.is_spam !== undefined) return s.is_spam === 1
  const epm = s.events_per_min_early
  if (epm !== undefined) return epm > 8
  const dur = s.total_dur_early ?? 0
  const events = typeof s.n_active_early === "number" ? s.n_active_early : 0
  if (dur <= 0 || events <= 0) return false
  return events / dur > 8
}

function TierBar({ counts, total }: { counts: Partial<Record<string, number>>; total: number }) {
  if (total === 0) return <div className="w-full h-2 rounded-full bg-secondary" />
  return (
    <div className="w-full h-2 rounded-full overflow-hidden flex">
      {TIER_ORDER.map((key) => {
        const count = counts[key] ?? 0
        const pct = (count / total) * 100
        if (pct === 0) return null
        return (
          <div
            key={key}
            style={{ width: `${pct}%`, backgroundColor: TIER_COLORS[key] }}
            title={`${key}: ${count}`}
          />
        )
      })}
    </div>
  )
}

function StudentRow({ s }: { s: StudentRecord }) {
  const spam = isSpam(s)
  const tierKey = s.predicted_tier?.toLowerCase() ?? ""
  const tierLabel = (tierKey.charAt(0).toUpperCase() + tierKey.slice(1)) as TierLevel

  return (
    <tr className="border-b border-border/40 hover:bg-muted/20 transition-colors">
      <td className="py-2 px-3 text-sm font-mono text-foreground">
        {s.student_display_id ?? s.student_id}
      </td>
      <td className="py-2 px-3 text-sm text-foreground">{s.student_name}</td>
      <td className="py-2 px-3">
        {tierKey ? <TierBadge tier={tierLabel} size="sm" /> : <span className="text-muted-foreground text-xs">—</span>}
      </td>
      <td className="py-2 px-3 text-sm text-foreground">{s.n_sessions_early ?? "—"}</td>
      <td className="py-2 px-3 text-sm text-foreground">
        {s.p_disengaged != null ? `${(s.p_disengaged * 100).toFixed(1)}%` : "—"}
      </td>
      <td className="py-2 px-3">
        {spam && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            High event rate
          </span>
        )}
      </td>
    </tr>
  )
}

function RoomRow({
  room,
  students,
  query,
}: {
  room: RoomInfo
  students: StudentRecord[]
  query: string
}) {
  const [expanded, setExpanded] = useState(false)
  const isSelfPaced = room.room_type === "selfpaced"

  const tierCounts = room.tier_counts ?? {}
  const total = TIER_ORDER.reduce((s, k) => s + ((tierCounts as Record<string, number>)[k] ?? 0), 0)

  const roomStudents = useMemo(
    () => students.filter((s) => (s.course_id || s.room_id) === room.room_id),
    [students, room.room_id],
  )

  const filteredStudents = useMemo(() => {
    if (!query) return roomStudents
    const q = query.toLowerCase()
    return roomStudents.filter(
      (s) =>
        s.student_id.toLowerCase().includes(q) ||
        (s.student_display_id ?? "").toLowerCase().includes(q) ||
        s.student_name.toLowerCase().includes(q),
    )
  }, [roomStudents, query])

  const spamCount = room.n_spam ?? roomStudents.filter(isSpam).length

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-mono font-medium text-foreground">{room.room_id}</span>
          </div>
        </td>
        <td className="py-3 px-4">
          {room.room_type ? (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROOM_TYPE_STYLE[room.room_type] ?? ""}`}>
              {room.room_type === "weekly" ? "Weekly" : "Self-paced"}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
        <td className="py-3 px-4 text-sm text-foreground">{room.n_students}</td>
        <td className="py-3 px-4 w-40">
          <TierBar counts={tierCounts as Record<string, number>} total={total} />
          <p className="text-[10px] text-muted-foreground mt-1">
            {TIER_ORDER.map((k) => {
              const c = (tierCounts as Record<string, number>)[k] ?? 0
              return c > 0 ? `${k[0].toUpperCase()}:${c}` : null
            })
              .filter(Boolean)
              .join("  ")}
          </p>
        </td>
        <td className="py-3 px-4 text-sm text-foreground">
          {Number(room.n_sessions_avg ?? 0).toFixed(1)}
        </td>
        <td className="py-3 px-4">
          {spamCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {spamCount} flagged
            </span>
          )}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="bg-secondary/20 border-b border-border px-6 py-4">
              {isSelfPaced && (
                <div className="flex items-start gap-2 mb-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>
                    <span className="font-semibold">Self-paced room.</span> This room is shared across multiple classes. Students may appear to have low session counts because each class contributes only a subset of the total activity. Attendance-based metrics should be interpreted with caution.
                  </p>
                </div>
              )}

              {filteredStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {query ? "No students match the search." : "No student data available for this room."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <p className="text-xs text-muted-foreground mb-2">
                    {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}
                    {query && ` matching "${query}"`}
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Student ID</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Predicted Tier</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Sessions (early)</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">P(Disengaged)</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s) => (
                        <StudentRow key={`${s.student_id}-${s.course_id}`} s={s} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function RoomsList() {
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"All" | "weekly" | "selfpaced">("All")

  useEffect(() => {
    Promise.all([fetchRooms(), fetchStudents()])
      .then(([rm, st]) => {
        setRooms(rm)
        setStudents(st)
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredRooms = useMemo(() => {
    const q = query.toLowerCase()
    return rooms.filter((r) => {
      const matchType = typeFilter === "All" || r.room_type === typeFilter
      const matchQuery = !q || r.room_id.toLowerCase().includes(q)
      return matchType && matchQuery
    })
  }, [rooms, query, typeFilter])

  const totalWeekly = rooms.filter((r) => r.room_type === "weekly").length
  const totalSelfPaced = rooms.filter((r) => r.room_type === "selfpaced").length

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-80" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Rooms</h2>
        <p className="text-muted-foreground">
          Browse all {rooms.length} rooms — {totalWeekly} weekly, {totalSelfPaced} self-paced
        </p>
      </div>

      {/* Self-paced global note */}
      <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold">Self-paced rooms are shared across multiple classes.</span>{" "}
          A student enrolled in a self-paced room may not appear to attend many sessions because each class only occupies a portion of the room timeline. Absence in session count does not mean the student is disengaged — interpret attendance features with caution for self-paced rooms.
        </p>
      </div>

      {/* Search and filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search room ID, student name or student ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(["All", "weekly", "selfpaced"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 transition-colors ${
                typeFilter === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {t === "All" ? "All Types" : t === "weekly" ? "Weekly" : "Self-paced"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{filteredRooms.length} room{filteredRooms.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Rooms table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Room ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Students</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-44">Tier Distribution</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Avg Sessions</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Flags</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                    No rooms match your search.
                  </td>
                </tr>
              ) : (
                filteredRooms.map((room) => (
                  <RoomRow
                    key={room.room_id}
                    room={room}
                    students={students}
                    query={query}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
