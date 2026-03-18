/**
 * UnityGrid Agent Flow — Chat Gateway Router
 * ─────────────────────────────────────────────
 * Single entry point for all LLM inference calls.
 * Dispatches to the active provider via the registry.
 *
 * Usage:
 *   import { chatGateway } from "@/server/providers/router";
 *   const response = await chatGateway({ messages, stream: true });
 *
 * Active provider is determined by PROVIDER_LOCK env var (default: NIM).
 * Optional failover to OPENROUTER if NIM returns 5xx and OPENROUTER_API_KEY is set.
 */

import type { ChatArgs } from "./nemo";
import { getProvider, getLockedProviderName } from "./registry";

export type { ChatArgs };

const FAILOVER_ENABLED =
  process.env.PROVIDERS_ENABLED?.includes("OPENROUTER") ?? false;

/**
 * Main chat gateway — routes to the active provider.
 * Implements optional NIM → OpenRouter failover when:
 *   - PROVIDERS_ENABLED includes OPENROUTER
 *   - NIM returns a 5xx error or times out
 */
export async function chatGateway(
  payload: ChatArgs
): Promise<ReadableStream | { content: string }> {
  const provider = getProvider();

  try {
    return await provider.chat(payload);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const is5xx = /\b5\d{2}\b/.test(msg);
    const isTimeout = /timeout|abort/i.test(msg);

    if ((is5xx || isTimeout) && FAILOVER_ENABLED && getLockedProviderName() === "NIM") {
      console.warn(
        `[UnityGrid/Router] NIM error (${msg}). Failing over to OpenRouter.`
      );
      // Dynamic import to avoid loading OpenRouter adapter when not needed
      const { openrouterClient } = await import("./openrouter");
      const fallback = openrouterClient();
      return fallback.chat(payload);
    }

    throw err;
  }
}

/**
 * Returns the name of the currently active provider for logging/debug.
 */
export function getActiveProviderName(): string {
  return getLockedProviderName();
}
