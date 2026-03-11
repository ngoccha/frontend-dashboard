export type TierCounts = Record<string, number>

export interface OverviewData {
  total_events_raw: number
  total_students_raw: number
  total_rooms_raw: number
  date_min: string
  date_max: string
  cohort_students: number
  cohort_rooms: number
  cohort_courses: number
  tier_counts: TierCounts
  predicted_tier_counts?: TierCounts
  n_features: number
  best_model: string
  best_accuracy: number
  best_f1: number
  best_auc: number
  train_timestamp: string
  features_used: string[]
  config: Record<string, number | string>
}

export interface RoomInfo {
  room_id: string
  n_students: number
  n_sessions_avg: number
  tier_counts: Partial<TierCounts>
}

export interface StudentRecord {
  student_id: string
  room_id: string
  student_name: string
  label_full: string
  label_early: string
  predicted_tier: string
  p_disengaged: number | null
  p_high: number | null
  n_sessions_early: number
  total_dur_early: number
  n_codesubmit_early: number
  n_quiz_early: number
  n_raisehand_early: number
  n_help_early: number
  n_sessions_full: number
  attend_frac_early: number
  has_prediction: boolean
}

export interface SessionActivity {
  session_idx: number
  avg_events: number
  avg_dur_min: number
  n_students: number
}

export type SessionActivityByTier = Record<
  string,
  SessionActivity[]
>

export interface StudentSessionEntry {
  session_idx: number
  n_events: number
  dur_min: number
  t_start: string
  actions: Record<string, number>
}

export type StudentSessionsDetail = Record<string, StudentSessionEntry[]>

export interface ModelMetric {
  model: string
  accuracy: number
  macro_f1: number
  auc: number
  precision_macro: number
  recall_macro: number
  precision_disengaged: number
  recall_disengaged: number
  precision_high: number
  recall_high: number
  best_params: Record<string, number | string>
  train_size: number
  test_size: number
}

export interface ConfusionMatrixData {
  matrix: number[][]
  labels: string[]
}

export type ConfusionMatrices = Record<string, ConfusionMatrixData>

export interface RocCurve {
  fpr: number[]
  tpr: number[]
  auc: number
}

export type RocData = Record<string, RocCurve>

export interface ShapFeature {
  feature: string
  mean_abs_shap: number
}

export interface ShapLocalExplanation {
  student_id: string
  room_id: string
  student_name: string
  predicted_tier: string
  // optional true label field; in current JSON we only have label_full at student-level
  true_tier?: string
  p_high: number
  p_disengaged: number
  top_features: {
    feature: string
    shap_value: number
    feature_value: number
    raw_value?: number
  }[]
  reasons?: string[]
  suggestions?: string[]
}

export type FeatureDescriptions = Record<string, string>

export interface ThresholdPoint {
  threshold: number
  recall: number
  precision: number
  f1: number
}

export interface TransitionMatrix {
  counts: Record<string, Record<string, number>>
  percentages: Record<string, Record<string, number>>
  stability: number
}
