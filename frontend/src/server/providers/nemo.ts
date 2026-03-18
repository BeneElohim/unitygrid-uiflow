/**
 * UnityGrid Agent Flow — NVIDIA NIM Adapter
 * Routes all inference through the NIM REST endpoint (OpenAI-compatible).
 * This is the DEFAULT and LOCKED provider.
 */

export interface ChatArgs {
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  timeoutMs?: number;
}

export interface Provider {
  name: string;
  chat(args: ChatArgs): Promise<ReadableStream | { content: string }>;
}

export function nemoClient(): Provider {
  const base =
    process.env.NEMO_API_BASE ||
    process.env.NIM_BASE_URL ||
    "https://integrate.api.nvidia.com/v1";
  const key =
    process.env.NEMO_API_KEY ||
    process.env.NVIDIA_API_KEY ||
    "";
  const model =
    process.env.MODEL_ID ||
    process.env.NIM_MODEL ||
    "nvidia/nemotron-70b-instruct";

  if (!key) {
    console.warn(
      "[UnityGrid/NIM] NEMO_API_KEY / NVIDIA_API_KEY not set — NIM calls will fail."
    );
  }

  return {
    name: "NIM",
    async chat({ messages, stream = false, timeoutMs = 120_000 }) {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "X-UnityGrid-Source": "AgentFlow",
        },
        body: JSON.stringify({ model, messages, stream }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw new Error(`[NIM] ${res.status}: ${err}`);
      }

      if (stream) {
        return res.body as unknown as ReadableStream;
      }
      return res.json() as Promise<{ content: string }>;
    },
  };
}
