"use client"

import { cn } from "@/lib/utils"
import type { ScreenName } from "@/lib/dashboard-context"
import {
  LayoutDashboard,
  Users,
  UserCircle,
  BarChart3,
  Brain,
  AlertTriangle,
  GraduationCap,
  DoorOpen,
} from "lucide-react"

interface SidebarProps {
  activeItem: ScreenName
  onItemChange: (item: ScreenName) => void
}

const menuItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "rooms", label: "Rooms", icon: DoorOpen },
  { id: "class-engagement", label: "Class Engagement", icon: Users },
  { id: "student-detail", label: "Student Detail", icon: UserCircle },
  { id: "model-metrics", label: "Model & Metrics", icon: BarChart3 },
  { id: "xai-insights", label: "XAI Insights", icon: Brain },
  { id: "at-risk", label: "At-Risk Students", icon: AlertTriangle },
]

export function Sidebar({ activeItem, onItemChange }: SidebarProps) {
  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground text-sm">SmartDoc</h1>
            <p className="text-xs text-muted-foreground">Engagement</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => onItemChange(item.id as ScreenName)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <Icon className={cn("w-5 h-5", isActive && "text-sidebar-primary")} />
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">
          v1.0.0 - Predictive Analytics
        </p>
      </div>
    </aside>
  )
}
