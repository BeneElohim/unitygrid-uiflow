/**
 * UnityGrid Agent Flow — Next.js Configuration
 * ─────────────────────────────────────────────
 * Adds reverse proxy rewrites for OpenClaw Gateway:
 *   /control  → http://127.0.0.1:8765/control  (Control UI SPA)
 *   /gw/*     → http://127.0.0.1:8765/*         (Gateway REST + WebSocket)
 *
 * The Gateway runs on :8765 (internal only).
 * The UI runs on :8502 and proxies both routes under the same origin.
 *
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 */
import "./src/env.js";

const GATEWAY_HOST =
  process.env.OPENCLAW_GATEWAY_URL ?? "http://127.0.0.1:8765";

/** @type {import("next").NextConfig} */
const config = {
  devIndicators: false,

  // ── Reverse proxy rewrites ─────────────────────────────────────────────────
  async rewrites() {
    return [
      // Control UI SPA — proxy all assets and routes under /control
      {
        source: "/control",
        destination: `${GATEWAY_HOST}/control`,
      },
      {
        source: "/control/:path*",
        destination: `${GATEWAY_HOST}/control/:path*`,
      },
      // Gateway REST + WebSocket — strip /gw prefix
      {
        source: "/gw/:path*",
        destination: `${GATEWAY_HOST}/:path*`,
      },
    ];
  },

  // ── Security headers ───────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Allow the Control UI iframe to load under the same origin
        source: "/control/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default config;
