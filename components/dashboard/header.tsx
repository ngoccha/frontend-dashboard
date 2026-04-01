"use client"

import { useState, useMemo, useEffect } from "react"
import { ChevronDown, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { TierBadge, type TierLevel } from "@/components/dashboard/tier-badge"
import { fetchStudents } from "@/lib/fetch-data"
import type { StudentRecord } from "@/lib/types"

interface HeaderProps {
  selectedRoom: string
  onRoomChange: (room: string) => void
  rooms: string[]
  onStudentSelect?: (studentId: string, courseId: string) => void
}

export function Header({ selectedRoom, onRoomChange, rooms, onStudentSelect }: HeaderProps) {
  const [roomSearch, setRoomSearch] = useState("")
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loading, setLoading] = useState(false)

  // Load students for global search
  useEffect(() => {
    if (globalSearchOpen && students.length === 0) {
      setLoading(true)
      fetchStudents()
        .then(setStudents)
        .finally(() => setLoading(false))
    }
  }, [globalSearchOpen, students.length])

  // Listen for Cmd+K / Ctrl+K to open global search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setGlobalSearchOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const filteredRooms = useMemo(
    () =>
      rooms.filter((r) =>
        r.toLowerCase().includes(roomSearch.toLowerCase())
      ),
    [rooms, roomSearch]
  )

  const handleStudentClick = (student: StudentRecord) => {
    setGlobalSearchOpen(false)
    if (onStudentSelect) {
      onStudentSelect(student.student_id, student.course_id || student.room_id)
    }
  }

  return (
    <>
      <header className="h-16 bg-card border-b border-border flex items-center px-6 justify-between">
        <div className="flex items-center gap-4">
          <DropdownMenu onOpenChange={(open) => { if (!open) setRoomSearch("") }}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-[160px] justify-between">
                {selectedRoom}
                <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="px-2 py-1.5">
                <Input
                  placeholder="Search rooms..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  className="h-8 text-sm"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredRooms.map((room) => (
                  <DropdownMenuItem key={room} onClick={() => onRoomChange(room)}>
                    {room}
                  </DropdownMenuItem>
                ))}
                {filteredRooms.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">
                    No rooms found
                  </p>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Global Search Button */}
        <div className="flex-1 max-w-md mx-auto">
          <button
            onClick={() => setGlobalSearchOpen(true)}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground bg-secondary/50 border border-border rounded-lg hover:bg-secondary transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Search students by name, ID, or course...</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>
      </header>

      {/* Global Search Dialog */}
      <CommandDialog open={globalSearchOpen} onOpenChange={setGlobalSearchOpen}>
        <CommandInput placeholder="Type student name, ID, or course..." />
        <CommandList>
          <CommandEmpty>{loading ? "Loading students..." : "No students found."}</CommandEmpty>
          <CommandGroup heading="Students">
            {students.map((student) => {
              const tierKey = student.predicted_tier?.toLowerCase() ?? ""
              const tierLabel = tierKey ? (tierKey.charAt(0).toUpperCase() + tierKey.slice(1)) as TierLevel : undefined
              
              return (
                <CommandItem
                  key={`${student.student_id}-${student.course_id || student.room_id}`}
                  value={`${student.student_name} ${student.student_id} ${student.student_display_id} ${student.course_id || student.room_id}`}
                  onSelect={() => handleStudentClick(student)}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {student.student_display_id || student.student_name}
                      </span>
                      {tierLabel && <TierBadge tier={tierLabel} size="sm" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono truncate">{student.student_id.slice(0, 20)}...</span>
                      <span>•</span>
                      <span className="truncate">{student.course_id || student.room_id}</span>
                    </div>
                  </div>
                  {student.p_disengaged != null && student.p_disengaged > 0.5 && (
                    <span className="text-xs text-red-500 font-medium shrink-0">
                      {(student.p_disengaged * 100).toFixed(0)}% disengaged
                    </span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
