import assert from "node:assert/strict";
import test from "node:test";

import {
  assessExperiment,
  evaluatePromotion,
  evaluateRollback,
  scoreCandidate,
// @ts-expect-error Native node:test requires the explicit TypeScript extension.
} from "./growth.ts";
import type { GrowthExperiment, PerformanceSnapshot, SafetySignals } from "./types.ts";

const snapshot = (overrides: Partial<PerformanceSnapshot> = {}): PerformanceSnapshot => ({
  impressions: 30_000,
  views: 19_500,
  engagedViews: 17_000,
  averageViewDurationSeconds: 34,
  averagePercentageViewed: 82,
  viewedVsSwipedAway: 65,
  likes: 1_050,
  comments: 95,
  shares: 260,
  subscribersGained: 120,
  dislikes: 35,
  notInterested: 90,
  estimatedRevenue: 14_000,
  ...overrides,
});

const safeSignals: SafetySignals = {
  policyWarnings: 0,
  copyrightClaims: 0,
  failedRenders: 0,
  manualReviewPassed: true,
  reusedContentRisk: 0.08,
};

const experiment = (overrides: Partial<GrowthExperiment> = {}): GrowthExperiment => ({
  id: "exp-test",
  name: "테스트 후보",
  hypothesis: "새로운 훅이 시청 선택률과 유지율을 높인다.",
  dimension: "hook",
  status: "running",
  candidateStatus: "testing",
  riskLevel: "low",
  startedAt: "2026-07-01T00:00:00Z",
  evaluationHours: 96,
  control: {
    id: "control",
    name: "기존 훅",
    description: "기존 설정",
    snapshot: snapshot(),
  },
  candidate: {
    id: "candidate",
    name: "새 훅",
    description: "개선 후보",
    snapshot: snapshot({
      views: 23_100,
      engagedViews: 21_500,
      averageViewDurationSeconds: 40,
      averagePercentageViewed: 94,
      viewedVsSwipedAway: 77,
      likes: 1_650,
      comments: 150,
      shares: 520,
      subscribersGained: 230,
      dislikes: 25,
      notInterested: 60,
    }),
  },
  safety: safeSignals,
  ...overrides,
});

test("성과가 유의미하게 개선된 안전한 후보를 승격한다", () => {
  const result = evaluatePromotion(experiment());

  assert.equal(result.outcome, "promote");
  assert.ok(result.score >= 62);
  assert.ok(result.confidence >= 0.8);
  assert.deepEqual(result.guardrailBreaches, []);
});

test("표본과 관찰 시간이 부족하면 좋아 보이는 후보도 계속 실험한다", () => {
  const input = experiment({
    evaluationHours: 18,
    control: {
      ...experiment().control,
      snapshot: snapshot({ impressions: 2_000, views: 1_300 }),
    },
    candidate: {
      ...experiment().candidate,
      snapshot: snapshot({
        impressions: 2_100,
        views: 1_700,
        viewedVsSwipedAway: 81,
        likes: 118,
        comments: 11,
        shares: 35,
        subscribersGained: 16,
        dislikes: 2,
        notInterested: 4,
      }),
    },
  });
  const result = evaluatePromotion(input);

  assert.equal(result.outcome, "continue");
  assert.ok(result.sampleReadiness < 1);
  assert.match(result.recommendation, /표본과 관찰 시간/);
});

test("정책 경고는 성과와 무관하게 자동 승격을 막고 사람 검토로 보낸다", () => {
  const input = experiment({
    safety: { ...safeSignals, policyWarnings: 1 },
  });
  const result = evaluatePromotion(input);

  assert.equal(result.outcome, "manual_review");
  assert.ok(result.guardrailBreaches.some((reason) => reason.includes("정책 경고")));
});

test("유지율 보호 기준을 넘게 악화된 후보를 거절한다", () => {
  const base = experiment();
  const input = experiment({
    candidate: {
      ...base.candidate,
      snapshot: snapshot({
        views: 20_400,
        viewedVsSwipedAway: 68,
        averagePercentageViewed: 70,
      }),
    },
  });
  const result = evaluatePromotion(input);

  assert.equal(result.outcome, "reject");
  assert.ok(result.guardrailBreaches.some((reason) => reason.includes("시청 유지율")));
});

test("점수는 입력 이상치가 있어도 유한한 0-100 범위를 유지한다", () => {
  const base = experiment();
  const result = scoreCandidate(
    experiment({
      candidate: {
        ...base.candidate,
        snapshot: snapshot({
          impressions: Number.NaN,
          views: -50,
          averagePercentageViewed: 500,
          viewedVsSwipedAway: Number.POSITIVE_INFINITY,
        }),
      },
    }),
  );

  assert.ok(Number.isFinite(result.score));
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(result.sampleReadiness, 0);
});

test("승격 후 충분한 표본에서 핵심 성과가 하락하면 롤백한다", () => {
  const baseline = snapshot({ viewedVsSwipedAway: 77, averagePercentageViewed: 94 });
  const current = snapshot({
    impressions: 8_000,
    views: 4_700,
    viewedVsSwipedAway: 58.8,
    averagePercentageViewed: 77,
  });
  const result = evaluateRollback(baseline, current, safeSignals);

  assert.equal(result.shouldRollback, true);
  assert.equal(result.severity, "warning");
  assert.ok(result.triggers.length >= 2);
});

test("성과 표본이 적으면 조기 롤백하지 않지만 정책 문제는 즉시 롤백한다", () => {
  const baseline = snapshot({ viewedVsSwipedAway: 77, averagePercentageViewed: 94 });
  const earlyDrop = snapshot({
    impressions: 900,
    viewedVsSwipedAway: 48,
    averagePercentageViewed: 62,
  });

  const performanceOnly = evaluateRollback(baseline, earlyDrop, safeSignals);
  assert.equal(performanceOnly.shouldRollback, false);

  const unsafe = evaluateRollback(baseline, earlyDrop, {
    ...safeSignals,
    copyrightClaims: 1,
  });
  assert.equal(unsafe.shouldRollback, true);
  assert.equal(unsafe.severity, "critical");
});

test("통합 평가는 롤백을 승격보다 우선한다", () => {
  const input = experiment({
    status: "promoted",
    candidateStatus: "promoted",
    postPromotion: snapshot({
      impressions: 9_000,
      views: 4_900,
      viewedVsSwipedAway: 54,
      averagePercentageViewed: 70,
    }),
  });
  const result = assessExperiment(input);

  assert.equal(result.rollback?.shouldRollback, true);
  assert.equal(result.nextCandidateStatus, "rolled_back");
});
