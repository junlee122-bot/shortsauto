"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  Gauge,
  ListChecks,
  Lock,
  Play,
  RadioTower,
  ReceiptText,
  ScrollText,
  ShieldAlert,
  Siren,
  Sparkles,
  TimerReset,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { assessProductionTask, operationsData, summarizeBudgetGuardrail } from "@/lib/operations";
import type {
  EvidenceStatus,
  OperationalRisk,
  ProductionLane,
  ProductionPriority,
  QualityStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const laneLabels: Record<ProductionLane, string> = {
  intake: "Intake",
  research: "Research",
  script: "Script",
  edit: "Edit",
  legal_review: "Legal review",
  ready: "Ready",
  scheduled: "Scheduled",
};

const riskTone: Record<OperationalRisk, { label: string; className: string; badge: "success" | "warning" | "danger" | "neutral" }> = {
  clear: { label: "Clear", className: "text-success", badge: "success" },
  watch: { label: "Watch", className: "text-info", badge: "neutral" },
  review: { label: "Review", className: "text-warning", badge: "warning" },
  blocked: { label: "Blocked", className: "text-destructive", badge: "danger" },
};

const priorityTone: Record<ProductionPriority, string> = {
  low: "bg-secondary text-muted-foreground",
  normal: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

const evidenceTone: Record<EvidenceStatus, string> = {
  verified: "text-success",
  needs_review: "text-warning",
  missing: "text-destructive",
  expired: "text-info",
};

const qualityTone: Record<QualityStatus, string> = {
  pass: "text-success",
  watch: "text-warning",
  fail: "text-destructive",
};

export function OperationsPage() {
  const assessments = operationsData.productionTasks.map((task) => ({
    task,
    assessment: assessProductionTask(task),
  }));
  const autoReady = assessments.filter(({ assessment }) => assessment.canAutoSchedule).length;
  const manualReview = assessments.filter(({ assessment }) => assessment.riskLevel === "review").length;
  const blocked = assessments.filter(({ assessment }) => assessment.riskLevel === "blocked").length;
  const openIncidents = operationsData.incidents.filter((incident) => incident.status !== "resolved").length;
  const bestCandidate = assessments
    .filter(({ assessment }) => assessment.canAutoSchedule)
    .sort((a, b) => b.assessment.releaseConfidence - a.assessment.releaseConfidence)[0];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-[linear-gradient(135deg,rgba(124,92,255,.18),rgba(17,19,26,.96)_38%,rgba(34,197,94,.08))]">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" />
              Live operations
              <span>·</span>
              Updated Jul 31, 2026 09:10 KST
              <Badge variant="violet">control plane v3</Badge>
            </div>
            <h1 className="text-[30px] font-bold tracking-tight md:text-[36px]">Production Control</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Approval, evidence, QA, budget, SLA, handoff, and publish timing are brought into one operator-grade control room.
              Automation can move fast, but the final release decision stays traceable.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniSignal label="Next slot" value="20:10" detail="1 safe publish window" icon={CalendarClock} />
              <MiniSignal label="Release confidence" value={bestCandidate ? `${bestCandidate.assessment.releaseConfidence}%` : "Hold"} detail="best schedulable clip" icon={Gauge} />
              <MiniSignal label="Human workload" value="120m" detail="estimated review work" icon={TimerReset} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase text-primary">Operator recommendation</p>
                <h2 className="mt-2 text-lg font-bold leading-6">
                  {bestCandidate ? "Schedule the AI tools clip tonight" : "Hold automation until review clears"}
                </h2>
              </div>
              <Sparkles className="size-5 text-primary" />
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {bestCandidate
                ? bestCandidate.task.decisionBrief.operatorNote
                : "No clip currently satisfies all release gates. Clear rights, fact, or source checks first."}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <GlassMetric label="Auto" value={String(autoReady)} tone="text-success" />
              <GlassMetric label="Review" value={String(manualReview)} tone="text-warning" />
              <GlassMetric label="Incidents" value={String(openIncidents)} tone="text-info" />
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" size="sm">
                <Play />
                Dry run
              </Button>
              <Button variant="secondary" size="sm">
                <ExternalLink />
                Share
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={BadgeCheck} label="Auto schedulable" value={String(autoReady)} detail="No unresolved release gates" tone="text-success" />
        <StatusCard icon={ShieldAlert} label="Needs review" value={String(manualReview)} detail="Policy, claim, or rights risk" tone="text-warning" />
        <StatusCard icon={Lock} label="Blocked" value={String(blocked)} detail="Cannot publish" tone="text-destructive" />
        <StatusCard icon={Siren} label="Open incidents" value={String(openIncidents)} detail="Production watchlist" tone="text-info" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Approval Queue</CardTitle>
              <CardDescription>Each release packet bundles approvals, evidence, QA, handoff, SLA, audience notes, and rollback decisions.</CardDescription>
            </div>
            <Button variant="secondary" size="sm">
              <ReceiptText />
              Export packet
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {assessments.map(({ task, assessment }) => {
              const tone = riskTone[assessment.riskLevel];
              return (
                <article key={task.id} className="overflow-hidden rounded-2xl border border-border bg-background/35">
                  <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-md px-2 py-1 text-[10px] font-bold uppercase", priorityTone[task.priority])}>
                          {task.priority}
                        </span>
                        <Badge variant={tone.badge}>{tone.label}</Badge>
                        <span className="rounded-md bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{laneLabels[task.lane]}</span>
                        <span className="rounded-md bg-secondary px-2 py-1 font-mono text-[10px] text-muted-foreground">{task.id}</span>
                      </div>
                      <h2 className="mt-3 text-base font-semibold leading-6">{task.title}</h2>
                      <p className="mt-1 text-[11px] text-muted-foreground">Working title: {task.workingTitle}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {task.channel} · Owner {task.owner} · due {formatTime(task.dueAt)} · {task.estimatedMinutes} min
                      </p>
                    </div>

                    <div className="rounded-xl bg-card p-3">
                      <ScoreRow label="Readiness" value={assessment.readiness} tone={assessment.canAutoSchedule ? "bg-success" : assessment.readiness >= 70 ? "bg-warning" : "bg-destructive"} />
                      <ScoreRow label="Evidence" value={assessment.evidenceScore} tone={assessment.evidenceScore >= 90 ? "bg-success" : assessment.evidenceScore >= 70 ? "bg-warning" : "bg-destructive"} />
                      <ScoreRow label="QA" value={assessment.qualityScore} tone={assessment.qualityScore >= 88 ? "bg-success" : assessment.qualityScore >= 70 ? "bg-warning" : "bg-destructive"} />
                      <ScoreRow label="Handoff" value={assessment.handoffCompletion} tone={assessment.handoffCompletion === 100 ? "bg-success" : assessment.handoffCompletion >= 70 ? "bg-warning" : "bg-destructive"} />
                      <ScoreRow label="SLA" value={assessment.slaScore} tone={assessment.slaScore >= 82 ? "bg-success" : assessment.slaScore >= 60 ? "bg-warning" : "bg-destructive"} />
                      <div className="mt-3 rounded-lg border border-border bg-background/60 p-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Release confidence</span>
                          <span className={cn("font-mono font-semibold", tone.className)}>{assessment.releaseConfidence}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 border-t border-border p-4 lg:grid-cols-3">
                    <Panel title="Approval gates" icon={ClipboardCheck}>
                      <div className="space-y-2">
                        {task.gates.map((gate) => (
                          <div key={gate.id} className="flex items-start gap-2 text-[11px]">
                            {gate.status === "approved" || gate.status === "not_required" ? (
                              <Check className="mt-0.5 size-3.5 text-success" />
                            ) : gate.status === "blocked" || gate.status === "changes_requested" ? (
                              <AlertTriangle className="mt-0.5 size-3.5 text-destructive" />
                            ) : (
                              <Clock3 className="mt-0.5 size-3.5 text-warning" />
                            )}
                            <div>
                              <p className="font-semibold">{gate.label}</p>
                              <p className="mt-0.5 text-muted-foreground">{gate.note}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel title="Source ledger" icon={ScrollText}>
                      <div className="space-y-2">
                        {task.evidence.map((item) => (
                          <div key={item.id} className="rounded-lg bg-background/60 p-2 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-semibold">{item.label}</span>
                              <span className={cn("shrink-0 text-[10px]", evidenceTone[item.status])}>{item.status}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-muted-foreground">{item.claim}</p>
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel title="Quality matrix" icon={ListChecks}>
                      <div className="space-y-2">
                        {task.qualityChecks.map((check) => (
                          <div key={check.id} className="rounded-lg bg-background/60 p-2 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{check.label}</span>
                              <span className={cn("font-mono text-[10px]", qualityTone[check.status])}>{check.score}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-muted-foreground">{check.detail}</p>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>

                  <div className="grid gap-3 border-t border-border bg-card/35 p-4 lg:grid-cols-[1.15fr_.85fr]">
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">Audience intelligence</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <BriefItem label="Segment" value={task.audience.primarySegment} />
                        <BriefItem label="Retention hook" value={task.audience.retentionHook} />
                        <BriefItem label="Objection" value={task.audience.likelyObjection} />
                        <BriefItem label="Localization" value={task.audience.localizationNotes} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-background/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground">Decision brief</p>
                        <Badge variant={task.decisionBrief.suggestedDecision === "schedule" ? "success" : task.decisionBrief.suggestedDecision === "hold" ? "danger" : "warning"}>
                          {task.decisionBrief.suggestedDecision}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">{task.decisionBrief.operatorNote}</p>
                      <div className="mt-3 rounded-lg bg-card p-2 text-[10px]">
                        <p className="font-semibold">Rollback plan</p>
                        <p className="mt-1 text-muted-foreground">{task.decisionBrief.rollbackPlan}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 border-t border-border p-4 lg:grid-cols-[1.2fr_.8fr]">
                    <div className="rounded-xl bg-card p-3">
                      <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold">
                        <ClipboardCheck className="size-3.5 text-primary" />
                        Producer handoff
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {task.handoff.map((item) => (
                          <div key={item.id} className="rounded-lg bg-background/60 p-2 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{item.label}</span>
                              {item.done ? <Check className="size-3.5 text-success" /> : <Clock3 className="size-3.5 text-warning" />}
                            </div>
                            <p className="mt-1 text-muted-foreground">{item.owner} · {item.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">SLA monitor</p>
                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <p className="font-mono text-2xl font-bold">{task.sla.elapsedMinutes}m</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">of {task.sla.targetMinutes}m target</p>
                        </div>
                        <Badge variant={task.sla.breachRisk === "high" ? "danger" : task.sla.breachRisk === "medium" ? "warning" : "success"}>
                          {task.sla.breachRisk} risk
                        </Badge>
                      </div>
                      <Progress value={Math.min(100, (task.sla.elapsedMinutes / task.sla.targetMinutes) * 100)} className="mt-3" indicatorClassName={task.sla.breachRisk === "high" ? "bg-destructive" : task.sla.breachRisk === "medium" ? "bg-warning" : "bg-success"} />
                      <p className="mt-3 text-[10px] text-muted-foreground">Escalation owner: {task.sla.escalationOwner}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="text-[11px] font-semibold">Recommended window: {formatTime(task.publishWindow.recommendedAt)}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {task.publishWindow.reason} · expected {formatCompact(task.publishWindow.expectedViews[0])}-{formatCompact(task.publishWindow.expectedViews[1])} views
                      </p>
                    </div>
                    <Button variant={assessment.canAutoSchedule ? "default" : "secondary"} size="sm">
                      {assessment.canAutoSchedule ? "Schedule now" : "Open review packet"}
                      <ArrowRight />
                    </Button>
                  </div>
                </article>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Budget Guardrails</CardTitle>
                <CardDescription>Rules that slow automation before quota, cost, or review debt gets uncomfortable.</CardDescription>
              </div>
              <CircleDollarSign className="size-4 text-success" />
            </CardHeader>
            <CardContent className="space-y-3">
              {operationsData.budgetGuardrails.map((guardrail) => {
                const summary = summarizeBudgetGuardrail(guardrail);
                return (
                  <div key={guardrail.id} className="rounded-xl bg-background/45 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{guardrail.label}</span>
                      <span className={cn("font-mono", guardrail.severity === "critical" ? "text-destructive" : guardrail.severity === "watch" ? "text-warning" : "text-success")}>
                        {formatUsage(guardrail.current, guardrail.unit)} / {formatUsage(guardrail.limit, guardrail.unit)}
                      </span>
                    </div>
                    <Progress value={summary.ratio * 100} className="mt-2" indicatorClassName={guardrail.severity === "critical" ? "bg-destructive" : guardrail.severity === "watch" ? "bg-warning" : "bg-success"} />
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Remaining {formatUsage(summary.remaining, guardrail.unit)} · resets {formatTime(guardrail.resetAt)}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Incident Watch</CardTitle>
                <CardDescription>Issues that should pause automation or force a human decision.</CardDescription>
              </div>
              <Gauge className="size-4 text-info" />
            </CardHeader>
            <CardContent className="space-y-3">
              {operationsData.incidents.map((incident) => (
                <div key={incident.id} className="rounded-xl border border-border bg-background/45 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={incident.severity === "critical" ? "danger" : "warning"}>{incident.severity}</Badge>
                    <span className="text-[10px] text-muted-foreground">{incident.status}</span>
                  </div>
                  <p className="mt-3 text-xs font-semibold">{incident.title}</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{incident.impact}</p>
                  <div className="mt-3 rounded-lg bg-card p-2 text-[10px]">
                    <p className="font-semibold">Next action</p>
                    <p className="mt-1 text-muted-foreground">{incident.nextAction}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3" />
                      {incident.owner}
                    </span>
                    <span>{formatTime(incident.startedAt)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Release Events</CardTitle>
                <CardDescription>Auditable activity from gates, QA, incidents, and budgets.</CardDescription>
              </div>
              <RadioTower className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-2">
              {operationsData.releaseEvents.map((event) => (
                <div key={event.id} className="rounded-xl bg-background/45 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={event.severity === "success" ? "success" : event.severity === "critical" ? "danger" : event.severity === "warning" ? "warning" : "neutral"}>
                      {event.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{formatTime(event.occurredAt)}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold">{event.title}</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{event.description}</p>
                  <p className="mt-2 text-[9px] text-muted-foreground">Actor: {event.actor}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Channel Policies</CardTitle>
                <CardDescription>Hard limits and soft brakes applied before publishing.</CardDescription>
              </div>
              <ListChecks className="size-4 text-info" />
            </CardHeader>
            <CardContent className="space-y-3">
              {operationsData.channelPolicies.map((policy) => (
                <div key={policy.id} className="rounded-xl bg-background/45 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{policy.rule}</span>
                    <span className="font-mono text-muted-foreground">{policy.current}/{policy.limit} {policy.unit}</span>
                  </div>
                  <Progress value={(policy.current / policy.limit) * 100} className="mt-2" indicatorClassName={policy.current >= policy.limit ? "bg-destructive" : policy.current / policy.limit > 0.75 ? "bg-warning" : "bg-success"} />
                  <p className="mt-2 text-[10px] text-muted-foreground">{policy.action}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Scenario Lab</CardTitle>
                <CardDescription>Fast what-if decisions before spending review time.</CardDescription>
              </div>
              <TrendingUp className="size-4 text-success" />
            </CardHeader>
            <CardContent className="space-y-3">
              {operationsData.simulations.map((simulation) => (
                <div key={simulation.id} className="rounded-xl border border-border bg-background/45 p-3">
                  <p className="text-xs font-semibold">{simulation.name}</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{simulation.description}</p>
                  <div className="mt-3 grid grid-cols-4 gap-1 text-center">
                    <TinyDelta label="Ready" value={simulation.impact.readyDelta} />
                    <TinyDelta label="Spend" value={simulation.impact.spendDeltaUsd} prefix="$" />
                    <TinyDelta label="Review" value={simulation.impact.reviewMinutesDelta} suffix="m" />
                    <TinyDelta label="Views" value={simulation.impact.expectedViewsDelta} compact />
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-muted-foreground">{simulation.recommendation}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-[linear-gradient(145deg,rgba(124,92,255,.18),rgba(17,19,26,.98)_60%)]">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start gap-3">
                <RadioTower className="mt-0.5 size-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Command log</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Every approval, dry run, and rollback trigger should become an auditable event once persistence is connected.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <GlassMetric label="Checks" value="42" tone="text-primary" />
                <GlassMetric label="Events" value="18" tone="text-info" />
                <GlassMetric label="Rollbacks" value="0" tone="text-success" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MiniSignal({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
        <Icon className="size-3.5 text-primary" />
      </div>
      <p className="mt-2 font-mono text-xl font-bold">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={cn("size-4", tone)} />
        </div>
        <p className="tabular text-2xl font-bold">{value}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ScoreRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{value}</span>
      </div>
      <Progress value={value} indicatorClassName={tone} />
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card p-3">
      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold">
        <Icon className="size-3.5 text-primary" />
        {title}
      </p>
      {children}
    </div>
  );
}

function BriefItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/60 p-2">
      <p className="text-[9px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-[11px] leading-4">{value}</p>
    </div>
  );
}

function GlassMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.04] p-2">
      <p className={cn("font-mono text-lg font-bold", tone)}>{value}</p>
      <p className="mt-0.5 text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

function TinyDelta({
  label,
  value,
  prefix = "",
  suffix = "",
  compact = false,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  compact?: boolean;
}) {
  const formatted = compact ? formatCompact(Math.abs(value)) : Math.abs(value).toString();
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return (
    <div className="rounded-lg bg-card p-2">
      <p className={cn("font-mono text-[11px] font-bold", value > 0 ? "text-success" : value < 0 ? "text-warning" : "text-muted-foreground")}>
        {sign}{prefix}{formatted}{suffix}
      </p>
      <p className="mt-0.5 text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatUsage(value: number, unit: "usd" | "minutes" | "credits" | "count") {
  if (unit === "usd") return `$${value.toFixed(value % 1 === 0 ? 0 : 1)}`;
  if (unit === "minutes") return `${value}m`;
  if (unit === "credits") return `${value}`;
  return `${value}`;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
