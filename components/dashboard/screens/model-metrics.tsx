"use client"

import { useEffect, useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  Brain,
  GitBranch,
  Info,
  Target,
  TrendingUp,
  ArrowRight,
} from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Sankey,
  Rectangle,
  Layer,
} from "recharts"
import {
  fetchModelComparison,
  fetchConfusionMatrices,
  fetchRocData,
  fetchOverview,
  fetchAblation,
  fetchTransitionMatrix,
  fetchThresholdAnalysis,
} from "@/lib/fetch-data"
import { TIER_COLORS } from "@/lib/utils"
import type {
  ModelMetric,
  ConfusionMatrices,
  RocData,
  OverviewData,
  AblationData,
  TransitionMatrix,
  ThresholdPoint,
} from "@/lib/types"

const MODEL_COLORS: Record<string, string> = {
  LogReg: "#6366f1",
  RF: "#22c55e",
  XGB: "#f59e0b",
}

function formatModelName(key: string): string {
  const names: Record<string, string> = {
    LogReg: "Logistic Regression",
    RF: "Random Forest",
    XGB: "XGBoost",
  }
  return names[key] ?? key
}

function getModelStatus(
  model: string,
  bestModel: string,
  accuracy: number
): { label: string; variant: "best" | "runner-up" | "failed" } {
  if (model === bestModel) return { label: "Best", variant: "best" }
  if (accuracy < 0.25) return { label: "Failed", variant: "failed" }
  return { label: "Runner-up", variant: "runner-up" }
}

function StatusBadge({
  status,
}: {
  status: ReturnType<typeof getModelStatus>
}) {
  const styles = {
    best: "bg-primary/10 text-primary border-primary",
    "runner-up": "bg-amber-500/10 text-amber-600 border-amber-500",
    failed: "bg-destructive/10 text-destructive border-destructive",
  }
  return (
    <Badge variant="outline" className={`text-xs ${styles[status.variant]}`}>
      {status.label}
    </Badge>
  )
}

function formatParamKey(key: string): string {
  const labels: Record<string, string> = {
    C: "C (regularization)",
    max_depth: "Max Depth",
    min_samples_leaf: "Min Samples Leaf",
    n_estimators: "N Estimators",
    colsample_bytree: "Col Sample / Tree",
    learning_rate: "Learning Rate",
    subsample: "Subsample",
  }
  return labels[key] ?? key
}

export function ModelMetrics() {
  const [models, setModels] = useState<ModelMetric[] | null>(null)
  const [matrices, setMatrices] = useState<ConfusionMatrices | null>(null)
  const [rocData, setRocData] = useState<RocData | null>(null)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [ablation, setAblation] = useState<AblationData | null>(null)
  const [transitionMatrix, setTransitionMatrix] = useState<TransitionMatrix | null>(null)
  const [thresholdData, setThresholdData] = useState<ThresholdPoint[] | null>(null)
  const [selectedMatrix, setSelectedMatrix] = useState<string>("")
  const [selectedThreshold, setSelectedThreshold] = useState<number>(0.5)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchModelComparison(),
      fetchConfusionMatrices(),
      fetchRocData(),
      fetchOverview(),
      fetchAblation(),
      fetchTransitionMatrix(),
      fetchThresholdAnalysis(),
    ])
      .then(([modelsData, matricesData, rocDataResult, overviewData, ablationData, transitionData, thresholdDataResult]) => {
        setModels(modelsData)
        setMatrices(matricesData)
        setRocData(rocDataResult)
        setOverview(overviewData)
        setAblation(ablationData)
        setTransitionMatrix(transitionData)
        setThresholdData(thresholdDataResult)
        setSelectedMatrix(overviewData.best_model_mc || overviewData.best_model || Object.keys(matricesData)[0])
      })
      .catch((e) => {
        console.error(e)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading || !models || !matrices || !rocData || !overview || !ablation) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  const bestModel = overview.best_model_mc || overview.best_model || models[0]?.model
  const bestModelData = models.find((m) => m.model === bestModel) ?? models[0]
  const trainSize = bestModelData?.train_size ?? 0
  const testSize = bestModelData?.test_size ?? 0

  const trainingDate = overview.train_timestamp
    ? new Date(overview.train_timestamp).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "N/A"

  const currentMatrix = matrices[selectedMatrix]
  const maxValue = currentMatrix
    ? Math.max(...currentMatrix.matrix.flat())
    : 1

  const getHeatmapColor = (value: number, max: number) => {
    const intensity = value / max
    if (intensity > 0.7) return "bg-tier-high/80 text-tier-high-bg"
    if (intensity > 0.3) return "bg-tier-moderate/60 text-tier-moderate-bg"
    return "bg-tier-disengaged/40 text-tier-disengaged-bg"
  }

  const isXgbAllOneClass =
    selectedMatrix === "XGB" &&
    currentMatrix &&
    currentMatrix.matrix.some((row) => row.every((v) => v === 0))

  const tierMetrics = [
    {
      tier: "High" as const,
      precision: bestModelData?.precision_high ?? 0,
      recall: bestModelData?.recall_high ?? 0,
    },
    {
      tier: "Disengaged" as const,
      precision: bestModelData?.precision_disengaged ?? 0,
      recall: bestModelData?.recall_disengaged ?? 0,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Model & Metrics</h2>
        <p className="text-muted-foreground">
          Predictive model performance and evaluation metrics
        </p>
      </div>

      {/* Warning Banner */}
      <Card className="border-amber-500/50 bg-amber-500/5 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              Small Sample Size
            </p>
            <p className="text-sm text-muted-foreground">
              Model trained on{" "}
              <span className="font-medium text-foreground">{trainSize}</span>{" "}
              samples and tested on{" "}
              <span className="font-medium text-foreground">{testSize}</span>{" "}
              samples. Results should be interpreted with caution. This is a{" "}
              <span className="font-medium text-foreground">
                binary classifier
              </span>{" "}
              (Disengaged vs High) — Mid-tier students are excluded from
              training.
            </p>
          </div>
        </div>
      </Card>

      {/* Model Summary */}
      <Card className="p-5">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {formatModelName(bestModel)}
              </h3>
              <p className="text-sm text-muted-foreground">
                Best performing model — Binary Engagement Classification
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-primary border-primary">
            Best Model
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Training Date</p>
              <p className="text-sm font-medium text-foreground">
                {trainingDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Features</p>
              <p className="text-sm font-medium text-foreground">
                {overview.n_features ?? overview.features_used?.length ?? 0} input features
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Accuracy (Two-Stage)</p>
              <p className="text-sm font-medium text-foreground">
                {Number((overview?.metrics?.accuracy ?? 0) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3" title="Quadratic Weighted Kappa - Chỉ số đánh giá độ tin cậy phân loại cấp bậc">
            <Brain className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">QWK Score</p>
              <p className="text-sm font-medium text-foreground">
                {Number(overview?.metrics?.qwk ?? 0).toFixed(4)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Train / Test</p>
              <p className="text-sm font-medium text-foreground">
                {trainSize} / {testSize} samples
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md bg-muted/50 p-3">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Accuracy of {Number((bestModelData?.accuracy ?? 0) * 100).toFixed(1)}% is
            modest for binary classification (50% = random). AUC of{" "}
            {Number(bestModelData?.auc ?? 0).toFixed(3)} indicates some discriminative ability
            but significant room for improvement with more training data.
          </p>
        </div>
      </Card>

      {/* Model Comparison Table */}
      <Card className="p-5">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Model Comparison
        </h3>
        
        {/* Binary Models Section */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500">Binary Classification</Badge>
            <span className="text-xs text-muted-foreground font-normal">Disengaged vs High</span>
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Model",
                    "Status",
                    "Accuracy",
                    "Macro F1",
                    "AUC",
                    "Precision",
                    "Recall",
                    "Train / Test",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left py-3 px-4 text-sm font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {models.filter(m => m.type === 'binary').map((m) => {
                  const isBest = m.model === overview.best_model_binary
                  return (
                    <tr
                      key={m.model}
                      className={`border-b border-border/50 ${
                        isBest
                          ? "bg-primary/5 font-semibold"
                          : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="py-3 px-4 text-sm text-foreground">
                        {formatModelName(m.model)}
                      </td>
                      <td className="py-3 px-4">
                        {isBest && <StatusBadge status={{ label: "Best", variant: "best" }} />}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {Number((m.accuracy ?? 0) * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {Number(m.macro_f1 ?? 0).toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {Number(m.auc ?? 0).toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {Number(m.precision_macro ?? 0).toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {Number(m.recall_macro ?? 0).toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {m.train_size} / {m.test_size}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Multiclass Models Section */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500">4-Tier Classification</Badge>
            <span className="text-xs text-muted-foreground font-normal">Disengaged / Low / Moderate / High</span>
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Model",
                    "Status",
                    "Accuracy",
                    "Macro F1",
                    "QWK",
                    "OvR-AUC",
                    "Train / Test",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left py-3 px-4 text-sm font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {models.filter(m => m.type === 'multiclass').map((m) => {
                  const isBest = m.model === overview.best_model_mc
                  return (
                    <tr
                      key={m.model}
                      className={`border-b border-border/50 ${
                        isBest
                          ? "bg-primary/5 font-semibold"
                          : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="py-3 px-4 text-sm text-foreground">
                        {formatModelName(m.model)}
                      </td>
                      <td className="py-3 px-4">
                        {isBest && <StatusBadge status={{ label: "Best", variant: "best" }} />}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {Number((m.accuracy ?? 0) * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {Number(m.macro_f1 ?? 0).toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {Number(m.qwk ?? 0).toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {Number(m.auc ?? 0).toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {m.train_size} / {m.test_size}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Ordinal Regression Models */}
      {overview.ordinal_models && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Ordinal Regression Models
            </h3>
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500">
              Respects Tier Ordering
            </Badge>
          </div>
          <div className="flex items-start gap-3 mb-4">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Ordinal regression models respect the natural ordering of engagement tiers (disengaged &lt; low &lt; moderate &lt; high).
              They excel at adjacent accuracy (predictions within 1 tier) but may have lower exact classification accuracy.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Model",
                    "QWK",
                    "MAE",
                    "Macro F1",
                    "Adjacent Acc",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left py-3 px-4 text-sm font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.ordinal_models && Object.entries(overview.ordinal_models).map(([name, metrics]) => (
                  <tr
                    key={name}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="py-3 px-4 text-sm text-foreground font-medium">
                      {name}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {metrics?.qwk?.toFixed(3) ?? "N/A"}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {metrics?.mae?.toFixed(3) ?? "N/A"}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {metrics?.f1?.toFixed(3) ?? "N/A"}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {metrics?.adj_acc ? `${Number(metrics.adj_acc * 100).toFixed(1)}%` : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-xs text-amber-600">
              <strong>Note:</strong> While ordinal models achieve high adjacent accuracy (&gt;86%), 
              the standard RF_MC model (QWK={overview.best_qwk_mc?.toFixed(3)}) still performs better for exact tier classification.
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confusion Matrix */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Confusion Matrix
            </h3>
            <Select value={selectedMatrix} onValueChange={setSelectedMatrix}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(matrices).map((key) => (
                  <SelectItem key={key} value={key}>
                    {formatModelName(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {currentMatrix && (
            <div className="flex flex-col items-center">
              <div>
                <div className="flex mb-2">
                  <div className="w-24" />
                  {currentMatrix.labels.map((label) => (
                    <div
                      key={label}
                      className="w-20 text-center text-xs font-medium text-muted-foreground capitalize"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                {currentMatrix.matrix.map((row, i) => (
                  <div key={i} className="flex items-center">
                    <div className="w-24 text-right pr-3 text-xs font-medium text-muted-foreground capitalize">
                      {currentMatrix.labels[i]}
                    </div>
                    {row.map((value, j) => (
                      <div
                        key={j}
                        className={`w-20 h-14 flex items-center justify-center text-sm font-bold rounded-md m-0.5 ${getHeatmapColor(
                          value,
                          maxValue
                        )}`}
                      >
                        {value}
                      </div>
                    ))}
                  </div>
                ))}
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Predicted (columns) vs Actual (rows)
                </p>
              </div>

              {isXgbAllOneClass && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-3 w-full">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">
                    XGBoost predicts every sample as &quot;disengaged&quot;,
                    resulting in 0 true positives for the High tier. The model
                    has effectively failed to learn the decision boundary.
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ROC Curve */}
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            ROC Curve
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="x"
                type="number"
                domain={[0, 1]}
                tickCount={6}
                label={{
                  value: "False Positive Rate",
                  position: "insideBottom",
                  offset: -10,
                  className: "fill-muted-foreground text-xs",
                }}
                className="text-xs"
              />
              <YAxis
                dataKey="y"
                type="number"
                domain={[0, 1]}
                tickCount={6}
                label={{
                  value: "True Positive Rate",
                  angle: -90,
                  position: "insideLeft",
                  offset: 5,
                  className: "fill-muted-foreground text-xs",
                }}
                className="text-xs"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                  formatter={(value: number | undefined, name: string) => [
                  value != null ? Number(value).toFixed(3) : "N/A",
                  name,
                ]}
                  labelFormatter={(label: number | undefined) =>
                  label != null ? `FPR: ${Number(label).toFixed(3)}` : "FPR: N/A"
                }
              />
              <Legend
                verticalAlign="top"
                wrapperStyle={{ fontSize: "12px", paddingBottom: "8px" }}
              />
              <ReferenceLine
                segment={[
                  { x: 0, y: 0 },
                  { x: 1, y: 1 },
                ]}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="6 4"
                strokeOpacity={0.5}
              />
              {Object.entries(rocData).map(([modelKey, curve]) => {
                if (!curve?.fpr || !curve?.tpr || !Array.isArray(curve.fpr) || !Array.isArray(curve.tpr)) {
                  return null
                }
                return (
                  <Line
                    key={modelKey}
                    data={curve.fpr.map((f, i) => ({
                      x: f ?? 0,
                      y: curve.tpr[i] ?? 0,
                    }))}
                    dataKey="y"
                    name={`${formatModelName(modelKey)} (AUC=${curve.auc != null ? Number(curve.auc).toFixed(3) : "N/A"})`}
                    stroke={MODEL_COLORS[modelKey] ?? "#888"}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        </Card>
        {/* Ablation Study Chart */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Feature Engineering Ablation Study
              </h3>
              <p className="text-sm text-muted-foreground">
                Đánh giá mức độ hiệu quả (AUC) khi thêm các nhóm features
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={Object.entries(ablation).map(([name, stats]) => ({
                name,
                auc: stats?.auc != null ? Number(stats.auc.toFixed(4)) : 0,
              }))}
              margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" vertical={false} />
              <XAxis
                dataKey="name"
                className="text-xs font-medium"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0.8, 1.0]}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val != null ? Number(val).toFixed(2) : "0"}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="auc" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {Object.keys(ablation).map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      index === Object.keys(ablation).length - 1
                        ? "hsl(var(--primary))"
                        : "hsl(var(--primary)/0.5)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Per-Tier Metrics for Best Model */}
      <Card className="p-5">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Per-Tier Performance
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {formatModelName(bestModel)} — per-class precision &amp; recall
        </p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Tier
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Precision
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Recall
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Interpretation
                </th>
              </tr>
            </thead>
            <tbody>
              {tierMetrics.map((metric) => {
                const precPct = Number((metric.precision ?? 0) * 100).toFixed(1)
                const recPct = Number((metric.recall ?? 0) * 100).toFixed(1)
                const precision = metric.precision ?? 0
                const recall = metric.recall ?? 0
                const interpretation =
                  metric.tier === "Disengaged" && precision < 0.3
                    ? `Precision is only ${precPct}% — model flags many false positives for this tier`
                    : metric.tier === "High" && recall < 0.6
                      ? `Recall is ${recPct}% — model misses some high-engagement students`
                      : null
                return (
                  <tr
                    key={metric.tier}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          metric.tier === "High"
                            ? "bg-tier-high-bg text-tier-high"
                            : "bg-tier-disengaged-bg text-tier-disengaged"
                        }`}
                      >
                        {metric.tier}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      {precPct}%
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      {recPct}%
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {interpretation && (
                        <span className="flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          {interpretation}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Transition Matrix Visualization & Threshold Analysis */}
      <div className="grid grid-cols-2 gap-6">
        {/* Transition Matrix Flow */}
        {transitionMatrix && (
          <Card className="p-5">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Early → Final Tier Transitions
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              How student tiers change from early prediction to final label
            </p>
            
            {/* Stability indicator */}
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-muted/50">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm">
                <span className="font-semibold text-foreground">
                  {((transitionMatrix.stability ?? 0) * 100).toFixed(1)}%
                </span>
                <span className="text-muted-foreground ml-1">stability (students staying in same tier)</span>
              </span>
            </div>

            {/* Transition flow visualization */}
            <div className="space-y-3">
              {["disengaged", "low", "moderate", "high"].map((fromTier) => {
                const row = transitionMatrix.counts[fromTier]
                if (!row) return null
                const total = row.All || Object.values(row).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)
                
                return (
                  <div key={fromTier} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span 
                        className="w-20 font-medium capitalize"
                        style={{ color: TIER_COLORS[fromTier] }}
                      >
                        {fromTier}
                      </span>
                      <span className="text-muted-foreground">({total})</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <div className="flex h-6 rounded overflow-hidden">
                      {["disengaged", "low", "moderate", "high"].map((toTier) => {
                        const count = row[toTier] || 0
                        const pct = total > 0 ? (count / total) * 100 : 0
                        if (pct < 1) return null
                        return (
                          <div
                            key={toTier}
                            className="h-full flex items-center justify-center text-[10px] font-medium transition-all hover:opacity-80"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: TIER_COLORS[toTier],
                              color: toTier === fromTier ? "#000" : "#fff",
                              borderRight: "1px solid rgba(0,0,0,0.1)",
                            }}
                            title={`${fromTier} → ${toTier}: ${count} (${pct != null ? pct.toFixed(1) : "0"}%)`}
                          >
                            {pct >= 10 && pct != null && `${pct.toFixed(0)}%`}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-4 pt-3 border-t border-border">
              {["disengaged", "low", "moderate", "high"].map((tier) => (
                <div key={tier} className="flex items-center gap-1.5 text-xs">
                  <div 
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: TIER_COLORS[tier] }}
                  />
                  <span className="capitalize text-muted-foreground">{tier}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Threshold Analysis */}
        {thresholdData && thresholdData.length > 0 && (
          <Card className="p-5">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Threshold Analysis
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Adjust classification threshold to balance precision/recall
            </p>

            {/* Threshold Slider */}
            <div className="mb-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Threshold</span>
                <span className="text-sm font-mono text-primary">{selectedThreshold.toFixed(2)}</span>
              </div>
              <Slider
                value={[selectedThreshold]}
                onValueChange={([v]) => setSelectedThreshold(v)}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
              />
              
              {/* Current threshold metrics */}
              {thresholdData && thresholdData.length > 0 && (() => {
                const closest = thresholdData.reduce((prev, curr) =>
                  Math.abs(curr.threshold - selectedThreshold) < Math.abs(prev.threshold - selectedThreshold) ? curr : prev
                )
                return (
                  <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Precision</p>
                      <p className="text-lg font-bold text-foreground">{((closest?.precision ?? 0) * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Recall</p>
                      <p className="text-lg font-bold text-foreground">{((closest?.recall ?? 0) * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">F1 Score</p>
                      <p className="text-lg font-bold text-primary">{((closest?.f1 ?? 0) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* P/R Curve */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={thresholdData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 250)" />
                  <XAxis 
                    dataKey="threshold" 
                    stroke="oklch(0.5 0.02 250)" 
                    fontSize={10}
                    label={{ value: "Threshold", position: "bottom", offset: -5, style: { fill: "oklch(0.5 0.02 250)", fontSize: 10 } }}
                  />
                  <YAxis 
                    stroke="oklch(0.5 0.02 250)" 
                    fontSize={10}
                    domain={[0, 1]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "oklch(0.18 0.02 250)", 
                      border: "1px solid oklch(0.3 0.02 250)",
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                    formatter={(value: number | undefined) => value != null ? `${(value * 100).toFixed(1)}%` : "N/A"}
                  />
                  <Legend />
                  <ReferenceLine 
                    x={selectedThreshold} 
                    stroke="oklch(0.7 0.2 280)" 
                    strokeDasharray="5 5" 
                    label={{ value: "Selected", fill: "oklch(0.7 0.2 280)", fontSize: 10 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="precision" 
                    name="Precision"
                    stroke={TIER_COLORS.high} 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="recall" 
                    name="Recall"
                    stroke={TIER_COLORS.moderate} 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="f1" 
                    name="F1"
                    stroke="oklch(0.7 0.2 280)" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* Best Params per Model */}
      <Card className="p-5">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Hyperparameters
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Best parameters found via grid/random search for each model
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {models.map((m) => {
            const status = getModelStatus(m.model, bestModel, m.accuracy)
            return (
              <div
                key={m.model}
                className={`rounded-lg border p-4 ${
                  status.variant === "best"
                    ? "border-primary/40 bg-primary/5"
                    : status.variant === "failed"
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">
                    {formatModelName(m.model)}
                  </p>
                  <StatusBadge status={status} />
                </div>
                <dl className="space-y-1.5">
                  {Object.entries(m.best_params).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <dt className="text-muted-foreground">
                        {formatParamKey(key)}
                      </dt>
                      <dd className="font-mono font-medium text-foreground">
                        {typeof value === "number" && value % 1 !== 0
                          ? value.toFixed(4)
                          : String(value ?? "")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
