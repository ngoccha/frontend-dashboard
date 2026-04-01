"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { Overview } from "./screens/overview"
import { RoomsList } from "./screens/rooms-list"
import { ClassEngagement } from "./screens/class-engagement"
import { StudentDetail } from "./screens/student-detail"
import { ModelMetrics } from "./screens/model-metrics"
import { XaiInsights } from "./screens/xai-insights"
import { AtRiskStudents } from "./screens/at-risk-students"
import { DashboardProvider, useDashboard } from "@/lib/dashboard-context"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { fetchRooms } from "@/lib/fetch-data"

function DashboardContent() {
  const { activeScreen, setActiveScreen, navigateTo, filters, setFilters } = useDashboard()
  const [rooms, setRooms] = useState<string[]>(["All Rooms"])
  const [loadingRooms, setLoadingRooms] = useState(true)

  useEffect(() => {
    fetchRooms()
      .then((data) => {
        const roomIds = data.map(r => r.room_id).sort()
        setRooms(["All Rooms", ...roomIds])
      })
      .finally(() => setLoadingRooms(false))
  }, [])

  const handleStudentSelect = (studentId: string, courseId: string) => {
    navigateTo({
      screen: "student-detail",
      studentId,
      courseId,
    })
  }

  const handleRoomChange = (room: string) => {
    setFilters({ selectedCourseId: room === "All Rooms" ? "All" : room })
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case "overview":
        return <ErrorBoundary key="overview"><Overview /></ErrorBoundary>
      case "rooms":
        return <ErrorBoundary key="rooms"><RoomsList /></ErrorBoundary>
      case "class-engagement":
        return <ErrorBoundary key="class-engagement"><ClassEngagement /></ErrorBoundary>
      case "student-detail":
        return <ErrorBoundary key="student-detail"><StudentDetail /></ErrorBoundary>
      case "model-metrics":
        return <ErrorBoundary key="model-metrics"><ModelMetrics /></ErrorBoundary>
      case "xai-insights":
        return <ErrorBoundary key="xai-insights"><XaiInsights /></ErrorBoundary>
      case "at-risk":
        return <ErrorBoundary key="at-risk"><AtRiskStudents /></ErrorBoundary>
      default:
        return <ErrorBoundary key="default"><ClassEngagement /></ErrorBoundary>
    }
  }

  const selectedRoom = filters.selectedCourseId === "All" ? "All Rooms" : filters.selectedCourseId

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeItem={activeScreen} onItemChange={setActiveScreen} />
      <div className="flex-1 flex flex-col">
        {!loadingRooms && (
          <Header 
            selectedRoom={selectedRoom}
            onRoomChange={handleRoomChange}
            rooms={rooms}
            onStudentSelect={handleStudentSelect}
          />
        )}
        <main className="flex-1 p-6 overflow-auto">
          {renderScreen()}
        </main>
      </div>
    </div>
  )
}

export function Dashboard() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  )
}
