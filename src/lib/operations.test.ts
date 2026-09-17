import assert from "node:assert/strict";
import test from "node:test";

import {
  assessProductionTask,
  productionTasks,
  scoreEvidence,
  scoreHandoff,
  scoreQuality,
  scoreSla,
  summarizeBudgetGuardrail,
// @ts-expect-error Native node:test requires the explicit TypeScript extension.
} from "./operations.ts";

test("ready low-risk task can auto schedule", () => {
  const task = productionTasks.find((item) => item.id === "prod-882");
  assert.ok(task);

  const assessment = assessProductionTask(task);

  assert.equal(assessment.riskLevel, "clear");
  assert.equal(assessment.canAutoSchedule, true);
  assert.ok(assessment.releaseConfidence >= 88);
  assert.equal(assessment.handoffCompletion, 100);
  assert.equal(assessment.requiredActions.length, 0);
});

test("copyright risk forces manual review", () => {
  const task = productionTasks.find((item) => item.id === "prod-881");
  assert.ok(task);

  const assessment = assessProductionTask(task);

  assert.equal(assessment.riskLevel, "review");
  assert.equal(assessment.canAutoSchedule, false);
  assert.ok(assessment.requiredActions.some((action) => action.includes("media")));
  assert.ok(assessment.evidenceScore < 90);
});

test("claim and source weakness lowers readiness", () => {
  const task = productionTasks.find((item) => item.id === "prod-883");
  assert.ok(task);

  const assessment = assessProductionTask(task);

  assert.equal(assessment.riskLevel, "review");
  assert.ok(assessment.readiness < 50);
  assert.ok(assessment.requiredActions.some((action) => action.includes("sources")));
  assert.ok(assessment.requiredActions.some((action) => action.includes("quality")));
});

test("budget summary reports bounded ratio", () => {
  const summary = summarizeBudgetGuardrail({
    id: "over",
    label: "Overage",
    current: 15,
    limit: 10,
    unit: "usd",
    resetAt: "2026-07-20T00:00:00+09:00",
    severity: "critical",
  });

  assert.equal(summary.ratio, 1);
  assert.equal(summary.remaining, 0);
  assert.equal(summary.isOverLimit, true);
});

test("evidence and quality scores reward fully verified production work", () => {
  const task = productionTasks.find((item) => item.id === "prod-882");
  assert.ok(task);

  assert.equal(scoreEvidence(task.evidence), 100);
  assert.ok(scoreQuality(task.qualityChecks) >= 90);
});

test("handoff and SLA scores expose operational readiness", () => {
  const readyTask = productionTasks.find((item) => item.id === "prod-882");
  const riskyTask = productionTasks.find((item) => item.id === "prod-883");
  assert.ok(readyTask);
  assert.ok(riskyTask);

  assert.equal(scoreHandoff(readyTask.handoff), 100);
  assert.ok(scoreSla(readyTask.sla) > scoreSla(riskyTask.sla));

  const assessment = assessProductionTask(riskyTask);
  assert.ok(assessment.requiredActions.some((action) => action.includes("handoff")));
  assert.ok(assessment.requiredActions.some((action) => action.includes("SLA")));
});
