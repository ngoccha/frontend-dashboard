import type {
  OverviewData,
  RoomInfo,
  StudentRecord,
  SessionActivityByTier,
  ModelMetric,
  ConfusionMatrices,
  RocData,
  ShapFeature,
  ShapLocalExplanation,
  FeatureDescriptions,
  ThresholdPoint,
  TransitionMatrix,
  StudentSessionsDetail,
  AblationData,
} from "./types"

// Toggle between backend API and static files
const USE_BACKEND_API = true // Set to false to use static JSON files
const API_BASE_URL = "http://localhost:8000/api/data"
const STATIC_BASE_URL = "/data"

const BASE_URL = USE_BACKEND_API ? API_BASE_URL : STATIC_BASE_URL

const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000

async function fetchJson<T>(path: string): Promise<T> {
  const now = Date.now()
  const fullPath = USE_BACKEND_API ? `${BASE_URL}${path}` : `${BASE_URL}${path}`
  
  const cached = cache.get(fullPath)
  if (cached && now - cached.ts < CACHE_TTL) {
    return cached.data as T
  }
  
  const res = await fetch(fullPath)
  if (!res.ok) throw new Error(`Failed to fetch ${fullPath}: ${res.status}`)
  const data = await res.json()
  cache.set(fullPath, { data, ts: now })
  return data as T
}

export const fetchOverview = () =>
  fetchJson<OverviewData>(USE_BACKEND_API ? "/overview" : "/overview.json")

export const fetchRooms = async (): Promise<RoomInfo[]> => {
  const rooms = await fetchJson<RoomInfo[]>(USE_BACKEND_API ? "/rooms" : "/rooms_list.json")
  return rooms.map(r => ({ ...r, room_id: r.course_id || r.room_id }))
}

export const fetchStudents = async (): Promise<StudentRecord[]> => {
  const students = await fetchJson<StudentRecord[]>(USE_BACKEND_API ? "/students" : "/students_table.json")
  try {
    const predictions = await fetchJson<any[]>(USE_BACKEND_API ? "/student-predictions" : "/student_predictions.json")
    const activeMap = new Map(predictions.map(p => [p.student_id, p.n_active_early]))
    return students.map(s => ({
      ...s,
      room_id: s.course_id || s.room_id,
      n_active_early: activeMap.has(s.student_id) ? activeMap.get(s.student_id) : s.n_active_early
    }))
  } catch (e) {
    console.error("Failed to merge student_predictions.json", e)
    return students.map(s => ({ ...s, room_id: s.course_id || s.room_id }))
  }
}

export const fetchSessionActivity = () =>
  fetchJson<SessionActivityByTier>(USE_BACKEND_API ? "/session-activity" : "/session_activity_by_tier.json")

export const fetchModelComparison = () =>
  fetchJson<ModelMetric[]>(USE_BACKEND_API ? "/model-comparison" : "/model_comparison.json")

export const fetchConfusionMatrices = () =>
  fetchJson<ConfusionMatrices>(USE_BACKEND_API ? "/confusion-matrices" : "/confusion_matrices.json")

export const fetchRocData = () =>
  fetchJson<RocData>(USE_BACKEND_API ? "/roc-data" : "/roc_data.json")

export const fetchShapGlobal = () =>
  fetchJson<ShapFeature[]>(USE_BACKEND_API ? "/shap-global" : "/shap_global.json")

export const fetchShapLocal = async (): Promise<ShapLocalExplanation[]> => {
  const shap = await fetchJson<any[]>(USE_BACKEND_API ? "/shap-local" : "/shap_local_explanations.json")
  return shap.map(s => ({ ...s, room_id: s.course_id || s.room_id }))
}

export const fetchFeatureDescriptions = () =>
  fetchJson<FeatureDescriptions>(USE_BACKEND_API ? "/feature-descriptions" : "/feature_descriptions.json")

export const fetchThresholdAnalysis = () =>
  fetchJson<ThresholdPoint[]>(USE_BACKEND_API ? "/threshold-analysis" : "/threshold_analysis.json")

export const fetchTransitionMatrix = () =>
  fetchJson<TransitionMatrix>(USE_BACKEND_API ? "/transition-matrix" : "/transition_matrix.json")

export const fetchStudentSessions = () =>
  fetchJson<StudentSessionsDetail>(USE_BACKEND_API ? "/student-sessions" : "/student_sessions_detail.json")

export const fetchAblation = () =>
  fetchJson<AblationData>(USE_BACKEND_API ? "/ablation" : "/rq2_normalization_ablation.json")

export const fetchAblationData = () =>
  fetchJson<AblationData>(USE_BACKEND_API ? "/ablation" : "/rq2_normalization_ablation.json")
