import { z } from "zod";

export const ToneSchema = z.enum([
  "energetic",
  "educational",
  "storytelling",
  "cinematic",
  "witty",
  "calm",
]);

export const QualityPresetSchema = z.enum(["fast", "balanced", "premium"]);

export const GenerateRequestSchema = z
  .object({
    topic: z
      .string()
      .trim()
      .min(2, "주제는 2자 이상이어야 합니다.")
      .max(160, "주제는 160자 이하여야 합니다."),
    audience: z
      .string()
      .trim()
      .min(2, "타겟 시청자는 2자 이상이어야 합니다.")
      .max(120, "타겟 시청자는 120자 이하여야 합니다."),
    durationSeconds: z
      .number()
      .int("영상 길이는 정수로 입력해야 합니다.")
      .min(15, "영상은 최소 15초여야 합니다.")
      .max(60, "YouTube Shorts는 60초 이하로 생성합니다."),
    niche: z.string().trim().min(1).max(80).optional(),
    language: z.enum(["ko", "en", "ja"]).default("ko"),
    aspectRatio: z.literal("9:16").default("9:16"),
    callToAction: z.string().trim().min(1).max(120).optional(),
    keywords: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
    tone: ToneSchema.default("energetic"),
    quality: QualityPresetSchema.default("balanced"),
  })
  .strict();

export const ShortsSceneSchema = z.object({
  index: z.number().int().min(1).max(8),
  startSecond: z.number().int().min(0).max(59),
  endSecond: z.number().int().min(1).max(60),
  narration: z.string().trim().min(1).max(320),
  onScreenText: z.string().trim().min(1).max(80),
  visualPrompt: z.string().trim().min(1).max(500),
  editNotes: z.string().trim().min(1).max(280),
});

export const ShortsPackageSchema = z.object({
  title: z.string().trim().min(1).max(70),
  hook: z.string().trim().min(1).max(100),
  angle: z.string().trim().min(1).max(240),
  script: z.string().trim().min(1).max(2_400),
  scenes: z.array(ShortsSceneSchema).min(3).max(8),
  caption: z.string().trim().min(1).max(2_200),
  hashtags: z
    .array(z.string().trim().regex(/^#[^\s#]+$/, "해시태그는 #로 시작해야 합니다."))
    .min(5)
    .max(12),
  thumbnailText: z.string().trim().min(1).max(30),
  voiceDirection: z.string().trim().min(1).max(220),
  musicMood: z.string().trim().min(1).max(160),
  callToAction: z.string().trim().min(1).max(160),
  seoKeywords: z.array(z.string().trim().min(1).max(60)).min(3).max(10),
  selfReview: z.object({
    retentionStrength: z.enum(["high", "medium", "low"]),
    rationale: z.string().trim().min(1).max(320),
    risks: z.array(z.string().trim().min(1).max(160)).max(5),
    improvementApplied: z.string().trim().min(1).max(320),
  }),
});

export const PolicyCheckSchema = z.object({
  status: z.enum(["pass", "review", "blocked"]),
  flags: z.array(
    z.enum([
      "dangerous_instructions",
      "self_harm",
      "sexual_minors",
      "hate_or_harassment",
      "medical_claim",
      "financial_claim",
      "legal_claim",
      "political_persuasion",
      "graphic_violence",
      "unverified_claim",
    ]),
  ),
  notes: z.array(z.string()),
});

export const QualityCheckSchema = z.object({
  status: z.enum(["pass", "review", "fail", "not_run"]),
  score: z.number().int().min(0).max(100),
  criteria: z.object({
    hook: z.boolean(),
    pacing: z.boolean(),
    readability: z.boolean(),
    metadata: z.boolean(),
    callToAction: z.boolean(),
  }),
  notes: z.array(z.string()),
});

export const CostCheckSchema = z.object({
  status: z.enum(["within_budget", "review", "not_run"]),
  estimatedUsd: z.number().nonnegative().nullable(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  pricingSource: z.string(),
  note: z.string(),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type ShortsPackage = z.infer<typeof ShortsPackageSchema>;
export type PolicyCheck = z.infer<typeof PolicyCheckSchema>;
export type QualityCheck = z.infer<typeof QualityCheckSchema>;
export type CostCheck = z.infer<typeof CostCheckSchema>;
