import {
  generateText,
  NoObjectGeneratedError,
  Output,
  type LanguageModelUsage,
} from "ai";

import {
  type CostCheck,
  type GenerateRequest,
  type PolicyCheck,
  type QualityCheck,
  type ShortsPackage,
  ShortsPackageSchema,
} from "./schema";

const PROMPT_VERSION = "shorts-director-v1.0";
const DEMO_MODEL = "deterministic-demo-v1";

const modelByQuality = {
  fast: process.env.AI_MODEL_FAST ?? "openai/gpt-5.4-mini",
  balanced: process.env.AI_MODEL_BALANCED ?? "openai/gpt-5.4-mini",
  premium: process.env.AI_MODEL_PREMIUM ?? "openai/gpt-5.4",
} as const;

const maxOutputTokensByQuality = {
  fast: 1_800,
  balanced: 2_600,
  premium: 3_600,
} as const;

const pricingPerMillion: Record<
  string,
  { input: number; output: number; source: string }
> = {
  "openai/gpt-5.4-mini": {
    input: 0.75,
    output: 4.5,
    source: "OpenAI public API pricing (2026-07)",
  },
  "openai/gpt-5.4": {
    input: 2.5,
    output: 15,
    source: "OpenAI public API pricing (2026-07)",
  },
};

export type GenerationResult = {
  mode: "ai" | "demo";
  model: string;
  fallbackReason?: "credentials_missing" | "provider_unavailable";
  generation: ShortsPackage;
  checks: {
    cost: CostCheck;
    quality: QualityCheck;
    policy: PolicyCheck;
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  meta: {
    promptVersion: string;
    deterministic: boolean;
    degraded: boolean;
  };
};

export class PolicyBlockedError extends Error {
  readonly policy: PolicyCheck;

  constructor(policy: PolicyCheck) {
    super("안전 정책에 따라 이 주제로는 콘텐츠를 생성할 수 없습니다.");
    this.name = "PolicyBlockedError";
    this.policy = policy;
  }
}

export async function generateShortsPackage(
  input: GenerateRequest,
  requestSignal?: AbortSignal,
): Promise<GenerationResult> {
  const inputPolicy = evaluatePolicy(`${input.topic}\n${input.audience}`);

  if (inputPolicy.status === "blocked") {
    throw new PolicyBlockedError(inputPolicy);
  }

  if (!hasGatewayCredentials()) {
    return createDemoResult(input, inputPolicy, "credentials_missing");
  }

  const model = modelByQuality[input.quality];

  try {
    const result = await generateText({
      model,
      output: Output.object({
        name: "youtube_shorts_production_package",
        description:
          "A production-ready YouTube Shorts script, shot list, metadata, and self-review.",
        schema: ShortsPackageSchema,
      }),
      system: buildSystemPrompt(input),
      prompt: buildUserPrompt(input),
      maxOutputTokens: maxOutputTokensByQuality[input.quality],
      maxRetries: 2,
      abortSignal: combineSignals(requestSignal),
      providerOptions: {
        gateway: {
          tags: ["shortsauto", PROMPT_VERSION, `quality:${input.quality}`],
          zeroDataRetention: true,
        },
      },
    });

    const generation = normalizeGeneration(result.output, input.durationSeconds);
    const usage = normalizeUsage(result.totalUsage);
    const policy = mergePolicyChecks(
      inputPolicy,
      evaluatePolicy(serializeForPolicy(generation)),
    );

    return {
      mode: "ai",
      model,
      generation,
      checks: {
        cost: evaluateCost(model, usage),
        quality: evaluateQuality(generation, input.durationSeconds),
        policy,
      },
      usage,
      meta: {
        promptVersion: PROMPT_VERSION,
        deterministic: false,
        degraded: false,
      },
    };
  } catch (error) {
    if (isAbortError(error) || requestSignal?.aborted) {
      throw error;
    }

    const fallback = createDemoResult(input, inputPolicy, "provider_unavailable");
    if (NoObjectGeneratedError.isInstance(error)) {
      fallback.checks.quality.notes.push(
        "AI의 구조화 응답이 스키마를 통과하지 못해 검증된 데모 결과로 대체했습니다.",
      );
    }
    return fallback;
  }
}

export function createNotRunChecks(policy: PolicyCheck) {
  return {
    cost: {
      status: "not_run" as const,
      estimatedUsd: null,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      pricingSource: "not applicable",
      note: "생성이 시작되지 않아 비용이 발생하지 않았습니다.",
    },
    quality: {
      status: "not_run" as const,
      score: 0,
      criteria: {
        hook: false,
        pacing: false,
        readability: false,
        metadata: false,
        callToAction: false,
      },
      notes: ["정책 차단으로 품질 검사를 실행하지 않았습니다."],
    },
    policy,
  };
}

function hasGatewayCredentials() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL === "1",
  );
}

function buildSystemPrompt(input: GenerateRequest) {
  const qualityDirection = {
    fast: "Prioritize clarity and speed. Use a compact, executable shot plan.",
    balanced:
      "Balance novelty, retention, production feasibility, and factual restraint.",
    premium:
      "Push for a distinctive creative angle, pattern interrupts, and unusually polished production detail.",
  }[input.quality];

  return [
    "You are a senior Korean YouTube Shorts creative director and retention editor.",
    "Return only the requested structured output. Write all audience-facing copy in natural Korean.",
    "Do not fabricate statistics, quotes, credentials, news, or guaranteed outcomes.",
    "Avoid unsafe instructions, harassment, graphic detail, and copyrighted lyrics.",
    "The first spoken line must create an information gap within two seconds.",
    "Every scene must be visually executable in a vertical 9:16 edit.",
    "Keep on-screen text short enough to read on a phone in under two seconds.",
    `The complete scene timeline must start at 0 and end at exactly ${input.durationSeconds} seconds without gaps or overlap.`,
    qualityDirection,
  ].join("\n");
}

function buildUserPrompt(input: GenerateRequest) {
  return [
    `Topic: ${input.topic}`,
    `Target audience: ${input.audience}`,
    `Duration: ${input.durationSeconds} seconds`,
    `Tone: ${input.tone}`,
    `Quality preset: ${input.quality}`,
    "Create one publish-ready package with a hook, coherent script, timed scenes, editing instructions, SEO metadata, and an honest self-review.",
    "Use 3-8 scenes. Start at second 0, use contiguous integer timestamps, and end at the requested duration.",
    "Apply one concrete improvement before returning the final package and describe it in selfReview.improvementApplied.",
  ].join("\n");
}

function createDemoResult(
  input: GenerateRequest,
  inputPolicy: PolicyCheck,
  fallbackReason: "credentials_missing" | "provider_unavailable",
): GenerationResult {
  const generation = createDeterministicDemo(input);
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const policy = mergePolicyChecks(
    inputPolicy,
    evaluatePolicy(serializeForPolicy(generation)),
  );

  return {
    mode: "demo",
    model: DEMO_MODEL,
    fallbackReason,
    generation,
    checks: {
      cost: {
        status: "within_budget",
        estimatedUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        pricingSource: "deterministic local generator",
        note: "데모 폴백은 외부 AI를 호출하지 않아 비용이 발생하지 않습니다.",
      },
      quality: evaluateQuality(generation, input.durationSeconds),
      policy,
    },
    usage,
    meta: {
      promptVersion: PROMPT_VERSION,
      deterministic: true,
      degraded: fallbackReason === "provider_unavailable",
    },
  };
}

function createDeterministicDemo(input: GenerateRequest): ShortsPackage {
  const seed = hashString(
    [input.topic, input.audience, input.durationSeconds, input.tone, input.quality].join("|"),
  );
  const topicShort = truncate(input.topic, 36);
  const audienceShort = truncate(input.audience, 48);
  const hookTemplates = [
    `당신이 ${topicShort}에 대해 믿던 것, 첫 3초에 바꾸어 드릴게요.`,
    `${topicShort}, 이 한 가지를 놓치면 핵심을 반만 본 겁니다.`,
    `${topicShort}의 결과를 갈라놓는 차이는 생각보다 작습니다.`,
  ];
  const hook = hookTemplates[seed % hookTemplates.length];
  const sceneCount = input.durationSeconds <= 20 ? 4 : input.durationSeconds <= 40 ? 5 : 6;
  const windows = createSceneWindows(input.durationSeconds, sceneCount);
  const beats = [
    {
      narration: hook,
      text: "잠깐, 이건 다릅니다",
      visual: `${input.topic}을 상징하는 강렬한 매크로 숏, 세로 9:16, 고대비, 즉각적인 움직임`,
      edit: "0.2초 타이틀 팡인, 빠른 줌인, 킷에 맞춰 컷",
    },
    {
      narration: `${audienceShort}이 가장 먼저 알아야 할 것은, 문제를 큰 한 번이 아니라 작은 단위로 보는 겁니다.`,
      text: "큰 문제 → 작은 단위",
      visual: "복잡한 화면이 세 개의 간단한 카드로 정리되는 모션 그래픽",
      edit: "카드 3개를 리듬감 있게 순차 등장, 핵심어 형광 표시",
    },
    {
      narration: `첫째, ${topicShort}의 핵심을 한 문장으로 정의하고 나머지는 잠시 제외하세요.`,
      text: "1. 한 문장으로 정의",
      visual: "베일에 싼 키워드가 한 줄의 명확한 문장으로 정렬되는 클로즈업",
      edit: "문장이 나레이션과 동시에 타이핑, 배경은 8% 속도 푸시인",
    },
    {
      narration: "둘째, 지금 바로 할 수 있는 가장 작은 행동 하나를 고르세요. 작은 실행이 다음 판단을 더 좋게 만듭니다.",
      text: "2. 지금 1개만 실행",
      visual: "체크리스트의 첫 항목이 체크되고 다음 단계가 밝아지는 실사 화면",
      edit: "체크 효과음, 105% 속도 램프, 손 동작에 매치 컷",
    },
    {
      narration: `이제 ${topicShort}을 보는 기준이 생겼습니다. 완벽하게 준비하기보다 한 번 검증해 보세요.`,
      text: "준비보다 검증",
      visual: "어두운 화면에서 밝은 결과 화면으로 전환되는 비포어 앤 애프터",
      edit: "수직 와이프 전환, 배경음악 한 단계 상승, 텍스트 1.2초 유지",
    },
    {
      narration: `저장해 두고 오늘 ${topicShort}에 한 번 적용해 보세요. 다음 실행이 달라집니다.`,
      text: "오늘, 한 번 적용",
      visual: "저장 아이콘과 오늘의 캘린더가 연결되는 미니멀 엔드 카드",
      edit: "저장 아이콘 팡, CTA 자막 2초 유지, 음악 클린 엔딩",
    },
  ];

  const scenes = windows.map(([startSecond, endSecond], index) => ({
    index: index + 1,
    startSecond,
    endSecond,
    narration: beats[index].narration,
    onScreenText: beats[index].text,
    visualPrompt: beats[index].visual,
    editNotes: beats[index].edit,
  }));

  const script = scenes.map((scene) => scene.narration).join(" ");
  const topicTag = `#${input.topic.replace(/[\s#]+/g, "").slice(0, 24) || "쇼츠"}`;

  return ShortsPackageSchema.parse({
    title: `${topicShort}, ${input.durationSeconds}초 후 달라지는 한 가지`,
    hook,
    angle: `${audienceShort}이 복잡한 이론 대신 즉시 실행 가능한 두 단계로 ${topicShort}을 이해하게 만듭니다.`,
    script,
    scenes,
    caption: `${topicShort}을 복잡하게 시작할 필요는 없습니다. 핵심을 한 문장으로 정의하고, 가장 작은 행동 하나를 오늘 검증해 보세요. 나중에 바로 써먹을 수 있게 저장해 두세요.`,
    hashtags: [topicTag, "#유튜브쇼츠", "#쇼츠", "#실행팁", "#콘텐츠", "#오늘의팁"],
    thumbnailText: `${input.topic.slice(0, 18)}의 핵심`,
    voiceDirection: `${toneLabel(input.tone)} 톤. 첫 2초는 속도감 있게, 핵심 단계는 짧게 쉬어 가며, CTA는 부드럽게 마무리합니다.`,
    musicMood: "105-115 BPM의 미니멀 일렉트로닉 비트, 나레이션을 가리지 않는 약한 상승감",
    callToAction: `저장해 두고 오늘 ${topicShort}에 한 번 적용해 보세요.`,
    seoKeywords: [truncate(input.topic, 60), truncate(input.audience, 60), "YouTube Shorts", "실행 팁", "쇼츠 스크립트"],
    selfReview: {
      retentionStrength: "high",
      rationale: "2초 정보 공백, 번호화된 실행 단계, 저장형 CTA로 시청 이유가 끊기지 않게 구성했습니다.",
      risks: ["주제에 따라 세부 사실은 게시 전 출처 확인이 필요합니다."],
      improvementApplied: "추상적인 설명을 제거하고 오늘 바로 실행할 수 있는 두 단계와 타임라인으로 다듬었습니다.",
    },
  });
}

function normalizeGeneration(
  generation: ShortsPackage,
  durationSeconds: number,
): ShortsPackage {
  const windows = createSceneWindows(durationSeconds, generation.scenes.length);
  const hashtags = Array.from(
    new Set(generation.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))),
  );
  for (const fallbackTag of ["#YouTubeShorts", "#쇼츠", "#콘텐츠", "#세로영상", "#크리에이터팁"]) {
    if (hashtags.length >= 5) break;
    if (!hashtags.includes(fallbackTag)) hashtags.push(fallbackTag);
  }

  return ShortsPackageSchema.parse({
    ...generation,
    hashtags: hashtags.slice(0, 12),
    scenes: generation.scenes.map((scene, index) => ({
      ...scene,
      index: index + 1,
      startSecond: windows[index][0],
      endSecond: windows[index][1],
    })),
  });
}

function createSceneWindows(durationSeconds: number, sceneCount: number) {
  return Array.from({ length: sceneCount }, (_, index) => {
    const start = Math.floor((durationSeconds * index) / sceneCount);
    const end =
      index === sceneCount - 1
        ? durationSeconds
        : Math.floor((durationSeconds * (index + 1)) / sceneCount);
    return [start, Math.max(start + 1, end)] as const;
  });
}

function evaluateQuality(
  generation: ShortsPackage,
  durationSeconds: number,
): QualityCheck {
  const timelineStartsAtZero = generation.scenes[0]?.startSecond === 0;
  const timelineEndsOnTarget = generation.scenes.at(-1)?.endSecond === durationSeconds;
  const contiguous = generation.scenes.every(
    (scene, index) =>
      scene.endSecond > scene.startSecond &&
      (index === 0 || generation.scenes[index - 1].endSecond === scene.startSecond),
  );
  const criteria = {
    hook: generation.hook.length >= 12 && generation.hook.length <= 100,
    pacing: timelineStartsAtZero && timelineEndsOnTarget && contiguous,
    readability: generation.scenes.every((scene) => scene.onScreenText.length <= 45),
    metadata:
      generation.title.length <= 70 &&
      generation.hashtags.length >= 5 &&
      generation.seoKeywords.length >= 3,
    callToAction: generation.callToAction.length >= 8,
  };
  const weights = { hook: 25, pacing: 25, readability: 20, metadata: 15, callToAction: 15 };
  const score = (Object.keys(criteria) as Array<keyof typeof criteria>).reduce(
    (total, key) => total + (criteria[key] ? weights[key] : 0),
    0,
  );
  const notes = (Object.keys(criteria) as Array<keyof typeof criteria>)
    .filter((key) => !criteria[key])
    .map((key) => `${key} 품질 기준을 다시 확인하세요.`);

  if (notes.length === 0) {
    notes.push("훅, 페이싱, 가독성, 메타데이터, CTA 기준을 모두 통과했습니다.");
  }

  return {
    status: score >= 80 ? "pass" : score >= 60 ? "review" : "fail",
    score,
    criteria,
    notes,
  };
}

function evaluatePolicy(text: string): PolicyCheck {
  const blockedRules: Array<[RegExp, PolicyCheck["flags"][number]]> = [
    [/(?:아동|child|minor).{0,12}(?:성적|sexual|porn)/iu, "sexual_minors"],
    [/(?:자살|suicide).{0,12}(?:방법|하는 법|method|instructions)/iu, "self_harm"],
    [/(?:폭탄|사제폭발물|bomb).{0,16}(?:만드는 법|제작|how to make|instructions)/iu, "dangerous_instructions"],
    [/(?:인종|민족|종교|race|ethnicity).{0,18}(?:말살|열등|exterminate|inferior)/iu, "hate_or_harassment"],
  ];
  const reviewRules: Array<[RegExp, PolicyCheck["flags"][number]]> = [
    [/(?:의료|진단|치료|약물|암|medical|diagnos|cure)/iu, "medical_claim"],
    [/(?:투자|주식|코인|수익률|재테크|invest|stock|crypto)/iu, "financial_claim"],
    [/(?:법률|소송|법적 조언|legal advice|lawsuit)/iu, "legal_claim"],
    [/(?:선거|정당|투표|election|political party|vote for)/iu, "political_persuasion"],
    [/(?:유혈|잔혹|절단|gore|graphic violence)/iu, "graphic_violence"],
    [/(?:100%|무조건|보장|확실히).{0,12}(?:성공|치료|수익|guarantee)/iu, "unverified_claim"],
  ];

  const blockedFlags = blockedRules.filter(([pattern]) => pattern.test(text)).map(([, flag]) => flag);
  const reviewFlags = reviewRules.filter(([pattern]) => pattern.test(text)).map(([, flag]) => flag);
  const flags = Array.from(new Set([...blockedFlags, ...reviewFlags]));

  if (blockedFlags.length > 0) {
    return {
      status: "blocked",
      flags,
      notes: ["실행 가능한 유해 지침 또는 보호 대상 성적 콘텐츠 위험이 감지됐습니다."],
    };
  }

  if (reviewFlags.length > 0) {
    return {
      status: "review",
      flags,
      notes: ["게시 전에 사실 근거, 출처, 필요한 면책 문구를 사람이 확인해야 합니다."],
    };
  }

  return {
    status: "pass",
    flags: [],
    notes: ["자동 안전 규칙에서 게시 차단 요소를 발견하지 못했습니다."],
  };
}

function mergePolicyChecks(...checks: PolicyCheck[]): PolicyCheck {
  const status = checks.some((check) => check.status === "blocked")
    ? "blocked"
    : checks.some((check) => check.status === "review")
      ? "review"
      : "pass";

  return {
    status,
    flags: Array.from(new Set(checks.flatMap((check) => check.flags))),
    notes: Array.from(new Set(checks.flatMap((check) => check.notes))),
  };
}

function evaluateCost(model: string, usage: GenerationResult["usage"]): CostCheck {
  const pricing = pricingPerMillion[model];

  if (!pricing) {
    return {
      status: "review",
      estimatedUsd: null,
      ...usage,
      pricingSource: "model pricing not configured",
      note: "토큰 사용량은 계측했지만 이 커스텀 모델의 단가가 없어 비용을 계산하지 않았습니다.",
    };
  }

  const estimatedUsd = roundUsd(
    (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) / 1_000_000,
  );

  return {
    status: estimatedUsd <= 0.05 ? "within_budget" : "review",
    estimatedUsd,
    ...usage,
    pricingSource: pricing.source,
    note:
      estimatedUsd <= 0.05
        ? "단일 쇼츠 생성 예산 $0.05 이내입니다. Gateway 청구액과는 약간 다를 수 있습니다."
        : "단일 생성 예산 $0.05를 넘어 게시 전 확인이 필요합니다.",
  };
}

function normalizeUsage(usage: LanguageModelUsage) {
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
  };
}

function combineSignals(requestSignal?: AbortSignal) {
  const timeoutSignal = AbortSignal.timeout(45_000);
  return requestSignal ? AbortSignal.any([requestSignal, timeoutSignal]) : timeoutSignal;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function serializeForPolicy(generation: ShortsPackage) {
  return [generation.title, generation.hook, generation.script, generation.caption, generation.callToAction].join("\n");
}

function toneLabel(tone: GenerateRequest["tone"]) {
  return {
    energetic: "에너지 있고 선명한",
    educational: "신뢰감 있고 차분한 교육형",
    storytelling: "호기심을 이어 가는 스토리텔링",
    cinematic: "절제되고 영화적인",
    witty: "빠르고 위트 있는",
    calm: "부드럽고 안정적인",
  }[tone];
}

function hashString(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}
