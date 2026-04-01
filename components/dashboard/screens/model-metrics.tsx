"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
} from "recharts"
import {
  fetchModelComparison,
  fetchConfusionMatrices,
  fetchRocData,
  fetchOverview,
  fetchAblation,
} from "@/lib/fetch-data"
import type {
  ModelMetric,
  ConfusionMatrices,
  RocData,
  OverviewData,
  AblationData,
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
  const [selectedMatrix, setSelectedMatrix] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchModelComparison(),
      fetchConfusionMatrices(),
      fetchRocData(),
      fetchOverview(),
      fetchAblation(),
    ])
      .then(([modelsData, matricesData, rocDataResult, overviewData, ablationData]) => {
        setModels(modelsData)
        setMatrices(matricesData)
        setRocData(rocDataResult)
        setOverview(overviewData)
        setAblation(ablationData)
        setSelectedMatrix(overviewData.best_model)
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

  const bestModel = overview.best_model
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
      precision: bestModelData.precision_high,
      recall: bestModelData.recall_high,
    },
    {
      tier: "Disengaged" as const,
      precision: bestModelData.precision_disengaged,
      recall: bestModelData.recall_disengaged,
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
              {models.map((m) => {
                const status = getModelStatus(m.model, bestModel, m.accuracy)
                const isBest = m.model === bestModel
                const isFailed = status.variant === "failed"
                return (
                  <tr
                    key={m.model}
                    className={`border-b border-border/50 ${
                      isBest
                        ? "bg-primary/5 font-semibold"
                        : isFailed
                          ? "bg-destructive/5"
                          : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="py-3 px-4 text-sm text-foreground">
                      <div>
                        {formatModelName(m.model)}
                        {isFailed && (
                          <p className="text-xs font-normal text-destructive mt-0.5">
                            Predicts all as disengaged
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={status} />
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
      </Card>

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
                formatter={(value: number, name: string) => [
                  Number(value ?? 0).toFixed(3),
                  name,
                ]}
                labelFormatter={(label: number) =>
                  `FPR: ${Number(label ?? 0).toFixed(3)}`
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
              {Object.entries(rocData).map(([modelKey, curve]) => (
                <Line
                  key={modelKey}
                  data={curve.fpr.map((f, i) => ({
                    x: f,
                    y: curve.tpr[i],
                  }))}
                  dataKey="y"
                  name={`${formatModelName(modelKey)} (AUC=${Number(
                    curve.auc ?? 0,
                  ).toFixed(3)})`}
                  stroke={MODEL_COLORS[modelKey] ?? "#888"}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
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
                auc: Number(stats.auc.toFixed(4)),
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
                tickFormatter={(val) => Number(val).toFixed(2)}
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
                const interpretation =
                  metric.tier === "Disengaged" && metric.precision < 0.3
                    ? `Precision is only ${precPct}% — model flags many false positives for this tier`
                    : metric.tier === "High" && metric.recall < 0.6
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
                          ? Number(value).toFixed(4)
                          : String(value)}
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
