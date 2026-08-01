// Parent: REQ-1613
// Shared types for the multi-provider LLM chat layer. Every configured
// provider (Gemini, Groq, OpenRouter, Cerebras, NVIDIA NIM, Mistral, Cohere,
// GitHub Models, Hugging Face) speaks the same OpenAI-compatible
// `/chat/completions` JSON shape, so one set of types covers all of them.

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionOptions = {
  max_tokens?: number;
  temperature?: number;
};

export type ChatCompletionResponse = {
  id?: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason?: string;
  }>;
};

export type ChatCompletionFailureKind = "not_configured" | "billing" | "rate_limit" | "upstream";

export type LlmProvider =
  | "gemini"
  | "groq"
  | "openrouter"
  | "cerebras"
  | "nvidia"
  | "mistral"
  | "cohere"
  | "github"
  | "huggingface";

export type ChatCompletionResult =
  | { ok: true; text: string; provider: LlmProvider; model: string }
  | {
      ok: false;
      kind: ChatCompletionFailureKind;
      provider?: LlmProvider;
      status?: number;
      message?: string;
    };
