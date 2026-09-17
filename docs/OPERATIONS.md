# ShortsAuto Operations Runbook

This runbook defines the production controls that make ShortsAuto usable by a real content team instead of a simple generation demo.

## Daily Review

1. Open `/operations`.
2. Clear urgent approval gates first.
3. Resolve every task marked `Review` or `Blocked` before the recommended publish window.
4. Confirm budget guardrails before starting a new batch.
5. Check incident watch items before enabling unattended automation.

## Auto-Scheduling Rules

A clip may be auto-scheduled only when all of these are true:

- readiness score is at least 88;
- release confidence is at least 88;
- operational risk is `clear`;
- every required approval gate is approved or not required;
- evidence score is healthy and every critical source is verified;
- QA score is healthy with no failed check;
- producer handoff checklist is complete;
- SLA breach risk is low or explicitly accepted by an escalation owner;
- copyright risk is below 0.45;
- claim risk is below 0.35;
- source coverage is at least 0.8;
- no policy flag is present;
- the daily publish cap has remaining capacity.

The implementation lives in `src/lib/operations.ts` and is covered by `src/lib/operations.test.ts`.

## Manual Review Triggers

Route clips to a human reviewer when any of these signals appear:

- medical, financial, legal, or political claims;
- weak source coverage;
- expired or unverified source evidence;
- failed claim-strength, rights, audio, caption, or localization QA;
- reused or unlicensed media risk;
- requested changes from fact, rights, or brand review;
- a cost estimate that would push weekly spend above the workspace guardrail.

## Review Packet Expectations

Every production task should include:

- `workingTitle`: internal title used by editors and reviewers;
- `audience`: segment, retention hook, likely objection, and localization notes;
- `evidence`: source ledger with status, source type, checked time, and supported claim;
- `qualityChecks`: hook, rights, captions, pacing, claim strength, and media checks;
- `decisionBrief`: operator note, suggested decision, release confidence, and rollback plan.
- `handoff`: production handoff items with owner, status, and completion notes;
- `sla`: elapsed time, target time, breach risk, and escalation owner.

The UI surfaces these as the approval queue, source ledger, quality matrix, audience intelligence, decision brief, producer handoff, SLA monitor, release events, channel policies, and scenario lab. The API returns the same structure so external dashboards can stay in sync.

## Integration Contract

`GET /api/operations` returns:

- `summary`: counts for auto-schedulable, review, blocked, and incident items;
- `tasks`: production tasks with computed assessments;
- `tasks[].assessment`: readiness, evidence score, QA score, handoff completion, SLA score, release confidence, and auto-schedule eligibility;
- `budgets`: budget guardrails with remaining usage;
- `incidents`: active production watch items.
- `releaseEvents`: auditable gate, QA, budget, incident, publish, and rollback events.
- `channelPolicies`: hard limits and soft brakes before publishing.
- `simulations`: what-if scenarios for publish, review, spend, and expected-view tradeoffs.

This endpoint is intentionally no-store so operators and external automation always see fresh control-plane data.

## Incident Response

For every open incident:

1. Assign one owner.
2. Record user or channel impact.
3. Define the next concrete action.
4. Keep affected automations paused until the related production task returns to `clear`.
