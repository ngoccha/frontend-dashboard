"use client"

import { useState } from "react"
import { Sidebar } from "./sidebar"
import { Overview } from "./screens/overview"
import { RoomsList } from "./screens/rooms-list"
import { ClassEngagement } from "./screens/class-engagement"
import { StudentDetail } from "./screens/student-detail"
import { ModelMetrics } from "./screens/model-metrics"
import { XaiInsights } from "./screens/xai-insights"
import { AtRiskStudents } from "./screens/at-risk-students"

export function Dashboard() {
  const [activeScreen, setActiveScreen] = useState("class-engagement")

  const renderScreen = () => {
    switch (activeScreen) {
      case "overview":
        return <Overview />
      case "rooms":
        return <RoomsList />
      case "class-engagement":
        return <ClassEngagement />
      case "student-detail":
        return <StudentDetail />
      case "model-metrics":
        return <ModelMetrics />
      case "xai-insights":
        return <XaiInsights />
      case "at-risk":
        return <AtRiskStudents />
      default:
        return <ClassEngagement />
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeItem={activeScreen} onItemChange={setActiveScreen} />
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 overflow-auto">
          {renderScreen()}
        </main>
      </div>
    </div>
  )
}
