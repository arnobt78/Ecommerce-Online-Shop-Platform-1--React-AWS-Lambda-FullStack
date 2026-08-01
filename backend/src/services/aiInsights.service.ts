// Parent: REQ-1613
// Business Insights AI advisor — takes a compact text summary of the
// analytics already computed client-side (src/services/analyticsService.ts,
// from data already cached by TanStack Query, so no extra DB round-trip here)
// and asks the multi-provider LLM chain for a handful of short, actionable
// recommendations. Mirrors the pattern already proven in the stock-inventory
// project's `/api/ai/insights` route (docs/LLM_MODEL_SELECTION.md).

import { z } from "zod";
import crypto from "node:crypto";
import { createChatCompletion, isLlmConfigured, configuredProviderLabels } from "../lib/ai";
import type { ChatCompletionResult } from "../lib/ai";

export const aiInsightsRequestSchema = z.object({
  summary: z.string().min(1).max(4000),
});
export type AiInsightsRequestInput = z.infer<typeof aiInsightsRequestSchema>;

export interface AiInsightsResult {
  insights: string[];
  provider: string;
  model: string;
  generatedAt: string;
  cached: boolean;
}

const SYSTEM_PROMPT =
  "You are a concise e-commerce business advisor. Given a short summary of store metrics " +
  "(revenue, orders, top products, stock levels, user growth), reply with 3-5 brief, actionable " +
  "recommendations, one short sentence each, one per line. Focus on revenue growth, inventory/reorder " +
  "attention, best-seller promotion, and customer retention opportunities. Keep the tone professional " +
  "and direct. Do not use markdown, numbering, or bullet symbols — plain sentences only, one per line.";

// Free-tier providers are rate-limited and this panel can be revisited often —
// cache the last result per distinct summary for a short window so repeat
// admin dashboard views/navigation never trigger a duplicate provider call.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { result: AiInsightsResult; expiresAt: number }>();

function hashSummary(summary: string): string {
  return crypto.createHash("sha256").update(summary).digest("hex");
}

function parseInsights(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 6);
}

export class AiInsightsUnavailableError extends Error {
  constructor(
    message: string,
    public readonly code: "LLM_NOT_CONFIGURED" | "LLM_RATE_LIMIT" | "LLM_UPSTREAM"
  ) {
    super(message);
    this.name = "AiInsightsUnavailableError";
  }
}

export async function getBusinessInsights(summary: string): Promise<AiInsightsResult> {
  const cacheKey = hashSummary(summary);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.result, cached: true };
  }

  if (!isLlmConfigured()) {
    throw new AiInsightsUnavailableError(
      "AI insights are not configured. Add at least one provider API key to the backend .env.",
      "LLM_NOT_CONFIGURED"
    );
  }

  const result: ChatCompletionResult = await createChatCompletion(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: summary },
    ],
    // Higher than the visible text needs — reasoning-capable models (Gemini 2.5,
    // gpt-oss, qwen) spend part of max_tokens on hidden reasoning before the
    // final answer, so a low cap here truncates the actual output mid-sentence.
    { max_tokens: 1024, temperature: 0.5 }
  );

  if (!result.ok) {
    if (result.kind === "not_configured") {
      throw new AiInsightsUnavailableError(
        `AI insights are not configured. Configured providers: ${configuredProviderLabels().join(", ") || "none"}.`,
        "LLM_NOT_CONFIGURED"
      );
    }
    if (result.kind === "rate_limit") {
      throw new AiInsightsUnavailableError("All configured AI providers are rate-limited right now. Try again shortly.", "LLM_RATE_LIMIT");
    }
    throw new AiInsightsUnavailableError("AI insights are temporarily unavailable — every configured provider failed.", "LLM_UPSTREAM");
  }

  const insights = parseInsights(result.text);
  const output: AiInsightsResult = {
    insights: insights.length > 0 ? insights : [result.text.trim()],
    provider: result.provider,
    model: result.model,
    generatedAt: new Date().toISOString(),
    cached: false,
  };

  cache.set(cacheKey, { result: output, expiresAt: Date.now() + CACHE_TTL_MS });
  return output;
}
