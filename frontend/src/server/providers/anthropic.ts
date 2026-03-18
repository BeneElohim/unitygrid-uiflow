/**
 * UnityGrid Agent Flow — Anthropic Adapter (DISABLED BY DEFAULT)
 * Enable by setting PROVIDERS_ENABLED=NIM,ANTHROPIC in .env.local
 * Never loaded unless explicitly enabled.
 * Uses the Anthropic Messages API directly (no SDK dependency).
 */

import type { ChatArgs, Provider } from "./nemo";

export function anthropicClient(): Provider {
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

  return {
    name: "ANTHROPIC",
    async chat({ messages, stream = false, timeoutMs = 120_000 }) {
      // Anthropic uses a different message format — convert from OpenAI style
      const systemMessages = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");
      const userMessages = messages.filter((m) => m.role !== "system");

      const body: Record<string, unknown> = {
        model,
        max_tokens: 4096,
        messages: userMessages,
        ...(systemMessages ? { system: systemMessages } : {}),
        stream,
      };

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw new Error(`[Anthropic] ${res.status}: ${err}`);
      }

      if (stream) return res.body as unknown as ReadableStream;
      const data = (await res.json()) as {
        content: Array<{ text: string }>;
      };
      return { content: data.content[0]?.text ?? "" };
    },
  };
}
