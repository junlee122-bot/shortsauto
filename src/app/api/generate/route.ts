import { ZodError } from "zod";

import {
  createNotRunChecks,
  generateShortsPackage,
  PolicyBlockedError,
} from "@/lib/ai/provider";
import { GenerateRequestSchema } from "@/lib/ai/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 16_384;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return errorResponse(
      413,
      "PAYLOAD_TOO_LARGE",
      "요청 본문은 16KB 이하여야 합니다.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      "INVALID_JSON",
      "올바른 JSON 요청 본문을 전송해 주세요.",
    );
  }

  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "입력값을 다시 확인해 주세요.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 422, headers: noStoreHeaders() },
    );
  }

  try {
    const result = await generateShortsPackage(parsed.data, request.signal);

    return Response.json(
      { ok: true, ...result },
      { status: 200, headers: noStoreHeaders() },
    );
  } catch (error) {
    if (error instanceof PolicyBlockedError) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "POLICY_BLOCKED",
            message: error.message,
          },
          checks: createNotRunChecks(error.policy),
        },
        { status: 422, headers: noStoreHeaders() },
      );
    }

    if (error instanceof ZodError) {
      return errorResponse(
        502,
        "INVALID_GENERATION",
        "생성 결과를 검증하지 못했습니다. 다시 시도해 주세요.",
      );
    }

    if (isAbortError(error) || request.signal.aborted) {
      return errorResponse(
        408,
        "GENERATION_TIMEOUT",
        "생성 시간이 45초를 초과했습니다. 다시 시도해 주세요.",
      );
    }

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "생성 중 예기치 못한 문제가 발생했습니다.",
    );
  }
}

function errorResponse(status: number, code: string, message: string) {
  return Response.json(
    {
      ok: false,
      error: { code, message },
    },
    { status, headers: noStoreHeaders() },
  );
}

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
