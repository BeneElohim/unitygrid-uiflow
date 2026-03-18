"use client";

/**
 * UnityGrid Agent Flow — Gateway Settings Page
 * ─────────────────────────────────────────────
 * Provides runtime control over:
 *   1. Provider lock (NIM sovereign default vs external models)
 *   2. OpenClaw Gateway connection URL
 *   3. Gateway auth token
 *   4. Route management (which proxy paths are active)
 *
 * All settings are persisted to localStorage and read by the
 * openclaw-gateway-client and ProviderSelectorGate at runtime.
 * They do NOT override server-side .env.local values — they are
 * UI-layer overrides for development and operator use only.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { getGatewayClient, getGatewayWsClient } from "@/lib/openclaw-gateway-client";

// ── Storage keys ──────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  GATEWAY_URL: "ug_gateway_url",
  GATEWAY_TOKEN: "ug_gateway_token",
  PROVIDER_LOCK: "ug_provider_lock",
  PROVIDERS_ENABLED: "ug_providers_enabled",
  ROUTE_GW_ENABLED: "ug_route_gw_enabled",
  ROUTE_CONTROL_ENABLED: "ug_route_control_enabled",
} as const;

// ── Defaults (mirror .env.local) ──────────────────────────────────────────────

const DEFAULTS = {
  // REST base URL for HTTP API calls (list models, health, etc.)
  GATEWAY_URL: "http://localhost:3333",
  GATEWAY_TOKEN: "",
  PROVIDER_LOCK: "NIM",
  PROVIDERS_ENABLED: "NIM",
  ROUTE_GW_ENABLED: true,
  ROUTE_CONTROL_ENABLED: true,
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  if (typeof fallback === "boolean") return (raw === "true") as unknown as T;
  return raw as unknown as T;
}

function writeStorage(key: string, value: string | boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, String(value));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GatewaySettingsPage() {
  const [gatewayUrl, setGatewayUrl] = useState(DEFAULTS.GATEWAY_URL);
  const [gatewayToken, setGatewayToken] = useState(DEFAULTS.GATEWAY_TOKEN);
  const [providerLock, setProviderLock] = useState(DEFAULTS.PROVIDER_LOCK);
  const [providersEnabled, setProvidersEnabled] = useState(DEFAULTS.PROVIDERS_ENABLED);
  const [routeGwEnabled, setRouteGwEnabled] = useState(DEFAULTS.ROUTE_GW_ENABLED);
  const [routeControlEnabled, setRouteControlEnabled] = useState(DEFAULTS.ROUTE_CONTROL_ENABLED);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  // Load from localStorage on mount
  useEffect(() => {
    setGatewayUrl(readStorage(STORAGE_KEYS.GATEWAY_URL, DEFAULTS.GATEWAY_URL));
    setGatewayToken(readStorage(STORAGE_KEYS.GATEWAY_TOKEN, DEFAULTS.GATEWAY_TOKEN));
    setProviderLock(readStorage(STORAGE_KEYS.PROVIDER_LOCK, DEFAULTS.PROVIDER_LOCK));
    setProvidersEnabled(readStorage(STORAGE_KEYS.PROVIDERS_ENABLED, DEFAULTS.PROVIDERS_ENABLED));
    setRouteGwEnabled(readStorage(STORAGE_KEYS.ROUTE_GW_ENABLED, DEFAULTS.ROUTE_GW_ENABLED));
    setRouteControlEnabled(readStorage(STORAGE_KEYS.ROUTE_CONTROL_ENABLED, DEFAULTS.ROUTE_CONTROL_ENABLED));
  }, []);

  const handleSave = useCallback(() => {
    writeStorage(STORAGE_KEYS.GATEWAY_URL, gatewayUrl);
    writeStorage(STORAGE_KEYS.GATEWAY_TOKEN, gatewayToken);
    writeStorage(STORAGE_KEYS.PROVIDER_LOCK, providerLock);
    writeStorage(STORAGE_KEYS.PROVIDERS_ENABLED, providersEnabled);
    writeStorage(STORAGE_KEYS.ROUTE_GW_ENABLED, routeGwEnabled);
    writeStorage(STORAGE_KEYS.ROUTE_CONTROL_ENABLED, routeControlEnabled);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [gatewayUrl, gatewayToken, providerLock, providersEnabled, routeGwEnabled, routeControlEnabled]);

  const handleTestConnection = useCallback(async () => {
    setTestStatus("testing");
    try {
      // Try REST health check first; fall back to WS ping
      const restClient = getGatewayClient({ url: gatewayUrl });
      try {
        await restClient.health();
        setTestStatus("ok");
      } catch {
        // REST failed — try WebSocket ping (for WS-only gateways)
        const wsUrl = gatewayUrl.replace(/^http/, "ws");
        const wsClient = getGatewayWsClient({ gatewayWsUrl: wsUrl });
        const connected = await wsClient.ping(3000);
        setTestStatus(connected ? "ok" : "fail");
      }
    } catch {
      setTestStatus("fail");
    }
    setTimeout(() => setTestStatus("idle"), 4000);
  }, [gatewayUrl]);

  const handleReset = useCallback(() => {
    setGatewayUrl(DEFAULTS.GATEWAY_URL);
    setGatewayToken(DEFAULTS.GATEWAY_TOKEN);
    setProviderLock(DEFAULTS.PROVIDER_LOCK);
    setProvidersEnabled(DEFAULTS.PROVIDERS_ENABLED);
    setRouteGwEnabled(DEFAULTS.ROUTE_GW_ENABLED);
    setRouteControlEnabled(DEFAULTS.ROUTE_CONTROL_ENABLED);
  }, []);

  const nimLocked = providerLock === "NIM";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-5 text-muted-foreground" />
        <div>
          <h2 className="text-base font-semibold">Gateway &amp; Provider Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure the OpenClaw Gateway connection and provider routing policy.
            Server-side values in <code className="bg-muted px-1 rounded text-xs">.env.local</code> take precedence over these UI overrides.
          </p>
        </div>
      </div>

      <Separator />

      {/* Provider Lock */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Provider Policy
        </h3>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium">NIM Sovereign Lock</Label>
            <p className="text-xs text-muted-foreground">
              When enabled, only NVIDIA NIM (Nemotron-70B) is used. The model
              selector is hidden from the UI. Disable to allow external providers.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={nimLocked ? "default" : "secondary"}>
              {nimLocked ? "Locked: NIM" : "Unlocked"}
            </Badge>
            <Switch
              checked={nimLocked}
              onCheckedChange={(checked) => {
                setProviderLock(checked ? "NIM" : "");
                setProvidersEnabled(checked ? "NIM" : "NIM,OPENROUTER");
              }}
            />
          </div>
        </div>

        {!nimLocked && (
          <div className="space-y-2">
            <Label htmlFor="providers-enabled" className="text-sm font-medium">
              Enabled Providers
            </Label>
            <Input
              id="providers-enabled"
              value={providersEnabled}
              onChange={(e) => setProvidersEnabled(e.target.value)}
              placeholder="NIM,OPENROUTER,ANTHROPIC"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list. Supported values: <code>NIM</code>, <code>OPENROUTER</code>, <code>ANTHROPIC</code>.
            </p>
          </div>
        )}
      </section>

      <Separator />

      {/* Gateway Connection */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          OpenClaw Gateway Connection
        </h3>

        <div className="space-y-2">
          <Label htmlFor="gateway-url" className="text-sm font-medium">
            Gateway WebSocket URL
          </Label>
          <div className="flex gap-2">
            <Input
              id="gateway-url"
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              placeholder="ws://localhost:3001/gw"
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testStatus === "testing"}
              className="shrink-0"
            >
              {testStatus === "testing" ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : testStatus === "ok" ? (
                <CheckCircle2 className="size-4 text-green-500" />
              ) : testStatus === "fail" ? (
                <AlertCircle className="size-4 text-destructive" />
              ) : (
                "Test"
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The Next.js proxy rewrites <code>/gw</code> → this URL at the server layer.
            This field controls the client-side WebSocket target for direct connections.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gateway-token" className="text-sm font-medium">
            Gateway Auth Token
          </Label>
          <Input
            id="gateway-token"
            type="password"
            value={gatewayToken}
            onChange={(e) => setGatewayToken(e.target.value)}
            placeholder="Leave empty if Gateway has no auth"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Passed as a URL fragment (<code>#token=…</code>) to the Control UI. Never sent to the server.
          </p>
        </div>
      </section>

      <Separator />

      {/* Route Management */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Proxy Routes
        </h3>
        <p className="text-xs text-muted-foreground">
          These toggles control which Next.js proxy routes are active. Disabling a route
          will show an "offline" state in the corresponding workspace tab.
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Gateway Chat Route (<code>/gw</code>)</Label>
              <p className="text-xs text-muted-foreground">WebSocket proxy for Gateway Chat tab</p>
            </div>
            <Switch checked={routeGwEnabled} onCheckedChange={setRouteGwEnabled} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Control UI Route (<code>/control</code>)</Label>
              <p className="text-xs text-muted-foreground">HTTP proxy for Gateway Control tab</p>
            </div>
            <Switch checked={routeControlEnabled} onCheckedChange={setRouteControlEnabled} />
          </div>
        </div>
      </section>

      <Separator />

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} className="gap-2">
          {saved ? (
            <>
              <CheckCircle2 className="size-4" />
              Saved
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
        <Button variant="outline" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Changes take effect immediately in the UI. Restart the dev server to apply
        server-side proxy changes.
      </p>
    </div>
  );
}
