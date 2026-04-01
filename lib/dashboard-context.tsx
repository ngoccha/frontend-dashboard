"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

export type ScreenName = 
  | "overview" 
  | "rooms" 
  | "class-engagement" 
  | "student-detail" 
  | "model-metrics" 
  | "xai-insights" 
  | "at-risk"

interface DashboardFilters {
  selectedCourseId: string
  roomTypeFilter: "All" | "weekly" | "selfpaced"
  hideSpam: boolean
  searchQuery: string
}

interface NavigationTarget {
  screen: ScreenName
  studentId?: string
  courseId?: string
}

interface DashboardContextType {
  // Navigation
  activeScreen: ScreenName
  setActiveScreen: (screen: ScreenName) => void
  navigateTo: (target: NavigationTarget) => void
  
  // Global filters (persist across screens)
  filters: DashboardFilters
  setFilters: (filters: Partial<DashboardFilters>) => void
  resetFilters: () => void
  
  // Selected student for detail view
  selectedStudentId: string | null
  setSelectedStudentId: (id: string | null) => void
}

const defaultFilters: DashboardFilters = {
  selectedCourseId: "All",
  roomTypeFilter: "All",
  hideSpam: false,
  searchQuery: "",
}

const DashboardContext = createContext<DashboardContextType | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [activeScreen, setActiveScreen] = useState<ScreenName>("class-engagement")
  const [filters, setFiltersState] = useState<DashboardFilters>(defaultFilters)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)

  const setFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }))
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters)
  }, [])

  const navigateTo = useCallback((target: NavigationTarget) => {
    if (target.studentId) {
      setSelectedStudentId(target.studentId)
    }
    if (target.courseId) {
      setFilters({ selectedCourseId: target.courseId })
    }
    setActiveScreen(target.screen)
  }, [setFilters])

  return (
    <DashboardContext.Provider
      value={{
        activeScreen,
        setActiveScreen,
        navigateTo,
        filters,
        setFilters,
        resetFilters,
        selectedStudentId,
        setSelectedStudentId,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider")
  }
  return context
}
