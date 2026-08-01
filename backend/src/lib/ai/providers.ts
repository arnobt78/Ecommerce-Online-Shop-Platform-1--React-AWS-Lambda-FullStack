// Parent: REQ-1613
// Provider registry for the multi-model AI insights fallback chain
// (docs/LLM_MODEL_SELECTION.md).
// Every provider below exposes an OpenAI-compatible `/chat/completions`
// endpoint, so one generic client (see client.ts) can drive all of them —
// only base URL, env var, and model chain differ per provider.
//
// Order = fallback priority: Gemini first (implementation guide's stated
// primary + generous free tier), then Groq/OpenRouter (fast, reliable free
// tiers), then the remaining free-tier providers the user supplied keys for,
// with Hugging Face last (largest model catalog but slowest/least reliable
// per docs/LLM_MODEL_SELECTION.md).
//
// Deliberately NOT wired here: Cloudflare Workers AI (needs an account ID
// not present in docs/personal-dev-info.txt), and any non-text-chat key
// (ElevenLabs/Replicate/Fal/Jina — speech/image/embeddings, out of scope for
// a text insights feature) or infra key that would create a second parallel
// architecture (Clerk/Auth0 vs. the already-decided Google OAuth; Contentful
// vs. no CMS in this project) — see DECISION_LOG.md for the full rationale.

import type { LlmProvider } from "./types";

export interface ProviderConfig {
  id: LlmProvider;
  label: string;
  envKey: string;
  baseUrl: string;
  /** Tried in order within this provider before moving to the next provider. */
  models: string[];
  extraHeaders?: Record<string, string>;
}

export const AI_PROVIDERS: ProviderConfig[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
  },
  {
    id: "groq",
    label: "Groq",
    envKey: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    // Priority order per docs/LLM_MODEL_SELECTION.md's "Automatic Fallback Order".
    // llama-3.1-8b-instant / llama-3.3-70b-versatile intentionally excluded (deprecated, shutdown 2026-08-16).
    // qwen/qwen3-32b excluded too — already deprecated/shut down 2026-07-17 (docs/LLM_MODEL_SELECTION.md
    // "Groq deprecation watch"); qwen/qwen3.6-27b is the current non-deprecated replacement.
    models: ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "openai/gpt-oss-20b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "deepseek/deepseek-chat-v3-0324:free",
    ],
    extraHeaders: {
      "HTTP-Referer": "https://codebook.arnobmahmud.com",
      "X-Title": "CodeBook Admin Insights",
    },
  },
  {
    id: "cerebras",
    label: "Cerebras",
    envKey: "CEREBRAS_API_KEY",
    baseUrl: "https://api.cerebras.ai/v1",
    models: ["gpt-oss-120b", "llama3.1-8b"],
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    envKey: "NVIDIA_API_KEY",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    models: ["meta/llama-3.3-70b-instruct", "mistralai/mistral-7b-instruct-v0.3"],
  },
  {
    id: "mistral",
    label: "Mistral",
    envKey: "MISTRAL_API_KEY",
    baseUrl: "https://api.mistral.ai/v1",
    models: ["mistral-small-latest", "open-mistral-nemo"],
  },
  {
    id: "cohere",
    label: "Cohere",
    envKey: "COHERE_API_KEY",
    baseUrl: "https://api.cohere.com/compatibility/v1",
    models: ["command-r7b-12-2024", "command-r-08-2024"],
  },
  {
    id: "github",
    label: "GitHub Models",
    envKey: "GITHUB_AI_API_KEY",
    baseUrl: "https://models.github.ai/inference",
    models: ["openai/gpt-4o-mini"],
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    envKey: "HF_API_KEY",
    baseUrl: "https://router.huggingface.co/v1",
    models: ["Qwen/Qwen2.5-7B-Instruct", "meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"],
  },
];
