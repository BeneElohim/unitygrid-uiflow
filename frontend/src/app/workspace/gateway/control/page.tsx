"use client";

/**
 * UnityGrid Agent Flow — Gateway Control Page
 * ────────────────────────────────────────────
 * Embeds the OpenClaw Control UI (served at /control via Next.js proxy)
 * in a full-height iframe within the workspace.
 *
 * The Control UI speaks directly to the Gateway WebSocket on the same
 * origin via the /gw proxy, so no CORS issues arise.
 *
 * Auth token is passed via the URL fragment (#token=...) which is never
 * sent to the server — safe per OpenClaw security model.
 *
 * Hydration note: GATEWAY_TOKEN and controlUrl are computed client-side
 * only (inside useEffect) to prevent SSR/client mismatch. The iframe
 * renders with src="/control" on both server and client until the effect
 * runs, then updates to include the token fragment on the client.
 */

import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function GatewayControlPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0); // increment to force reload

  // controlUrl starts as the safe SSR default and is updated client-side
  // after mount to include the token fragment — prevents hydration mismatch.
  const [controlUrl, setControlUrl] = useState("/control");

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_UG_GATEWAY_TOKEN ?? "";
    setControlUrl(
      token ? `/control#token=${encodeURIComponent(token)}` : "/control",
    );
  }, []);

  const handleReload = () => {
    setLoading(true);
    setKey((k) => k + 1);
  };

  const handleOpenExternal = () => {
    if (typeof window !== "undefined") {
      window.open(controlUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <ShieldCheck className="size-5 text-muted-foreground" />
        <span className="font-semibold text-sm">Gateway Control</span>
        <Badge variant="secondary" className="text-xs">OpenClaw v2026.3.x</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReload}
            title="Reload Control UI"
          >
            <RefreshCw className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleOpenExternal}
            title="Open in new tab"
          >
            <ExternalLink className="size-4" />
          </Button>
        </div>
      </div>

      {/* Iframe */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center text-sm text-muted-foreground space-y-2">
              <RefreshCw className="size-6 animate-spin mx-auto" />
              <p>Loading OpenClaw Control UI…</p>
              <p className="text-xs">
                Make sure the Gateway is running:{" "}
                <code className="bg-muted px-1 rounded">
                  openclaw gateway --config openclaw/configs/unitygrid.gateway.json5
                </code>
              </p>
            </div>
          </div>
        )}
        <iframe
          key={key}
          ref={iframeRef}
          src={controlUrl}
          className="h-full w-full border-0"
          title="OpenClaw Control UI"
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
          // suppressHydrationWarning prevents React from complaining about
          // the src attribute changing from "/control" (SSR) to the token URL (client)
          suppressHydrationWarning
          // Allow same-origin scripts and forms
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
