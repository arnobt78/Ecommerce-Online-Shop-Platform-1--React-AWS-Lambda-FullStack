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

// Parent: REQ-1651 — review sentiment / moderation-flag advisor. Unlike
// restock/pricing/fraud (REQ-1648/1650/1652, deterministic math on order
// data), sentiment on free-text genuinely needs a language model. Run
// on-demand per admin click (not automatically on every review submission)
// to keep this opt-in and avoid adding LLM latency/cost to the checkout-
// adjacent review-creation path. Reuses the same multi-provider chain.
const SENTIMENT_SYSTEM_PROMPT =
  "You are a review-moderation assistant for an e-commerce store. Given a star rating and a review comment, " +
  "reply with exactly two lines, nothing else: " +
  "Line 1: one word — positive, neutral, or negative (the comment's actual sentiment). " +
  "Line 2: one word — flagged or clear (flagged if the comment looks fake/spam/generic/promotional, or if its " +
  "sentiment clearly contradicts the star rating; clear otherwise), followed by a colon and a short reason " +
  "(under 15 words) if flagged, or just 'clear' if not.";

export interface ReviewSentimentResult {
  sentiment: "positive" | "neutral" | "negative";
  flagged: boolean;
  reason: string | null;
  provider: string;
}

export async function analyzeReviewSentiment(rating: number, comment: string): Promise<ReviewSentimentResult> {
  if (!isLlmConfigured()) {
    throw new AiInsightsUnavailableError(
      "AI review analysis is not configured. Add at least one provider API key to the backend .env.",
      "LLM_NOT_CONFIGURED"
    );
  }

  const result = await createChatCompletion(
    [
      { role: "system", content: SENTIMENT_SYSTEM_PROMPT },
      { role: "user", content: `Rating: ${rating}/5 stars\nComment: "${comment}"` },
    ],
    { max_tokens: 256, temperature: 0.2 }
  );

  if (!result.ok) {
    if (result.kind === "rate_limit") {
      throw new AiInsightsUnavailableError("All configured AI providers are rate-limited right now. Try again shortly.", "LLM_RATE_LIMIT");
    }
    throw new AiInsightsUnavailableError("AI review analysis is temporarily unavailable — every configured provider failed.", "LLM_UPSTREAM");
  }

  const lines = result.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sentimentLine = (lines[0] || "").toLowerCase();
  const flagLine = (lines[1] || "").toLowerCase();

  const sentiment: ReviewSentimentResult["sentiment"] = sentimentLine.includes("positive") ? "positive" : sentimentLine.includes("negative") ? "negative" : "neutral";
  const flagged = flagLine.startsWith("flagged");
  const reason = flagged ? flagLine.replace(/^flagged:?\s*/, "").trim() || null : null;

  return { sentiment, flagged, reason, provider: result.provider };
}

// Parent: REQ-1664 — AI product-description generator. Same on-demand,
// admin-click pattern as REQ-1651/1652: drafts copy for the admin to review/
// edit in ProductForm, never auto-published — the admin must still explicitly
// save the form, exactly like the suggested-pricing banner.
const DESCRIPTION_SYSTEM_PROMPT =
  "You are a marketing copywriter for an e-commerce ebook store. Given a book's metadata, reply with exactly " +
  "two lines, nothing else, no markdown, no labels: " +
  "Line 1: a punchy one-sentence overview (under 160 characters) suitable for a product card. " +
  "Line 2: a longer, persuasive 3-4 sentence description suitable for the full product page, highlighting who " +
  "the book is for and what the reader will gain. Do not invent specific facts (page counts, editions, awards) " +
  "not given in the input.";

export interface ProductDescriptionInput {
  name: string;
  author?: string | null;
  category?: string | null;
  level?: string | null;
  tags?: string[];
}

export interface ProductDescriptionResult {
  overview: string;
  long_description: string;
  provider: string;
}

export async function generateProductDescription(input: ProductDescriptionInput): Promise<ProductDescriptionResult> {
  if (!isLlmConfigured()) {
    throw new AiInsightsUnavailableError(
      "AI description generation is not configured. Add at least one provider API key to the backend .env.",
      "LLM_NOT_CONFIGURED"
    );
  }

  const metadataLines = [
    `Title: ${input.name}`,
    input.author && `Author: ${input.author}`,
    input.category && `Category: ${input.category}`,
    input.level && `Level: ${input.level}`,
    input.tags && input.tags.length > 0 && `Topics: ${input.tags.join(", ")}`,
  ].filter(Boolean);

  const result = await createChatCompletion(
    [
      { role: "system", content: DESCRIPTION_SYSTEM_PROMPT },
      { role: "user", content: metadataLines.join("\n") },
    ],
    // 512 was too low in testing — reasoning-capable models (Gemini 2.5,
    // gpt-oss, qwen) spend part of max_tokens on hidden reasoning before the
    // visible answer, truncating the long_description line mid-sentence.
    // Same root cause and fix as REQ-1613's getBusinessInsights() above.
    { max_tokens: 1024, temperature: 0.7 }
  );

  if (!result.ok) {
    if (result.kind === "rate_limit") {
      throw new AiInsightsUnavailableError("All configured AI providers are rate-limited right now. Try again shortly.", "LLM_RATE_LIMIT");
    }
    throw new AiInsightsUnavailableError("AI description generation is temporarily unavailable — every configured provider failed.", "LLM_UPSTREAM");
  }

  const lines = result.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    overview: lines[0] || result.text.trim(),
    long_description: lines.slice(1).join(" ") || lines[0] || result.text.trim(),
    provider: result.provider,
  };
}

// Parent: REQ-1666 — AI-assisted support ticket reply draft. Same on-demand,
// admin-click pattern as REQ-1651/1664: drafts a reply for the admin to
// review/edit before sending, reusing the same multi-provider chain — never
// auto-sent to the customer.
const TICKET_REPLY_SYSTEM_PROMPT =
  "You are a helpful, professional customer support agent for an e-commerce ebook store called CodeBook. " +
  "Given a support ticket's subject, category, priority, and message history, draft a reply to the customer's " +
  "most recent message. Reply with ONLY the draft reply text, nothing else — no greeting boilerplate like " +
  "'Dear customer', no signature, no labels, no markdown. Be concise (2-4 sentences), empathetic, and specific " +
  "to what the customer actually asked. If the ticket concerns a refund/order, do not promise a specific outcome " +
  "(e.g. don't say 'your refund is approved') — only acknowledge and explain next steps, since only a human " +
  "admin can actually take that action.";

export interface TicketReplyDraftInput {
  subject: string;
  category: string;
  priority: string;
  messages: Array<{ message: string; senderRole: string }>;
}

export interface TicketReplyDraftResult {
  draft: string;
  provider: string;
}

export async function generateTicketReplyDraft(input: TicketReplyDraftInput): Promise<TicketReplyDraftResult> {
  if (!isLlmConfigured()) {
    throw new AiInsightsUnavailableError(
      "AI reply drafting is not configured. Add at least one provider API key to the backend .env.",
      "LLM_NOT_CONFIGURED"
    );
  }

  const conversation = input.messages
    .map((m) => `${m.senderRole === "admin" ? "Support Agent" : "Customer"}: ${m.message}`)
    .join("\n\n");

  const userContent = `Subject: ${input.subject}\nCategory: ${input.category}\nPriority: ${input.priority}\n\nConversation so far:\n${conversation}`;

  const result = await createChatCompletion(
    [
      { role: "system", content: TICKET_REPLY_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    { max_tokens: 1024, temperature: 0.6 }
  );

  if (!result.ok) {
    if (result.kind === "rate_limit") {
      throw new AiInsightsUnavailableError("All configured AI providers are rate-limited right now. Try again shortly.", "LLM_RATE_LIMIT");
    }
    throw new AiInsightsUnavailableError("AI reply drafting is temporarily unavailable — every configured provider failed.", "LLM_UPSTREAM");
  }

  return { draft: result.text.trim(), provider: result.provider };
}
