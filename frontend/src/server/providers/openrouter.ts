/**
 * UnityGrid Agent Flow — OpenRouter Adapter (DISABLED BY DEFAULT)
 * Enable by setting PROVIDERS_ENABLED=NIM,OPENROUTER in .env.local
 * Never loaded unless explicitly enabled.
 */

import type { ChatArgs, Provider } from "./nemo";

export function openrouterClient(): Provider {
  const key = process.env.OPENROUTER_API_KEY ?? "";
  const base = "https://openrouter.ai/api";
  const model =
    process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-405b-instruct";

  return {
    name: "OPENROUTER",
    async chat({ messages, stream = false, timeoutMs = 120_000 }) {
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "unitygrid.ai",
          "X-Title": "UnityGrid",
        },
        body: JSON.stringify({ model, messages, stream }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw new Error(`[OpenRouter] ${res.status}: ${err}`);
      }

      return stream ? (res.body as unknown as ReadableStream) : res.json();
    },
  };
}
