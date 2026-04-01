import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { StudentRecord } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** True if this student has a model prediction (from field or derived from predicted_tier / p_high / p_disengaged). */
export function hasPrediction(s: StudentRecord): boolean {
  if (s.has_prediction === true) return true
  return (
    (s.predicted_tier != null && String(s.predicted_tier).trim() !== '') ||
    typeof s.p_high === 'number' ||
    typeof s.p_disengaged === 'number'
  )
}

// ============================================================================
// Tier Colors - Centralized color scheme for engagement tiers
// ============================================================================

export const TIER_COLORS: Record<string, string> = {
  high: "oklch(0.75 0.18 145)",      // Green
  moderate: "oklch(0.75 0.15 85)",   // Yellow
  low: "oklch(0.70 0.15 50)",        // Orange
  disengaged: "oklch(0.65 0.20 25)", // Red
}

export const TIER_TEXT_COLORS: Record<string, string> = {
  high: "text-green-400",
  moderate: "text-yellow-400",
  low: "text-orange-400",
  disengaged: "text-red-400",
}

export const TIER_BG_COLORS: Record<string, string> = {
  high: "bg-green-500/20",
  moderate: "bg-yellow-500/20",
  low: "bg-orange-500/20",
  disengaged: "bg-red-500/20",
}

export const TIER_ORDER = ["disengaged", "low", "moderate", "high"] as const
export type TierName = typeof TIER_ORDER[number]

// ============================================================================
// Spam Detection - Students with unusually high event rates
// ============================================================================

export const SPAM_THRESHOLD_EVENTS_PER_MIN = 8

/** 
 * Checks if a student is likely spam/bot based on high event rate.
 * Students with >8 events/minute or is_spam flag are considered spam.
 */
export function isSpam(s: StudentRecord): boolean {
  if (s.is_spam === 1) return true
  const epm = s.events_per_min_early
  return typeof epm === "number" && epm > SPAM_THRESHOLD_EVENTS_PER_MIN
}

// ============================================================================
// Export Utilities
// ============================================================================

/**
 * Convert data array to CSV string
 */
export function toCSV<T extends Record<string, unknown>>(data: T[], columns?: (keyof T)[]): string {
  if (data.length === 0) return ""
  
  const cols = columns ?? (Object.keys(data[0]) as (keyof T)[])
  const header = cols.map(c => String(c)).join(",")
  
  const rows = data.map(row => 
    cols.map(col => {
      const val = row[col]
      if (val === null || val === undefined) return ""
      const str = String(val)
      // Escape quotes and wrap in quotes if contains comma or quote
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(",")
  )
  
  return [header, ...rows].join("\n")
}

/**
 * Download data as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string = "text/csv") {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Download data as CSV
 */
export function downloadCSV<T extends Record<string, unknown>>(
  data: T[], 
  filename: string,
  columns?: (keyof T)[]
) {
  const csv = toCSV(data, columns)
  downloadFile(csv, filename.endsWith(".csv") ? filename : `${filename}.csv`)
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format a number as percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format duration in minutes to human readable
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/**
 * Format large numbers with K/M suffix
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toFixed(0)
}
