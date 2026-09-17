import { NextResponse } from "next/server";

import { assessProductionTask, operationsData, summarizeBudgetGuardrail } from "@/lib/operations";

export const runtime = "nodejs";

export function GET() {
  const tasks = operationsData.productionTasks.map((task) => ({
    ...task,
    assessment: assessProductionTask(task),
  }));

  const budgets = operationsData.budgetGuardrails.map((guardrail) => ({
    ...guardrail,
    summary: summarizeBudgetGuardrail(guardrail),
  }));

  const summary = {
    autoSchedulable: tasks.filter((task) => task.assessment.canAutoSchedule).length,
    needsReview: tasks.filter((task) => task.assessment.riskLevel === "review").length,
    blocked: tasks.filter((task) => task.assessment.riskLevel === "blocked").length,
    openIncidents: operationsData.incidents.filter((incident) => incident.status !== "resolved").length,
    releaseEvents: operationsData.releaseEvents.length,
    activePolicies: operationsData.channelPolicies.length,
    simulations: operationsData.simulations.length,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(
    {
      ok: true,
      summary,
      tasks,
      budgets,
      incidents: operationsData.incidents,
      releaseEvents: operationsData.releaseEvents,
      channelPolicies: operationsData.channelPolicies,
      simulations: operationsData.simulations,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
