/**
 * UnityGrid Agent Flow — OpenClaw Gateway Client
 * ────────────────────────────────────────────────
 * Dual-mode client:
 *
 *   1. REST client (getGatewayClient) — for standard HTTP API calls.
 *      Reads NEXT_PUBLIC_OPENCLAW_BASE from env (default: http://localhost:3333).
 *      Used by Gateway Settings "List Models" test and future provider-switch logic.
 *
 *   2. WebSocket client (OpenClawGatewayClient / getGatewayWsClient) — for
 *      streaming chat via the /gw proxy (ws://localhost:3001).
 *      Used by the Gateway Chat workspace tab.
 *
 * Provider routing:
 *   - NIM is always the sovereign default (PROVIDER_LOCK=NIM in .env.local).
 *   - OpenClaw/OpenRouter can be enabled via Settings > Gateway > disable NIM lock.
 *   - The REST client automatically includes the auth token if present.
 *
 * Auth:
 *   - REST: Bearer token from NEXT_PUBLIC_UG_GATEWAY_TOKEN env or localStorage.
 *   - WS:   token sent as connect.params.auth.token in the first WS frame.
 */

// ── REST Client ───────────────────────────────────────────────────────────────

export interface GatewayRestClient {
  listModels: () => Promise<unknown>;
  chat: (body: unknown) => Promise<unknown>;
  health: () => Promise<unknown>;
}

/**
 * Returns a REST client for the OpenClaw Gateway HTTP API.
 *
 * Base URL resolution order:
 *   1. `baseOverride` argument (from Gateway Settings localStorage)
 *   2. NEXT_PUBLIC_OPENCLAW_BASE env var
 *   3. Default: http://localhost:3333
 */
export function getGatewayClient(opts?: { url?: string }): GatewayRestClient {
  const base =
    opts?.url ??
    (typeof window !== "undefined"
      ? localStorage.getItem("ug_gateway_url") ?? ""
      : "") ||
    process.env.NEXT_PUBLIC_OPENCLAW_BASE ||
    "http://localhost:3333";

  const token =
    (typeof window !== "undefined"
      ? localStorage.getItem("ug_gateway_token") ?? ""
      : "") ||
    process.env.NEXT_PUBLIC_UG_GATEWAY_TOKEN ||
    "";

  async function req(path: string, init: RequestInit = {}): Promise<unknown> {
    const headers = new Headers(init.headers as HeadersInit | undefined);
    if (token) headers.set("authorization", `Bearer ${token}`);
    headers.set("content-type", "application/json");
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`OpenClaw ${path} → HTTP ${res.status}`);
    return res.json() as Promise<unknown>;
  }

  return {
    listModels: () => req("/v1/models"),
    chat: (body: unknown) =>
      req("/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    health: () => req("/health"),
  };
}

// ── WebSocket Client ──────────────────────────────────────────────────────────

export type GatewayEventType = "chat" | "agent" | "presence" | "error" | "ack";

export interface GatewayEvent {
  type: GatewayEventType;
  runId?: string;
  status?: string;
  delta?: string;        // streaming token
  text?: string;         // final text
  tool?: string;         // tool name (agent events)
  toolInput?: unknown;   // tool input
  toolOutput?: unknown;  // tool output
  error?: string;
  sessionKey?: string;
}

export interface SendPayload {
  text: string;
  sessionKey?: string;
  idempotencyKey?: string;
}

export type GatewayEventHandler = (event: GatewayEvent) => void;

const DEFAULT_SESSION_KEY = "unitygrid:main";

export class OpenClawGatewayClient {
  private ws: WebSocket | null = null;
  private token: string;
  private gatewayWsUrl: string;
  private sessionKey: string;
  private handlers: Set<GatewayEventHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 30_000;
  private destroyed = false;

  constructor(opts?: {
    gatewayWsUrl?: string;
    url?: string;          // alias for gatewayWsUrl (REST client compat)
    token?: string;
    sessionKey?: string;
  }) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const wsOrigin = origin.replace(/^http/, "ws");
    this.gatewayWsUrl =
      opts?.gatewayWsUrl ??
      opts?.url ??
      (process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL
        ? process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL
        : `${wsOrigin}/gw`);
    this.token =
      opts?.token ??
      (typeof window !== "undefined"
        ? localStorage.getItem("ug_gateway_token") ?? ""
        : "") ||
      process.env.NEXT_PUBLIC_UG_GATEWAY_TOKEN ??
      "";
    this.sessionKey = opts?.sessionKey ?? DEFAULT_SESSION_KEY;
  }

  /** Subscribe to gateway events */
  on(handler: GatewayEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Connect to the Gateway WebSocket */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${this.gatewayWsUrl}/ws`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectDelay = 2000;
      this._send({
        method: "connect",
        params: {
          auth: { token: this.token },
          sessionKey: this.sessionKey,
        },
      });
      this._send({
        method: "chat.history",
        params: { sessionKey: this.sessionKey },
      });
      this._emit({ type: "presence", status: "connected" });
    };

    this.ws.onmessage = (e: MessageEvent) => {
      try {
        const raw = JSON.parse(e.data as string) as Record<string, unknown>;
        this._handleRaw(raw);
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onerror = () => {
      this._emit({ type: "presence", status: "error" });
    };

    this.ws.onclose = () => {
      this._emit({ type: "presence", status: "disconnected" });
      if (!this.destroyed) this._scheduleReconnect();
    };
  }

  /** Send a chat message */
  send(payload: SendPayload): void {
    this._send({
      method: "chat.send",
      params: {
        text: payload.text,
        sessionKey: payload.sessionKey ?? this.sessionKey,
        idempotencyKey:
          payload.idempotencyKey ??
          `ug-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });
  }

  /** Abort the active run */
  abort(sessionKey?: string): void {
    this._send({
      method: "chat.abort",
      params: { sessionKey: sessionKey ?? this.sessionKey },
    });
  }

  /**
   * Ping — resolves true if a WebSocket connection can be established
   * within `timeoutMs` milliseconds, false otherwise.
   */
  async ping(timeoutMs = 3000): Promise<boolean> {
    return new Promise((resolve) => {
      const wsUrl = `${this.gatewayWsUrl}/ws`;
      let settled = false;
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.close();
          resolve(false);
        }
      }, timeoutMs);
      ws.onopen = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          ws.close();
          resolve(true);
        }
      };
      ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(false);
        }
      };
    });
  }

  /** Disconnect and stop reconnecting */
  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private _emit(event: GatewayEvent): void {
    this.handlers.forEach((h) => h(event));
  }

  private _handleRaw(raw: Record<string, unknown>): void {
    const method = raw.method as string | undefined;
    const event = raw.event as string | undefined;
    const key = method ?? event ?? "";

    if (key === "chat" || key === "chat.stream") {
      this._emit({
        type: "chat",
        runId: raw.runId as string | undefined,
        status: raw.status as string | undefined,
        delta: raw.delta as string | undefined,
        text: raw.text as string | undefined,
      });
    } else if (key === "agent" || key.startsWith("agent.")) {
      this._emit({
        type: "agent",
        runId: raw.runId as string | undefined,
        tool: raw.tool as string | undefined,
        toolInput: raw.input,
        toolOutput: raw.output,
        status: raw.status as string | undefined,
      });
    } else if (key === "presence" || key === "system-presence") {
      this._emit({
        type: "presence",
        status: raw.status as string | undefined,
      });
    } else if (key === "error") {
      this._emit({
        type: "error",
        error: raw.message as string | undefined,
      });
    } else if (key === "ack" || raw.result !== undefined) {
      this._emit({
        type: "ack",
        runId: raw.runId as string | undefined,
        status: (raw.result as Record<string, unknown>)?.status as
          | string
          | undefined,
      });
    }
  }

  private _scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay,
      );
      this.connect();
    }, this.reconnectDelay);
  }
}

// ── WebSocket singleton factory ───────────────────────────────────────────────
let _wsInstance: OpenClawGatewayClient | null = null;

/**
 * Returns the singleton WebSocket Gateway client.
 * Pass `opts` to create a one-off client (e.g., for connection testing);
 * when `opts` is provided the singleton is NOT replaced.
 */
export function getGatewayWsClient(
  opts?: ConstructorParameters<typeof OpenClawGatewayClient>[0],
): OpenClawGatewayClient {
  if (opts) {
    return new OpenClawGatewayClient(opts);
  }
  if (!_wsInstance) {
    _wsInstance = new OpenClawGatewayClient();
  }
  return _wsInstance;
}
