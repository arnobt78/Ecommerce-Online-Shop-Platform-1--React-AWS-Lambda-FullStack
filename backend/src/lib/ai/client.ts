// Parent: REQ-1613
// Generic OpenAI-compatible chat-completion client. Every provider in
// providers.ts speaks this same request/response shape, so this one function
// drives all of them — only base URL / key / model chain differ.

import type { ChatCompletionOptions, ChatCompletionResponse, ChatCompletionResult, ChatMessage } from "./types";
import type { ProviderConfig } from "./providers";

const RETRIABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 20_000;

export function isProviderConfigured(provider: ProviderConfig): boolean {
  const key = process.env[provider.envKey];
  return typeof key === "string" && key.trim().length > 0;
}

function mapStatusToKind(status: number): "billing" | "rate_limit" | "upstream" {
  if (status === 402) return "billing";
  if (status === 429) return "rate_limit";
  return "upstream";
}

async function requestModel(
  provider: ProviderConfig,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...provider.extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options.max_tokens ?? 512,
        temperature: options.temperature ?? 0.5,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(`[AI:${provider.id}] ${model} failed (${response.status}): ${text.slice(0, 200)}`);
      return {
        ok: false,
        kind: mapStatusToKind(response.status),
        provider: provider.id,
        status: response.status,
        message: text.slice(0, 300),
      };
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, kind: "upstream", provider: provider.id, message: "Empty response" };
    }
    return { ok: true, text, provider: provider.id, model };
  } catch (error) {
    console.warn(`[AI:${provider.id}] ${model} request error:`, error instanceof Error ? error.message : error);
    return {
      ok: false,
      kind: "upstream",
      provider: provider.id,
      message: error instanceof Error ? error.message : "Request failed",
    };
  }
}

/**
 * Try every model in a single provider's chain in order, stopping at the
 * first success. Only continues to the next model on a retriable failure.
 */
export async function requestProviderCompletion(
  provider: ProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  if (!isProviderConfigured(provider)) {
    return { ok: false, kind: "not_configured", provider: provider.id };
  }

  const apiKey = process.env[provider.envKey]!;
  let lastFailure: Extract<ChatCompletionResult, { ok: false }> | null = null;

  for (let i = 0; i < provider.models.length; i++) {
    const model = provider.models[i]!;
    const result = await requestModel(provider, apiKey, model, messages, options);
    if (result.ok) return result;

    lastFailure = result;
    const hasNext = i < provider.models.length - 1;
    const retriable = result.kind === "rate_limit" || result.kind === "upstream" || (result.status != null && RETRIABLE_STATUSES.has(result.status));
    if (!hasNext || !retriable) break;
  }

  return lastFailure ?? { ok: false, kind: "upstream", provider: provider.id, message: "All models failed" };
}
