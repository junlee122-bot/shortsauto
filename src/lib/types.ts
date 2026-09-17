export type ChannelHealth = "excellent" | "good" | "attention" | "critical";

export type ShortStatus =
  | "idea"
  | "scripting"
  | "rendering"
  | "review"
  | "scheduled"
  | "published"
  | "paused"
  | "failed";

export type AutomationStatus = "active" | "paused" | "needs_attention";
export type JobStatus = "queued" | "running" | "completed" | "failed";
export type ExperimentStatus =
  | "draft"
  | "running"
  | "ready"
  | "promoted"
  | "rolled_back"
  | "rejected";
export type CandidateStatus = "testing" | "candidate" | "promoted" | "rolled_back" | "rejected";
export type RiskLevel = "low" | "medium" | "high";
export type TrendDirection = "up" | "down" | "stable";

export interface Channel {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  subscribers: number;
  subscriberDelta: number;
  totalViews: number;
  monthlyViews: number;
  health: ChannelHealth;
  connected: boolean;
  timezone: string;
  defaultLanguage: string;
  lastSyncedAt: string;
}

export interface PerformanceSnapshot {
  impressions: number;
  views: number;
  engagedViews: number;
  averageViewDurationSeconds: number;
  /** Percentage in the 0-100 range. */
  averagePercentageViewed: number;
  /** Percentage in the 0-100 range. */
  viewedVsSwipedAway: number;
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  dislikes: number;
  notInterested: number;
  estimatedRevenue: number;
  capturedAt?: string;
}

export interface ShortVideo {
  id: string;
  title: string;
  topic: string;
  hook: string;
  status: ShortStatus;
  durationSeconds: number;
  thumbnailUrl?: string;
  publishedAt?: string;
  scheduledAt?: string;
  templateId: string;
  automationId?: string;
  score: number;
  metrics?: PerformanceSnapshot;
  tags: string[];
}

export interface DashboardMetric {
  label: string;
  value: number;
  previousValue: number;
  unit: "number" | "percent" | "seconds" | "currency";
  direction: TrendDirection;
}

export interface PerformancePoint {
  date: string;
  views: number;
  subscribers: number;
  averagePercentageViewed: number;
}

export interface PipelineStep {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  order: number;
  averageDurationSeconds: number;
  successRate: number;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  cadence: string;
  nextRunAt: string;
  lastRunAt: string;
  runsThisMonth: number;
  successRate: number;
  dailyLimit: number;
  steps: PipelineStep[];
}

export interface AutomationJob {
  id: string;
  automationId: string;
  shortId?: string;
  title: string;
  status: JobStatus;
  progress: number;
  currentStep: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface ContentTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  accent: string;
  aspectRatio: "9:16";
  estimatedDurationSeconds: number;
  usageCount: number;
  averageViewRate: number;
  averageRetention: number;
  enabled: boolean;
}

export interface ContentIdea {
  id: string;
  title: string;
  angle: string;
  source: string;
  keywords: string[];
  trendScore: number;
  competition: "low" | "medium" | "high";
  expectedViewRange: [number, number];
  createdAt: string;
  selected: boolean;
}

export interface ScheduleItem {
  id: string;
  shortId: string;
  title: string;
  scheduledAt: string;
  status: "planned" | "ready" | "published";
  recommendedSlot: boolean;
}

export interface SafetySignals {
  policyWarnings: number;
  copyrightClaims: number;
  failedRenders: number;
  manualReviewPassed: boolean;
  /** Model-estimated probability in the 0-1 range. */
  reusedContentRisk: number;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  description: string;
  snapshot: PerformanceSnapshot;
}

export interface GrowthExperiment {
  id: string;
  name: string;
  hypothesis: string;
  dimension: "hook" | "title" | "voice" | "pace" | "caption" | "visual" | "schedule";
  status: ExperimentStatus;
  candidateStatus: CandidateStatus;
  riskLevel: RiskLevel;
  startedAt: string;
  evaluationHours: number;
  control: ExperimentVariant;
  candidate: ExperimentVariant;
  safety: SafetySignals;
  postPromotion?: PerformanceSnapshot;
  promotedAt?: string;
}

export interface GrowthPolicy {
  minimumImpressionsPerVariant: number;
  minimumExperimentHours: number;
  minimumConfidence: number;
  promotionScore: number;
  maximumViewRateDrop: number;
  maximumRetentionDrop: number;
  maximumNegativeFeedbackRate: number;
  maximumReusedContentRisk: number;
  maximumFailedRenders: number;
  rollbackMinimumImpressions: number;
  rollbackViewRateDrop: number;
  rollbackRetentionDrop: number;
}

export interface ScoreBreakdown {
  viewRate: number;
  retention: number;
  engagement: number;
  shareRate: number;
  subscriberConversion: number;
  audienceSafety: number;
}

export interface CandidateScore {
  score: number;
  rawScore: number;
  confidence: number;
  sampleReadiness: number;
  breakdown: ScoreBreakdown;
  guardrailBreaches: string[];
}

export type PromotionOutcome = "promote" | "continue" | "reject" | "manual_review";

export interface PromotionDecision extends CandidateScore {
  outcome: PromotionOutcome;
  recommendation: string;
}

export interface RollbackDecision {
  shouldRollback: boolean;
  severity: "none" | "warning" | "critical";
  triggers: string[];
  recommendation: string;
}

export interface GrowthAssessment {
  promotion: PromotionDecision;
  rollback?: RollbackDecision;
  nextCandidateStatus: CandidateStatus;
}

export interface TrendTopic {
  id: string;
  keyword: string;
  category: string;
  score: number;
  direction: TrendDirection;
  change: number;
  source: string;
}

export interface ActivityItem {
  id: string;
  type: "publish" | "automation" | "experiment" | "alert" | "milestone";
  title: string;
  description: string;
  occurredAt: string;
  tone: "success" | "info" | "warning" | "neutral";
}

export interface DashboardData {
  channel: Channel;
  metrics: DashboardMetric[];
  weeklyPerformance: PerformancePoint[];
  shorts: ShortVideo[];
  automations: Automation[];
  jobs: AutomationJob[];
  templates: ContentTemplate[];
  ideas: ContentIdea[];
  schedule: ScheduleItem[];
  experiments: GrowthExperiment[];
  trends: TrendTopic[];
  activities: ActivityItem[];
}

export type ProductionPriority = "low" | "normal" | "high" | "urgent";
export type ProductionLane =
  | "intake"
  | "research"
  | "script"
  | "edit"
  | "legal_review"
  | "ready"
  | "scheduled";
export type ApprovalStatus = "not_required" | "pending" | "approved" | "changes_requested" | "blocked";
export type OperationalRisk = "clear" | "watch" | "review" | "blocked";
export type EvidenceStatus = "verified" | "needs_review" | "missing" | "expired";
export type QualityStatus = "pass" | "watch" | "fail";
export type ReleaseEventType = "gate" | "qa" | "budget" | "incident" | "publish" | "rollback";

export interface ApprovalGate {
  id: string;
  label: string;
  owner: string;
  status: ApprovalStatus;
  dueAt?: string;
  note: string;
}

export interface ProductionTask {
  id: string;
  shortId?: string;
  title: string;
  workingTitle: string;
  channel: string;
  lane: ProductionLane;
  priority: ProductionPriority;
  owner: string;
  dueAt: string;
  estimatedMinutes: number;
  automationId?: string;
  gates: ApprovalGate[];
  risk: {
    level: OperationalRisk;
    policyFlags: string[];
    copyrightRisk: number;
    claimRisk: number;
    sourceCoverage: number;
    costEstimateUsd: number;
  };
  publishWindow: {
    recommendedAt: string;
    reason: string;
    expectedViews: [number, number];
  };
  audience: {
    primarySegment: string;
    retentionHook: string;
    likelyObjection: string;
    localizationNotes: string;
  };
  evidence: SourceEvidence[];
  qualityChecks: QualityCheckItem[];
  decisionBrief: {
    operatorNote: string;
    suggestedDecision: "approve" | "revise" | "hold" | "schedule";
    releaseConfidence: number;
    rollbackPlan: string;
  };
  handoff: HandoffItem[];
  sla: {
    targetMinutes: number;
    elapsedMinutes: number;
    breachRisk: "low" | "medium" | "high";
    escalationOwner: string;
  };
}

export interface SourceEvidence {
  id: string;
  label: string;
  url: string;
  sourceType: "official" | "academic" | "first_party" | "newsroom" | "internal";
  status: EvidenceStatus;
  checkedAt: string;
  claim: string;
}

export interface QualityCheckItem {
  id: string;
  label: string;
  status: QualityStatus;
  score: number;
  detail: string;
}

export interface BudgetGuardrail {
  id: string;
  label: string;
  current: number;
  limit: number;
  unit: "usd" | "minutes" | "credits" | "count";
  resetAt: string;
  severity: "ok" | "watch" | "critical";
}

export interface Incident {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "investigating" | "resolved";
  startedAt: string;
  owner: string;
  impact: string;
  nextAction: string;
}

export interface HandoffItem {
  id: string;
  label: string;
  owner: string;
  done: boolean;
  detail: string;
}

export interface ReleaseEvent {
  id: string;
  type: ReleaseEventType;
  title: string;
  description: string;
  actor: string;
  occurredAt: string;
  severity: "success" | "info" | "warning" | "critical";
}

export interface ChannelPolicy {
  id: string;
  channel: string;
  rule: string;
  current: number;
  limit: number;
  unit: "posts" | "minutes" | "warnings" | "usd";
  action: string;
}

export interface ScenarioSimulation {
  id: string;
  name: string;
  description: string;
  impact: {
    readyDelta: number;
    spendDeltaUsd: number;
    reviewMinutesDelta: number;
    expectedViewsDelta: number;
  };
  recommendation: string;
}

export interface OperationsData {
  productionTasks: ProductionTask[];
  budgetGuardrails: BudgetGuardrail[];
  incidents: Incident[];
  releaseEvents: ReleaseEvent[];
  channelPolicies: ChannelPolicy[];
  simulations: ScenarioSimulation[];
}
