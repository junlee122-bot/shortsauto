import type {
  CandidateScore,
  GrowthAssessment,
  GrowthExperiment,
  GrowthPolicy,
  PerformanceSnapshot,
  PromotionDecision,
  RollbackDecision,
  SafetySignals,
  ScoreBreakdown,
} from "./types";

export const DEFAULT_GROWTH_POLICY: Readonly<GrowthPolicy> = Object.freeze({
  minimumImpressionsPerVariant: 10_000,
  minimumExperimentHours: 72,
  minimumConfidence: 0.8,
  promotionScore: 62,
  maximumViewRateDrop: 0.03,
  maximumRetentionDrop: 0.05,
  maximumNegativeFeedbackRate: 0.02,
  maximumReusedContentRisk: 0.35,
  maximumFailedRenders: 2,
  rollbackMinimumImpressions: 5_000,
  rollbackViewRateDrop: 0.1,
  rollbackRetentionDrop: 0.12,
});

type RateSet = {
  viewRate: number;
  retention: number;
  engagement: number;
  shareRate: number;
  subscriberConversion: number;
  negativeFeedback: number;
};

const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const safeCount = (value: number): number => Math.max(0, Number.isFinite(value) ? value : 0);

const ratesOf = (snapshot: PerformanceSnapshot): RateSet => {
  const views = Math.max(1, safeCount(snapshot.views));
  const impressions = Math.max(1, safeCount(snapshot.impressions));
  const explicitViewRate = clamp(snapshot.viewedVsSwipedAway / 100);

  return {
    viewRate: explicitViewRate > 0 ? explicitViewRate : clamp(snapshot.views / impressions),
    retention: clamp(snapshot.averagePercentageViewed / 100),
    engagement: clamp(
      (safeCount(snapshot.likes) + safeCount(snapshot.comments) + safeCount(snapshot.shares)) / views,
    ),
    shareRate: clamp(safeCount(snapshot.shares) / views),
    subscriberConversion: clamp(safeCount(snapshot.subscribersGained) / views),
    negativeFeedback: clamp(
      (safeCount(snapshot.dislikes) + safeCount(snapshot.notInterested)) / views,
    ),
  };
};

const relativeLift = (candidate: number, control: number): number => {
  const denominator = Math.max(Math.abs(control), 0.000_1);
  return (candidate - control) / denominator;
};

const scoreSignal = (lift: number, meaningfulLift: number): number =>
  Math.tanh(lift / meaningfulLift);

const twoProportionZScore = (
  controlRate: number,
  controlSamples: number,
  candidateRate: number,
  candidateSamples: number,
): number => {
  if (controlSamples <= 0 || candidateSamples <= 0) return 0;
  const pooled =
    (controlRate * controlSamples + candidateRate * candidateSamples) /
    (controlSamples + candidateSamples);
  const standardError = Math.sqrt(
    Math.max(0, pooled * (1 - pooled) * (1 / controlSamples + 1 / candidateSamples)),
  );
  return standardError === 0 ? 0 : (candidateRate - controlRate) / standardError;
};

export function findGuardrailBreaches(
  experiment: GrowthExperiment,
  policy: GrowthPolicy = DEFAULT_GROWTH_POLICY,
): string[] {
  const control = ratesOf(experiment.control.snapshot);
  const candidate = ratesOf(experiment.candidate.snapshot);
  const breaches: string[] = [];

  if (experiment.safety.policyWarnings > 0) breaches.push("YouTube 정책 경고가 감지됨");
  if (experiment.safety.copyrightClaims > 0) breaches.push("저작권 클레임이 감지됨");
  if (!experiment.safety.manualReviewPassed) breaches.push("사람의 안전 검토를 통과하지 않음");
  if (experiment.safety.reusedContentRisk > policy.maximumReusedContentRisk) {
    breaches.push("재사용 콘텐츠 위험도가 허용 범위를 초과함");
  }
  if (experiment.safety.failedRenders > policy.maximumFailedRenders) {
    breaches.push("렌더링 실패가 허용 횟수를 초과함");
  }
  if (candidate.negativeFeedback > policy.maximumNegativeFeedbackRate) {
    breaches.push("부정 피드백 비율이 안전 기준을 초과함");
  }
  if (relativeLift(candidate.viewRate, control.viewRate) < -policy.maximumViewRateDrop) {
    breaches.push("조회 선택률이 보호 기준보다 하락함");
  }
  if (relativeLift(candidate.retention, control.retention) < -policy.maximumRetentionDrop) {
    breaches.push("시청 유지율이 보호 기준보다 하락함");
  }

  return breaches;
}

export function scoreCandidate(
  experiment: GrowthExperiment,
  policy: GrowthPolicy = DEFAULT_GROWTH_POLICY,
): CandidateScore {
  const control = ratesOf(experiment.control.snapshot);
  const candidate = ratesOf(experiment.candidate.snapshot);
  const controlSamples = safeCount(experiment.control.snapshot.impressions);
  const candidateSamples = safeCount(experiment.candidate.snapshot.impressions);

  const breakdown: ScoreBreakdown = {
    viewRate: scoreSignal(relativeLift(candidate.viewRate, control.viewRate), 0.08),
    retention: scoreSignal(relativeLift(candidate.retention, control.retention), 0.08),
    engagement: scoreSignal(relativeLift(candidate.engagement, control.engagement), 0.15),
    shareRate: scoreSignal(relativeLift(candidate.shareRate, control.shareRate), 0.2),
    subscriberConversion: scoreSignal(
      relativeLift(candidate.subscriberConversion, control.subscriberConversion),
      0.2,
    ),
    audienceSafety: scoreSignal(
      relativeLift(control.negativeFeedback, candidate.negativeFeedback),
      0.15,
    ),
  };

  const weightedSignal =
    breakdown.viewRate * 0.25 +
    breakdown.retention * 0.3 +
    breakdown.engagement * 0.15 +
    breakdown.shareRate * 0.1 +
    breakdown.subscriberConversion * 0.15 +
    breakdown.audienceSafety * 0.05;
  const rawScore = clamp(50 + weightedSignal * 50, 0, 100);

  const sampleReadiness = clamp(
    Math.min(controlSamples, candidateSamples) / policy.minimumImpressionsPerVariant,
  );
  const durationReadiness = clamp(experiment.evaluationHours / policy.minimumExperimentHours);
  const balance =
    controlSamples + candidateSamples === 0
      ? 0
      : (2 * Math.min(controlSamples, candidateSamples)) / (controlSamples + candidateSamples);
  const zScore = Math.abs(
    twoProportionZScore(control.viewRate, controlSamples, candidate.viewRate, candidateSamples),
  );
  const evidenceConfidence = clamp(1 - Math.exp(-zScore / 1.5));
  const confidence = clamp(sampleReadiness * durationReadiness * balance * evidenceConfidence);
  const score = clamp(50 + (rawScore - 50) * confidence, 0, 100);

  return {
    score: Math.round(score * 10) / 10,
    rawScore: Math.round(rawScore * 10) / 10,
    confidence: Math.round(confidence * 1_000) / 1_000,
    sampleReadiness: Math.round(sampleReadiness * 1_000) / 1_000,
    breakdown,
    guardrailBreaches: findGuardrailBreaches(experiment, policy),
  };
}

export function evaluatePromotion(
  experiment: GrowthExperiment,
  policy: GrowthPolicy = DEFAULT_GROWTH_POLICY,
): PromotionDecision {
  const result = scoreCandidate(experiment, policy);

  if (result.guardrailBreaches.length > 0) {
    const needsHuman =
      experiment.safety.policyWarnings > 0 ||
      experiment.safety.copyrightClaims > 0 ||
      !experiment.safety.manualReviewPassed;
    return {
      ...result,
      outcome: needsHuman ? "manual_review" : "reject",
      recommendation: `자동 승격을 중지했습니다. ${result.guardrailBreaches.join(", ")}.`,
    };
  }

  if (result.sampleReadiness < 1 || experiment.evaluationHours < policy.minimumExperimentHours) {
    return {
      ...result,
      outcome: "continue",
      recommendation: "표본과 관찰 시간이 아직 부족합니다. 현재 후보로 실험을 계속하세요.",
    };
  }

  if (result.confidence < policy.minimumConfidence) {
    return {
      ...result,
      outcome: "continue",
      recommendation: "성과 차이의 신뢰도가 낮습니다. 추가 노출 후 다시 평가하세요.",
    };
  }

  if (result.score >= policy.promotionScore) {
    return {
      ...result,
      outcome: "promote",
      recommendation: "안전 기준과 성과 기준을 모두 통과했습니다. 후보를 기본값으로 승격하세요.",
    };
  }

  return {
    ...result,
    outcome: "continue",
    recommendation: "안전하지만 승격할 만큼의 개선은 아직 확인되지 않았습니다.",
  };
}

export function evaluateRollback(
  promotedBaseline: PerformanceSnapshot,
  current: PerformanceSnapshot,
  safety: SafetySignals,
  policy: GrowthPolicy = DEFAULT_GROWTH_POLICY,
): RollbackDecision {
  const baselineRates = ratesOf(promotedBaseline);
  const currentRates = ratesOf(current);
  const triggers: string[] = [];
  const immediateSafetyIssue =
    safety.policyWarnings > 0 || safety.copyrightClaims > 0 || !safety.manualReviewPassed;

  if (safety.policyWarnings > 0) triggers.push("승격 후 정책 경고가 발생함");
  if (safety.copyrightClaims > 0) triggers.push("승격 후 저작권 클레임이 발생함");
  if (!safety.manualReviewPassed) triggers.push("승격 후 안전 검토 상태가 취소됨");
  if (safety.reusedContentRisk > policy.maximumReusedContentRisk) {
    triggers.push("승격 후 재사용 콘텐츠 위험도가 상승함");
  }

  const enoughPerformanceData = safeCount(current.impressions) >= policy.rollbackMinimumImpressions;
  if (enoughPerformanceData) {
    if (
      relativeLift(currentRates.viewRate, baselineRates.viewRate) <= -policy.rollbackViewRateDrop
    ) {
      triggers.push("승격 후 조회 선택률이 롤백 기준보다 하락함");
    }
    if (
      relativeLift(currentRates.retention, baselineRates.retention) <=
      -policy.rollbackRetentionDrop
    ) {
      triggers.push("승격 후 시청 유지율이 롤백 기준보다 하락함");
    }
    if (currentRates.negativeFeedback > policy.maximumNegativeFeedbackRate) {
      triggers.push("승격 후 부정 피드백 비율이 안전 기준을 초과함");
    }
  }

  const shouldRollback = triggers.length > 0;
  return {
    shouldRollback,
    severity: shouldRollback ? (immediateSafetyIssue ? "critical" : "warning") : "none",
    triggers,
    recommendation: shouldRollback
      ? "직전의 검증된 설정으로 롤백하고 자동화를 일시 중지한 뒤 원인을 검토하세요."
      : enoughPerformanceData
        ? "현재 설정을 유지하고 다음 평가 구간까지 모니터링하세요."
        : "롤백 판단을 위한 표본을 더 수집하되 안전 신호는 계속 감시하세요.",
  };
}

export function assessExperiment(
  experiment: GrowthExperiment,
  policy: GrowthPolicy = DEFAULT_GROWTH_POLICY,
): GrowthAssessment {
  const promotion = evaluatePromotion(experiment, policy);
  const rollback = experiment.postPromotion
    ? evaluateRollback(experiment.candidate.snapshot, experiment.postPromotion, experiment.safety, policy)
    : undefined;

  if (rollback?.shouldRollback) {
    return { promotion, rollback, nextCandidateStatus: "rolled_back" };
  }
  if (promotion.outcome === "promote") {
    return { promotion, rollback, nextCandidateStatus: "promoted" };
  }
  if (promotion.outcome === "reject") {
    return { promotion, rollback, nextCandidateStatus: "rejected" };
  }
  return { promotion, rollback, nextCandidateStatus: "testing" };
}
