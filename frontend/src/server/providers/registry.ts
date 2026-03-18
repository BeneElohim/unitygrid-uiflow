/**
 * UnityGrid Agent Flow — Provider Registry
 * ─────────────────────────────────────────
 * Hard-locked to NIM by default.
 * Adding a new provider is a single env-var change — no code refactor.
 *
 * .env.local keys:
 *   PROVIDER_LOCK=NIM                          # default active provider
 *   PROVIDERS_ENABLED=NIM                      # comma-separated enabled list
 *   # To add OpenRouter: PROVIDERS_ENABLED=NIM,OPENROUTER
 *   # To add Anthropic:  PROVIDERS_ENABLED=NIM,ANTHROPIC
 */

import type { Provider } from "./nemo";
import { nemoClient } from "./nemo";
import { openrouterClient } from "./openrouter";
import { anthropicClient } from "./anthropic";

// Parse the enabled providers list — defaults to NIM only
const ENABLED = (process.env.PROVIDERS_ENABLED ?? "NIM")
  .split(",")
  .map((s) => s.trim().toUpperCase());

// Build the registry — only instantiate adapters that are explicitly enabled
const REGISTRY: Record<string, Provider> = {};
if (ENABLED.includes("NIM")) REGISTRY["NIM"] = nemoClient();
if (ENABLED.includes("OPENROUTER")) REGISTRY["OPENROUTER"] = openrouterClient();
if (ENABLED.includes("ANTHROPIC")) REGISTRY["ANTHROPIC"] = anthropicClient();

/**
 * Returns the active provider.
 * Respects PROVIDER_LOCK env var — defaults to NIM.
 * Throws if the locked provider is not in PROVIDERS_ENABLED.
 */
export function getProvider(): Provider {
  const lock = (process.env.PROVIDER_LOCK ?? "NIM").toUpperCase();
  const provider = REGISTRY[lock];
  if (!provider) {
    throw new Error(
      `[UnityGrid/Registry] Provider "${lock}" is not enabled. ` +
        `Add it to PROVIDERS_ENABLED in .env.local.`
    );
  }
  return provider;
}

/**
 * Returns the list of currently enabled provider names.
 * Used by the UI gate to decide whether to show the selector.
 */
export function getEnabledProviders(): string[] {
  return Object.keys(REGISTRY);
}

/**
 * Returns the locked provider name (for display/debug only).
 */
export function getLockedProviderName(): string {
  return (process.env.PROVIDER_LOCK ?? "NIM").toUpperCase();
}
