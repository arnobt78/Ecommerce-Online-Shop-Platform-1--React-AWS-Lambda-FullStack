// Parent: REQ-1613
// Multi-provider LLM orchestrator — tries each configured provider in
// providers.ts, in order, until one succeeds. Never depends on a single
// model/provider (docs/LLM_MODEL_SELECTION.md "Purpose"): if a provider is
// unconfigured, rate-limited, out of credit, or erroring, silently moves to
// the next one. Callers only see the final ChatCompletionResult.

import { AI_PROVIDERS } from "./providers";
import { isProviderConfigured, requestProviderCompletion } from "./client";
import type { ChatCompletionOptions, ChatCompletionResult, ChatMessage } from "./types";

export type { ChatMessage, ChatCompletionOptions, ChatCompletionResult, LlmProvider } from "./types";

/** True when at least one provider has an API key set. */
export function isLlmConfigured(): boolean {
  return AI_PROVIDERS.some(isProviderConfigured);
}

/** Provider labels currently configured — surfaced to the admin UI for transparency. */
export function configuredProviderLabels(): string[] {
  return AI_PROVIDERS.filter(isProviderConfigured).map((p) => p.label);
}

/**
 * Walk the provider chain in priority order. Stops at the first success.
 * Returns the last failure if every provider fails (never throws).
 */
export async function createChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  let lastFailure: Extract<ChatCompletionResult, { ok: false }> | null = null;

  for (const provider of AI_PROVIDERS) {
    if (!isProviderConfigured(provider)) continue;

    const result = await requestProviderCompletion(provider, messages, options);
    if (result.ok) return result;

    lastFailure = result;
    console.warn(`[AI] Provider ${provider.id} failed (${result.kind}), trying next provider...`);
  }

  return lastFailure ?? { ok: false, kind: "not_configured" };
}
