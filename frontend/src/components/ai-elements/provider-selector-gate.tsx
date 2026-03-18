"use client";

/**
 * UnityGrid Agent Flow — ProviderSelector Gate
 * ─────────────────────────────────────────────
 * Hides the provider/model selector UI when PROVIDER_LOCK is set to a single
 * provider (the default sovereign configuration).
 *
 * The selector is only shown when:
 *   NEXT_PUBLIC_PROVIDER_LOCK === '' (empty string = unlocked)
 *   AND NEXT_PUBLIC_PROVIDERS_ENABLED contains more than one provider.
 *
 * This component wraps any children that should be hidden in locked mode.
 * Usage:
 *   <ProviderSelectorGate>
 *     <ModelSelector ... />
 *   </ProviderSelectorGate>
 */

import type { ReactNode } from "react";

interface ProviderSelectorGateProps {
  children: ReactNode;
}

export function ProviderSelectorGate({ children }: ProviderSelectorGateProps) {
  const lock = process.env.NEXT_PUBLIC_PROVIDER_LOCK ?? "NIM";
  const enabled = (process.env.NEXT_PUBLIC_PROVIDERS_ENABLED ?? "NIM")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Show selector only when explicitly unlocked AND multiple providers enabled
  const isLocked = lock !== "" && lock !== "UNLOCKED";
  const hasMultipleProviders = enabled.length > 1;

  if (isLocked || !hasMultipleProviders) {
    // Provider is locked — hide the selector entirely
    return null;
  }

  return <>{children}</>;
}

/**
 * Returns the display name of the locked provider for use in UI labels.
 * e.g. "NVIDIA NIM — Nemotron-70B"
 */
export function getLockedProviderLabel(): string {
  const lock = process.env.NEXT_PUBLIC_PROVIDER_LOCK ?? "NIM";
  const model =
    process.env.NEXT_PUBLIC_NIM_MODEL_DISPLAY ?? "Nemotron-70B Instruct";

  if (lock.toUpperCase() === "NIM") {
    return `NVIDIA NIM — ${model}`;
  }
  return lock;
}
