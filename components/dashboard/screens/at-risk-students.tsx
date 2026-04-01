"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { TierBadge } from "@/components/dashboard/tier-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, Users, BookOpen, Clock, Lightbulb, AlertCircle, Download, ExternalLink } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchStudents } from "@/lib/fetch-data"
import { isSpam, downloadCSV } from "@/lib/utils"
import { useDashboard } from "@/lib/dashboard-context"
import type { StudentRecord } from "@/lib/types"

export function AtRiskStudents() {
  const { navigateTo, filters, setFilters } = useDashboard()
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState<string[]>(["All Courses"])
  
  // Use context filters for persistence across screens
  const selectedCourse = filters.selectedCourseId === "All" ? "All Courses" : filters.selectedCourseId
  const hideSpam = filters.hideSpam
  const searchQuery = filters.searchQuery
  
  // Update context when filters change
  const setSelectedCourse = (value: string) => setFilters({ selectedCourseId: value === "All Courses" ? "All" : value })
  const setHideSpam = (value: boolean) => setFilters({ hideSpam: value })
  const setSearchQuery = (value: string) => setFilters({ searchQuery: value })

  const handleStudentClick = (student: StudentRecord) => {
    navigateTo({
      screen: "student-detail",
      studentId: student.student_id,
      courseId: student.course_id || student.room_id,
    })
  }

  useEffect(() => {
    fetchStudents()
      .then((data) => {
        setStudents(data)
        const courseIds = Array.from(new Set(data.map((s) => s.course_id || s.room_id))).sort()
        setCourses(["All Courses", ...courseIds])
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.predicted_tier !== "disengaged" && s.predicted_tier !== "low") return false
      if (selectedCourse !== "All Courses" && (s.course_id || s.room_id) !== selectedCourse) return false
      if (hideSpam && isSpam(s)) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !s.student_id.toLowerCase().includes(q) &&
          !(s.student_display_id ?? "").toLowerCase().includes(q) &&
          !s.student_name.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [students, selectedCourse, hideSpam, searchQuery])

  const riskFactors = useMemo(() => {
    const factors = {
      no_activity: 0,
      very_low_duration: 0,
      no_code_submissions: 0,
      no_quizzes: 0,
    }

    filteredStudents.forEach((s) => {
      if (s.n_sessions_early === 0) factors.no_activity++
      if ((s.total_dur_early || 0) < 10) factors.very_low_duration++
      if ((s.n_codesubmit_early || 0) === 0) factors.no_code_submissions++
      if ((s.n_quiz_early || 0) === 0) factors.no_quizzes++
    })

    return factors
  }, [filteredStudents])

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
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            At-Risk Students
          </h2>
          <p className="text-muted-foreground">
            Monitor and intervene with students predicted as Disengaged or Low
          </p>
        </div>
        <Select value={selectedCourse} onValueChange={setSelectedCourse} aria-label="Filter by course">
          <SelectTrigger className="w-[200px]" aria-label="Select course filter">
            <SelectValue placeholder="All Courses" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course} value={course}>
                {course}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          title="Total At-Risk"
          value={filteredStudents.length}
          subtitle="Disengaged or Low tier"
          icon={Users}
        />
        <KpiCard
          title="No Activity"
          value={riskFactors.no_activity}
          subtitle="Zero early sessions"
          icon={Clock}
        />
        <KpiCard
          title="No Code Subs"
          value={riskFactors.no_code_submissions}
          subtitle="Has not submitted code"
          icon={BookOpen}
        />
        <KpiCard
          title="No Quizzes"
          value={riskFactors.no_quizzes}
          subtitle="Has not attempted quizzes"
          icon={Lightbulb}
        />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-foreground">
            Student Intervention List
          </h3>
          <Badge variant="outline" className="text-amber-500 border-amber-500/50 bg-amber-500/10">
            {filteredStudents.length} Students need attention
          </Badge>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="Search student ID, name..."
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
          <button
            onClick={() => downloadCSV(filteredStudents as unknown as Record<string, unknown>[], `at_risk_students_${selectedCourse}_${new Date().toISOString().split('T')[0]}.csv`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
            aria-label="Export to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Student Info
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Course ID
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Room Type
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Predicted Tier
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  P(Disengaged)
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  P(High)
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Risk Level
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Sessions
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Attend %
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Key Warning Signs
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Flags
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const isDisengaged = student.predicted_tier === "disengaged"
                const warnings = []
                if (student.n_sessions_early === 0) warnings.push("No Activity")
                if ((student.n_codesubmit_early || 0) === 0) warnings.push("No Code Submissions")
                if ((student.n_quiz_early || 0) === 0) warnings.push("No Quizzes")
                if ((student.total_dur_early || 0) > 0 && (student.total_dur_early || 0) < 10) warnings.push("Very Low Duration")

                return (
                  <tr
                    key={`${student.student_display_id ?? student.student_id}-${student.course_id || student.room_id}`}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => handleStudentClick(student)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {student.student_display_id ?? student.student_name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {student.student_id}
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                      {student.course_id || student.room_id}
                    </td>
                    <td className="py-3 px-4">
                      {student.room_type && (
                        <Badge variant="outline" className={`text-xs ${
                          student.room_type === "weekly"
                            ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                            : "bg-purple-500/10 text-purple-600 border-purple-500/30"
                        }`}>
                          {student.room_type === "weekly" ? "Weekly" : "Self-paced"}
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <TierBadge tier={isDisengaged ? "Disengaged" : "Low"} />
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground font-medium">
                      {student.p_disengaged != null ? `${(student.p_disengaged * 100).toFixed(1)}%` : "N/A"}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground font-medium">
                      {student.p_high != null ? `${(student.p_high * 100).toFixed(1)}%` : "N/A"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isDisengaged ? "bg-red-500" : "bg-amber-500"
                          }`}
                        />
                        <span className="text-sm font-medium">
                          {isDisengaged ? "Critical" : "Warning"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {student.n_sessions_early ?? 0}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {student.attend_frac_early != null ? `${(student.attend_frac_early * 100).toFixed(1)}%` : "N/A"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2 flex-wrap">
                        {warnings.length > 0 ? (
                          warnings.map((w, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20"
                            >
                              {w}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Model predicted based on pattern
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {isSpam(student) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          High event rate
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-muted-foreground">
                    No at-risk students found for this selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

