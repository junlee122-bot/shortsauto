import type {
  ApprovalGate,
  BudgetGuardrail,
  ChannelPolicy,
  EvidenceStatus,
  HandoffItem,
  Incident,
  OperationalRisk,
  OperationsData,
  ProductionTask,
  QualityStatus,
  ReleaseEvent,
  ScenarioSimulation,
} from "./types";

export interface OperationalAssessment {
  readiness: number;
  riskLevel: OperationalRisk;
  blockers: string[];
  requiredActions: string[];
  canAutoSchedule: boolean;
  evidenceScore: number;
  qualityScore: number;
  releaseConfidence: number;
  slaScore: number;
  handoffCompletion: number;
}

const laneReadiness: Record<ProductionTask["lane"], number> = {
  intake: 12,
  research: 28,
  script: 46,
  edit: 68,
  legal_review: 74,
  ready: 92,
  scheduled: 100,
};

const priorityWeight: Record<ProductionTask["priority"], number> = {
  low: 0,
  normal: 2,
  high: 5,
  urgent: 8,
};

const evidenceWeight: Record<EvidenceStatus, number> = {
  verified: 1,
  needs_review: 0.55,
  expired: 0.25,
  missing: 0,
};

const qualityWeight: Record<QualityStatus, number> = {
  pass: 1,
  watch: 0.62,
  fail: 0,
};

export function assessProductionTask(task: ProductionTask): OperationalAssessment {
  const blockers: string[] = [];
  const requiredActions: string[] = [];

  const blockedGates = task.gates.filter((gate) => gate.status === "blocked");
  const pendingGates = task.gates.filter((gate) => gate.status === "pending");
  const changeRequests = task.gates.filter((gate) => gate.status === "changes_requested");
  const weakEvidence = task.evidence.filter((item) => item.status !== "verified");
  const failedQuality = task.qualityChecks.filter((item) => item.status === "fail");
  const watchedQuality = task.qualityChecks.filter((item) => item.status === "watch");
  const evidenceScore = scoreEvidence(task.evidence);
  const qualityScore = scoreQuality(task.qualityChecks);
  const handoffCompletion = scoreHandoff(task.handoff);
  const slaScore = scoreSla(task.sla);

  if (blockedGates.length > 0) {
    blockers.push(...blockedGates.map((gate) => `${gate.label} blocked by ${gate.owner}`));
  }

  if (task.risk.policyFlags.length > 0) {
    requiredActions.push("Resolve policy flags before publishing");
  }

  if (task.risk.sourceCoverage < 0.8) {
    requiredActions.push("Add at least two independent sources");
  }

  if (evidenceScore < 80) {
    requiredActions.push("Resolve weak or expired evidence before final approval");
  }

  if (task.risk.copyrightRisk >= 0.45) {
    requiredActions.push("Replace or license high-risk media");
  }

  if (task.risk.claimRisk >= 0.35) {
    requiredActions.push("Route factual claims to manual review");
  }

  if (pendingGates.length > 0) {
    requiredActions.push(`Collect ${pendingGates.length} pending approval${pendingGates.length > 1 ? "s" : ""}`);
  }

  if (changeRequests.length > 0) {
    requiredActions.push("Apply requested changes and resubmit");
  }

  if (failedQuality.length > 0) {
    requiredActions.push(`Fix ${failedQuality.length} failed quality check${failedQuality.length > 1 ? "s" : ""}`);
  }

  if (watchedQuality.length >= 2) {
    requiredActions.push("Review clustered QA warnings before scheduling");
  }

  if (handoffCompletion < 100) {
    requiredActions.push("Complete producer handoff checklist");
  }

  if (task.sla.breachRisk === "high") {
    requiredActions.push(`Escalate SLA risk to ${task.sla.escalationOwner}`);
  }

  let riskLevel = task.risk.level;
  if (blockedGates.length > 0 || task.risk.policyFlags.includes("blocked_policy")) {
    riskLevel = "blocked";
  } else if (
    riskLevel !== "blocked" &&
    (task.risk.copyrightRisk >= 0.45 ||
      task.risk.claimRisk >= 0.35 ||
      changeRequests.length > 0 ||
      failedQuality.length > 0 ||
      evidenceScore < 70)
  ) {
    riskLevel = "review";
  } else if (
    riskLevel === "clear" &&
    (task.risk.sourceCoverage < 0.8 ||
      pendingGates.length > 0 ||
      task.risk.costEstimateUsd > 12 ||
      weakEvidence.length > 0 ||
      watchedQuality.length > 0 ||
      task.sla.breachRisk !== "low")
  ) {
    riskLevel = "watch";
  }

  const approvalPenalty = pendingGates.length * 8 + changeRequests.length * 14 + blockedGates.length * 35;
  const riskPenalty =
    task.risk.policyFlags.length * 8 +
    Math.round(task.risk.copyrightRisk * 18) +
    Math.round(task.risk.claimRisk * 18) +
    Math.max(0, Math.round((0.85 - task.risk.sourceCoverage) * 30)) +
    Math.max(0, Math.round((82 - evidenceScore) * 0.28)) +
    Math.max(0, Math.round((84 - qualityScore) * 0.24)) +
    Math.max(0, Math.round((100 - handoffCompletion) * 0.12)) +
    Math.max(0, Math.round((88 - slaScore) * 0.16));
  const readiness = clamp(
    laneReadiness[task.lane] + priorityWeight[task.priority] - approvalPenalty - riskPenalty,
    0,
    100,
  );
  const releaseConfidence = clamp(
    Math.round(
      readiness * 0.38 +
      evidenceScore * 0.22 +
      qualityScore * 0.18 +
      handoffCompletion * 0.08 +
      slaScore * 0.06 +
      task.decisionBrief.releaseConfidence * 0.08,
    ),
    0,
    100,
  );

  return {
    readiness,
    riskLevel,
    blockers,
    requiredActions,
    evidenceScore,
    qualityScore,
    releaseConfidence,
    slaScore,
    handoffCompletion,
    canAutoSchedule:
      readiness >= 88 &&
      releaseConfidence >= 88 &&
      riskLevel === "clear" &&
      requiredActions.length === 0,
  };
}

export function scoreEvidence(evidence: ProductionTask["evidence"]) {
  if (evidence.length === 0) return 0;
  const score = evidence.reduce((total, item) => total + evidenceWeight[item.status], 0) / evidence.length;
  return Math.round(score * 100);
}

export function scoreQuality(checks: ProductionTask["qualityChecks"]) {
  if (checks.length === 0) return 0;
  const weighted = checks.reduce((total, item) => total + item.score * qualityWeight[item.status], 0);
  return Math.round(weighted / checks.length);
}

export function scoreHandoff(items: HandoffItem[]) {
  if (items.length === 0) return 0;
  const completed = items.filter((item) => item.done).length;
  return Math.round((completed / items.length) * 100);
}

export function scoreSla(sla: ProductionTask["sla"]) {
  const ratio = sla.targetMinutes === 0 ? 1 : sla.elapsedMinutes / sla.targetMinutes;
  const base = Math.round((1 - clamp(ratio, 0, 1)) * 100);
  const riskPenalty = sla.breachRisk === "high" ? 35 : sla.breachRisk === "medium" ? 16 : 0;
  return clamp(base + 35 - riskPenalty, 0, 100);
}

export function summarizeBudgetGuardrail(guardrail: BudgetGuardrail) {
  const ratio = guardrail.limit === 0 ? 1 : guardrail.current / guardrail.limit;
  return {
    ratio: clamp(ratio, 0, 1),
    remaining: Math.max(0, guardrail.limit - guardrail.current),
    isOverLimit: guardrail.current > guardrail.limit,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const gates = {
  fact: (status: ApprovalGate["status"], note: string): ApprovalGate => ({
    id: "gate-fact",
    label: "Fact check",
    owner: "Research lead",
    status,
    dueAt: "2026-07-18T15:30:00+09:00",
    note,
  }),
  rights: (status: ApprovalGate["status"], note: string): ApprovalGate => ({
    id: "gate-rights",
    label: "Rights clearance",
    owner: "Producer",
    status,
    dueAt: "2026-07-18T16:00:00+09:00",
    note,
  }),
  brand: (status: ApprovalGate["status"], note: string): ApprovalGate => ({
    id: "gate-brand",
    label: "Brand review",
    owner: "Channel manager",
    status,
    dueAt: "2026-07-18T17:00:00+09:00",
    note,
  }),
};

const evidence = {
  verified: (id: string, label: string, claim: string, sourceType: ProductionTask["evidence"][number]["sourceType"] = "official") => ({
    id,
    label,
    url: `https://sources.shortauto.local/${id}`,
    sourceType,
    status: "verified" as const,
    checkedAt: "2026-07-18T13:20:00+09:00",
    claim,
  }),
  review: (id: string, label: string, claim: string, sourceType: ProductionTask["evidence"][number]["sourceType"] = "newsroom") => ({
    id,
    label,
    url: `https://sources.shortauto.local/${id}`,
    sourceType,
    status: "needs_review" as const,
    checkedAt: "2026-07-18T13:20:00+09:00",
    claim,
  }),
  expired: (id: string, label: string, claim: string) => ({
    id,
    label,
    url: `https://sources.shortauto.local/${id}`,
    sourceType: "official" as const,
    status: "expired" as const,
    checkedAt: "2026-06-28T09:00:00+09:00",
    claim,
  }),
};

const qa = {
  pass: (id: string, label: string, score: number, detail: string) => ({
    id,
    label,
    status: "pass" as const,
    score,
    detail,
  }),
  watch: (id: string, label: string, score: number, detail: string) => ({
    id,
    label,
    status: "watch" as const,
    score,
    detail,
  }),
  fail: (id: string, label: string, score: number, detail: string) => ({
    id,
    label,
    status: "fail" as const,
    score,
    detail,
  }),
};

const handoff = (items: Array<[string, string, string, boolean, string]>): HandoffItem[] =>
  items.map(([id, label, owner, done, detail]) => ({ id, label, owner, done, detail }));

export const productionTasks: ProductionTask[] = [
  {
    id: "prod-881",
    shortId: "short-006",
    title: "Why rain has a different name by smell",
    workingTitle: "The science behind petrichor in 38 seconds",
    channel: "@one.minute.lab",
    lane: "legal_review",
    priority: "urgent",
    owner: "Mina",
    dueAt: "2026-07-18T16:30:00+09:00",
    estimatedMinutes: 24,
    automationId: "automation-daily-facts",
    gates: [
      gates.fact("approved", "Two science references confirmed the core claim."),
      gates.rights("pending", "Replace one stock clip with licensed footage."),
      gates.brand("approved", "Caption and thumbnail follow the channel kit."),
    ],
    risk: {
      level: "review",
      policyFlags: [],
      copyrightRisk: 0.52,
      claimRisk: 0.12,
      sourceCoverage: 0.92,
      costEstimateUsd: 7.8,
    },
    publishWindow: {
      recommendedAt: "2026-07-18T19:40:00+09:00",
      reason: "Saturday evening science curiosity slot is trending 18% above baseline.",
      expectedViews: [310_000, 680_000],
    },
    audience: {
      primarySegment: "Korean viewers who save science trivia and language-origin clips",
      retentionHook: "Open with the smell-memory contrast before naming petrichor.",
      likelyObjection: "Viewers may call the claim oversimplified if bacteria/geosmin is omitted.",
      localizationNotes: "Use the Korean word for rain smell first, then introduce petrichor as a reveal.",
    },
    evidence: [
      evidence.verified("rain-royal-society", "Royal Society note", "Petrichor is tied to plant oils and geosmin."),
      evidence.verified("rain-mit-news", "MIT aerosol study", "Raindrops can aerosolize scent compounds."),
      evidence.review("rain-stock-license", "Footage license memo", "One rain macro clip needs replacement proof.", "internal"),
    ],
    qualityChecks: [
      qa.pass("qa-hook", "First 2-second hook", 94, "The open visual has strong contrast and a specific sensory promise."),
      qa.watch("qa-rights", "Media rights scan", 72, "Clip 03 uses a library preview asset until replacement is confirmed."),
      qa.pass("qa-captions", "Caption safe area", 91, "Korean and English terms stay inside the Shorts safe region."),
      qa.pass("qa-audio", "Voice and music mix", 88, "Narration remains above music bed by 9 dB."),
    ],
    decisionBrief: {
      operatorNote: "Strong creative. Do not publish until the rain macro clip is swapped or license proof is attached.",
      suggestedDecision: "revise",
      releaseConfidence: 78,
      rollbackPlan: "If rights claim appears, unlist immediately and replace with generated rain texture version.",
    },
    handoff: handoff([
      ["handoff-script", "Final script locked", "Mina", true, "Narration is approved after science terminology pass."],
      ["handoff-media", "Replacement media attached", "Producer", false, "Clip 03 still needs licensed replacement."],
      ["handoff-thumb", "Thumbnail exported", "Designer", true, "Petrichor reveal thumbnail exported at 1080x1920."],
      ["handoff-rollback", "Rollback asset ready", "Mina", true, "Generated rain texture fallback is ready."],
    ]),
    sla: {
      targetMinutes: 90,
      elapsedMinutes: 64,
      breachRisk: "medium",
      escalationOwner: "Channel manager",
    },
  },
  {
    id: "prod-882",
    title: "Three AI tools founders should learn this week",
    workingTitle: "3 AI tools worth learning before Monday",
    channel: "@one.minute.lab",
    lane: "ready",
    priority: "high",
    owner: "Jun",
    dueAt: "2026-07-18T18:00:00+09:00",
    estimatedMinutes: 12,
    automationId: "automation-tech-brief",
    gates: [
      gates.fact("approved", "Pricing and feature references checked today."),
      gates.rights("approved", "All screen captures are first-party product UI."),
      gates.brand("approved", "CTA changed to save/share instead of hard sell."),
    ],
    risk: {
      level: "clear",
      policyFlags: [],
      copyrightRisk: 0.08,
      claimRisk: 0.09,
      sourceCoverage: 0.96,
      costEstimateUsd: 5.1,
    },
    publishWindow: {
      recommendedAt: "2026-07-18T20:10:00+09:00",
      reason: "Audience saves peak after 20:00 for tool recommendation clips.",
      expectedViews: [220_000, 510_000],
    },
    audience: {
      primarySegment: "Solo founders, operators, and creator-business owners",
      retentionHook: "Promise only three tools and name the payoff for each in the first five seconds.",
      likelyObjection: "The clip can feel like an ad if product names arrive before use cases.",
      localizationNotes: "Use Korean interface labels where available; keep English product names untouched.",
    },
    evidence: [
      evidence.verified("ai-tool-docs-1", "Vendor docs", "Feature claims match public product documentation.", "first_party"),
      evidence.verified("ai-tool-pricing-1", "Pricing snapshots", "Pricing mentions were checked on the same day.", "first_party"),
      evidence.verified("ai-tool-internal-test", "Internal workflow test", "Each recommended tool completed the stated founder task.", "internal"),
    ],
    qualityChecks: [
      qa.pass("qa-save-value", "Save-worthy utility", 96, "Each tool has a concrete workflow and output example."),
      qa.pass("qa-disclosure", "Sponsored-content scan", 92, "No paid placement language or undisclosed endorsement."),
      qa.pass("qa-captions", "Readable captions", 94, "Tool names are highlighted without covering UI captures."),
      qa.pass("qa-pacing", "Pacing", 90, "Scene length averages 3.8 seconds with no long dead zones."),
    ],
    decisionBrief: {
      operatorNote: "This is the cleanest candidate in the queue. Safe to schedule if the daily cap remains open.",
      suggestedDecision: "schedule",
      releaseConfidence: 94,
      rollbackPlan: "If a product changes pricing before publish, swap the pricing line for a non-price benefit.",
    },
    handoff: handoff([
      ["handoff-script", "Final script locked", "Jun", true, "No factual edits pending."],
      ["handoff-media", "Screen captures approved", "Producer", true, "First-party UI captures are cleared."],
      ["handoff-thumb", "Thumbnail exported", "Designer", true, "Dark UI thumbnail with three tool chips."],
      ["handoff-rollback", "Fallback copy ready", "Jun", true, "Non-price version is ready if pricing changes."],
    ]),
    sla: {
      targetMinutes: 120,
      elapsedMinutes: 38,
      breachRisk: "low",
      escalationOwner: "Jun",
    },
  },
  {
    id: "prod-883",
    title: "A health habit that looks productive but hurts sleep",
    workingTitle: "The productivity habit that quietly breaks sleep",
    channel: "@one.minute.lab",
    lane: "script",
    priority: "normal",
    owner: "Sora",
    dueAt: "2026-07-19T11:00:00+09:00",
    estimatedMinutes: 38,
    automationId: "automation-evening-wellness",
    gates: [
      gates.fact("changes_requested", "Avoid medical certainty and add a disclaimer."),
      gates.rights("not_required", "Uses generated graphics only."),
      gates.brand("pending", "Waiting for tone review."),
    ],
    risk: {
      level: "review",
      policyFlags: ["medical_claim"],
      copyrightRisk: 0.02,
      claimRisk: 0.44,
      sourceCoverage: 0.68,
      costEstimateUsd: 4.6,
    },
    publishWindow: {
      recommendedAt: "2026-07-19T21:10:00+09:00",
      reason: "Wellness audience retention is strongest after commute hours.",
      expectedViews: [140_000, 330_000],
    },
    audience: {
      primarySegment: "Office workers who watch practical wellness clips at night",
      retentionHook: "Frame the habit as a common routine, then soften the claim with context.",
      likelyObjection: "Medical certainty would trigger distrust and policy risk.",
      localizationNotes: "Keep the disclaimer conversational, not legalistic.",
    },
    evidence: [
      evidence.review("sleep-review-1", "Sleep foundation article", "Blue-light and stress timing guidance needs stronger source hierarchy."),
      evidence.review("sleep-paper-1", "Circadian rhythm paper", "Paper supports timing sensitivity but not the exact script wording.", "academic"),
      evidence.verified("sleep-disclaimer", "Medical disclaimer pattern", "Language avoids diagnosis, treatment, or individualized advice.", "internal"),
    ],
    qualityChecks: [
      qa.watch("qa-medical-tone", "Medical tone", 68, "Several lines still sound prescriptive rather than informational."),
      qa.fail("qa-claim-strength", "Claim strength", 54, "The causal wording overstates what the attached sources support."),
      qa.pass("qa-visual", "Visual clarity", 86, "Night routine sequence is easy to follow."),
      qa.watch("qa-retention", "Retention shape", 70, "The middle section becomes advice-heavy and needs a sharper example."),
    ],
    decisionBrief: {
      operatorNote: "Hold this until the script is reframed as general context and stronger public-health references are attached.",
      suggestedDecision: "hold",
      releaseConfidence: 52,
      rollbackPlan: "If published by mistake, pause automation-evening-wellness and replace with neutral sleep-hygiene explainer.",
    },
    handoff: handoff([
      ["handoff-script", "Medical wording softened", "Sora", false, "Claim strength still exceeds attached evidence."],
      ["handoff-source", "Public-health sources attached", "Research lead", false, "Needs stronger source hierarchy."],
      ["handoff-thumb", "Thumbnail exported", "Designer", true, "Neutral night routine thumbnail is ready."],
      ["handoff-rollback", "Automation pause plan", "Sora", true, "Evening wellness recipe can be paused safely."],
    ]),
    sla: {
      targetMinutes: 180,
      elapsedMinutes: 142,
      breachRisk: "high",
      escalationOwner: "Research lead",
    },
  },
  {
    id: "prod-884",
    title: "Old top performer remix: subway map shortcuts",
    workingTitle: "Seoul subway shortcuts people still miss",
    channel: "@one.minute.lab",
    lane: "edit",
    priority: "low",
    owner: "Dain",
    dueAt: "2026-07-20T14:00:00+09:00",
    estimatedMinutes: 46,
    automationId: "automation-daily-facts",
    gates: [
      gates.fact("pending", "Need current route data after the July timetable update."),
      gates.rights("approved", "Original animation assets found in brand library."),
      gates.brand("pending", "Thumbnail style needs refresh."),
    ],
    risk: {
      level: "watch",
      policyFlags: [],
      copyrightRisk: 0.18,
      claimRisk: 0.26,
      sourceCoverage: 0.74,
      costEstimateUsd: 3.2,
    },
    publishWindow: {
      recommendedAt: "2026-07-20T12:20:00+09:00",
      reason: "Transit clips overperform during lunch planning windows.",
      expectedViews: [180_000, 420_000],
    },
    audience: {
      primarySegment: "Seoul commuters and travel-planning viewers",
      retentionHook: "Start with a station-name puzzle before showing the shortcut route.",
      likelyObjection: "Outdated timetable details can get corrected aggressively in comments.",
      localizationNotes: "Show station names in Korean first, English second.",
    },
    evidence: [
      evidence.expired("subway-timetable", "Metro timetable snapshot", "Schedule data predates the July timetable update."),
      evidence.verified("subway-map-assets", "Owned animation library", "Original map animation assets are cleared for reuse.", "internal"),
      evidence.review("subway-comment-mining", "Comment-mined tip list", "Viewer-submitted shortcut needs official confirmation.", "internal"),
    ],
    qualityChecks: [
      qa.pass("qa-remix", "Remix originality", 84, "New intro and map motion reduce reused-content risk."),
      qa.watch("qa-data-age", "Data freshness", 64, "Transit data must be refreshed before approval."),
      qa.pass("qa-thumbnail", "Thumbnail contrast", 88, "Route contrast is readable on mobile."),
      qa.watch("qa-comments", "Comment-risk forecast", 66, "Likely corrections if the route timing is not current."),
    ],
    decisionBrief: {
      operatorNote: "Good remix candidate, but it needs current transit verification before entering final review.",
      suggestedDecision: "revise",
      releaseConfidence: 66,
      rollbackPlan: "If timetable corrections appear, pin correction comment and push a revised version within 24 hours.",
    },
    handoff: handoff([
      ["handoff-route", "Current route verified", "Dain", false, "July timetable update is not reflected yet."],
      ["handoff-media", "Owned map assets attached", "Producer", true, "Original map animation file is in the brand library."],
      ["handoff-thumb", "Thumbnail refreshed", "Designer", false, "Needs updated station text hierarchy."],
      ["handoff-rollback", "Correction copy ready", "Dain", true, "Pinned correction template is ready."],
    ]),
    sla: {
      targetMinutes: 240,
      elapsedMinutes: 96,
      breachRisk: "medium",
      escalationOwner: "Operations lead",
    },
  },
];

export const budgetGuardrails: BudgetGuardrail[] = [
  {
    id: "budget-ai",
    label: "AI generation",
    current: 184,
    limit: 260,
    unit: "credits",
    resetAt: "2026-07-25T00:00:00+09:00",
    severity: "watch",
  },
  {
    id: "budget-render",
    label: "Render minutes",
    current: 72,
    limit: 120,
    unit: "minutes",
    resetAt: "2026-07-25T00:00:00+09:00",
    severity: "ok",
  },
  {
    id: "budget-spend",
    label: "Weekly spend",
    current: 128.4,
    limit: 180,
    unit: "usd",
    resetAt: "2026-07-22T00:00:00+09:00",
    severity: "watch",
  },
  {
    id: "budget-posts",
    label: "Daily publish cap",
    current: 1,
    limit: 2,
    unit: "count",
    resetAt: "2026-07-19T00:00:00+09:00",
    severity: "ok",
  },
];

export const incidents: Incident[] = [
  {
    id: "inc-104",
    title: "Licensed footage replacement required",
    severity: "warning",
    status: "investigating",
    startedAt: "2026-07-18T13:42:00+09:00",
    owner: "Mina",
    impact: "One urgent clip cannot auto-schedule until media is replaced.",
    nextAction: "Swap clip 03 with library asset SA-Rain-041 and rerun rights scan.",
  },
  {
    id: "inc-105",
    title: "Health script claim confidence below threshold",
    severity: "warning",
    status: "open",
    startedAt: "2026-07-18T14:08:00+09:00",
    owner: "Sora",
    impact: "Automation-evening-wellness is paused for medical-style claims.",
    nextAction: "Rewrite as general wellness context and attach two public-health sources.",
  },
];

export const releaseEvents: ReleaseEvent[] = [
  {
    id: "evt-991",
    type: "qa",
    title: "AI tools clip cleared QA",
    description: "Evidence, captions, disclosure, and pacing checks all passed.",
    actor: "QA automation",
    occurredAt: "2026-07-20T08:42:00+09:00",
    severity: "success",
  },
  {
    id: "evt-992",
    type: "gate",
    title: "Rain clip rights gate still pending",
    description: "Clip 03 needs replacement media before schedule approval.",
    actor: "Producer",
    occurredAt: "2026-07-20T08:56:00+09:00",
    severity: "warning",
  },
  {
    id: "evt-993",
    type: "incident",
    title: "Health claim escalated",
    description: "Medical-style claim wording triggered manual review.",
    actor: "Policy guardrail",
    occurredAt: "2026-07-20T09:04:00+09:00",
    severity: "warning",
  },
  {
    id: "evt-994",
    type: "budget",
    title: "Weekly spend under control",
    description: "Projected spend remains below cap after tonight's recommended schedule.",
    actor: "Budget guardrail",
    occurredAt: "2026-07-20T09:08:00+09:00",
    severity: "info",
  },
];

export const channelPolicies: ChannelPolicy[] = [
  {
    id: "policy-daily-cap",
    channel: "@one.minute.lab",
    rule: "Daily public Shorts cap",
    current: 1,
    limit: 2,
    unit: "posts",
    action: "Allow one more public release today.",
  },
  {
    id: "policy-review-warning",
    channel: "@one.minute.lab",
    rule: "Manual-review warning budget",
    current: 2,
    limit: 3,
    unit: "warnings",
    action: "Pause wellness recipe if one more warning appears.",
  },
  {
    id: "policy-render-minutes",
    channel: "@one.minute.lab",
    rule: "Nightly render allocation",
    current: 72,
    limit: 120,
    unit: "minutes",
    action: "Keep remix renders in draft until midnight reset.",
  },
];

export const simulations: ScenarioSimulation[] = [
  {
    id: "sim-schedule-tools",
    name: "Schedule clean AI tools clip",
    description: "Use the remaining daily publish slot on the highest-confidence candidate.",
    impact: {
      readyDelta: -1,
      spendDeltaUsd: 5.1,
      reviewMinutesDelta: -12,
      expectedViewsDelta: 365_000,
    },
    recommendation: "Recommended. It spends little, frees the queue, and has the cleanest rollback path.",
  },
  {
    id: "sim-fix-rights",
    name: "Replace rain footage first",
    description: "Spend producer time resolving rights before the evening science slot.",
    impact: {
      readyDelta: 1,
      spendDeltaUsd: 2.4,
      reviewMinutesDelta: 24,
      expectedViewsDelta: 490_000,
    },
    recommendation: "Worth doing only if licensed media can be attached before 18:30 KST.",
  },
  {
    id: "sim-hold-wellness",
    name: "Hold wellness automation",
    description: "Pause the health recipe until claim language and sources are repaired.",
    impact: {
      readyDelta: 0,
      spendDeltaUsd: 0,
      reviewMinutesDelta: 38,
      expectedViewsDelta: -210_000,
    },
    recommendation: "Recommended. Avoids policy debt and protects channel trust.",
  },
];

export const operationsData: OperationsData = {
  productionTasks,
  budgetGuardrails,
  incidents,
  releaseEvents,
  channelPolicies,
  simulations,
};
