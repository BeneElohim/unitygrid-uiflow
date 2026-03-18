/**
 * UnityGrid Agent Flow — Next.js Configuration
 * ─────────────────────────────────────────────
 * Reverse proxy rewrites for OpenClaw Gateway:
 *
 *   /control/*   → OPENCLAW_GATEWAY_CONTROL_URL  (Control UI SPA)
 *   /gw/*        → OPENCLAW_GATEWAY_WS_URL       (Gateway WebSocket)
 *   /gateway/*   → NEXT_PUBLIC_OPENCLAW_BASE     (Gateway REST API)
 *
 * Default ports:
 *   Control UI + WS  → :3001
 *   REST API         → :3333
 *
 * All three can be overridden in .env.local without code changes.
 */
import "./src/env.js";

// ── Proxy targets ──────────────────────────────────────────────────────────────

const GATEWAY_CONTROL_URL =
  process.env.OPENCLAW_GATEWAY_CONTROL_URL ?? "http://127.0.0.1:3001";

const GATEWAY_WS_URL =
  process.env.OPENCLAW_GATEWAY_WS_URL ?? "http://127.0.0.1:3001";

const GATEWAY_REST_BASE =
  process.env.NEXT_PUBLIC_OPENCLAW_BASE ?? "http://127.0.0.1:3333";

/** @type {import("next").NextConfig} */
const config = {
  devIndicators: false,

  // ── Server binding hardening ───────────────────────────────────────────────
  // Bind to loopback only; prevents exposure on LAN/public interfaces.
  // Override with NEXT_PUBLIC_APP_HOST=0.0.0.0 only when explicitly needed.
  hostname: process.env.NEXT_PUBLIC_APP_HOST ?? "127.0.0.1",

  // Disable host-header origin fallback to prevent host-header injection.
  // Requests with unexpected Host headers will be rejected.
  allowedDevOrigins: ["localhost", "127.0.0.1"],

  // ── Reverse proxy rewrites ─────────────────────────────────────────────────
  async rewrites() {
    return [
      // ── Control UI SPA ─────────────────────────────────────────────────────
      // Proxy all assets and routes under /control to the Gateway Control UI
      {
        source: "/control",
        destination: `${GATEWAY_CONTROL_URL}/control`,
      },
      {
        source: "/control/:path*",
        destination: `${GATEWAY_CONTROL_URL}/control/:path*`,
      },

      // ── Gateway WebSocket ──────────────────────────────────────────────────
      // Strip /gw prefix; WebSocket upgrade is handled by the browser directly
      {
        source: "/gw/:path*",
        destination: `${GATEWAY_WS_URL}/:path*`,
      },

      // ── Gateway REST API ───────────────────────────────────────────────────
      // /gateway/v1/models → NEXT_PUBLIC_OPENCLAW_BASE/v1/models etc.
      // Allows the client to call /gateway instead of a cross-origin URL.
      {
        source: "/gateway/:path*",
        destination: `${GATEWAY_REST_BASE}/:path*`,
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
      {
        // CORS headers for the Gateway REST proxy
        source: "/gateway/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default config;
