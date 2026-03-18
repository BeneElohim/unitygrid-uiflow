/**
 * UnityGrid Agent Flow — OpenClaw Gateway WebSocket Client
 * ──────────────────────────────────────────────────────────
 * Connects to the OpenClaw Gateway via WebSocket (proxied through /gw/ws).
 * Maps Gateway events into the UnityGrid message schema.
 *
 * Gateway WS methods used:
 *   chat.history  — fetch transcript on connect
 *   chat.send     — send a message (non-blocking, streams via events)
 *   chat.abort    — stop an active run
 *
 * Gateway events received:
 *   chat          — token stream / final message
 *   agent         — tool call / agent step events
 *   presence      — connection status
 *   error         — error events
 *
 * Auth: token sent as connect.params.auth.token in the first WS message.
 */

export type GatewayEventType = "chat" | "agent" | "presence" | "error" | "ack";

export interface GatewayEvent {
  type: GatewayEventType;
  runId?: string;
  status?: string;
  delta?: string;        // streaming token
  text?: string;         // final text
  tool?: string;         // tool name (agent events)
  toolInput?: unknown;   // tool input (agent events)
  toolOutput?: unknown;  // tool output (agent events)
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
    token?: string;
    sessionKey?: string;
  }) {
    // Derive WebSocket URL from the /gw proxy path
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const wsOrigin = origin.replace(/^http/, "ws");
    this.gatewayWsUrl =
      opts?.gatewayWsUrl ??
      (process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL
        ? process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL
        : `${wsOrigin}/gw`);
    this.token = opts?.token ?? process.env.NEXT_PUBLIC_UG_GATEWAY_TOKEN ?? "";
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
      this.reconnectDelay = 2000; // reset backoff
      // Authenticate: send connect RPC
      this._send({
        method: "connect",
        params: {
          auth: { token: this.token },
          sessionKey: this.sessionKey,
        },
      });
      // Fetch history
      this._send({ method: "chat.history", params: { sessionKey: this.sessionKey } });
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
          payload.idempotencyKey ?? `ug-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
   * Ping the Gateway — resolves true if a WebSocket connection can be
   * established within `timeoutMs` milliseconds, false otherwise.
   */
  async ping(timeoutMs = 3000): Promise<boolean> {
    return new Promise((resolve) => {
      const wsUrl = `${this.gatewayWsUrl}/ws`;
      let settled = false;
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        if (!settled) { settled = true; ws.close(); resolve(false); }
      }, timeoutMs);
      ws.onopen = () => {
        if (!settled) { settled = true; clearTimeout(timer); ws.close(); resolve(true); }
      };
      ws.onerror = () => {
        if (!settled) { settled = true; clearTimeout(timer); resolve(false); }
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
        status: (raw.result as Record<string, unknown>)?.status as string | undefined,
      });
    }
  }

  private _scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }
}

// ── Singleton factory ────────────────────────────────────────────────────────
let _instance: OpenClawGatewayClient | null = null;

/**
 * Returns the singleton Gateway client.
 * Pass `opts` to create a one-off client (e.g., for connection testing);
 * when `opts` is provided the singleton is NOT replaced.
 */
export function getGatewayClient(
  opts?: ConstructorParameters<typeof OpenClawGatewayClient>[0],
): OpenClawGatewayClient {
  if (opts) {
    // One-off instance for testing — does not replace the singleton
    return new OpenClawGatewayClient(opts);
  }
  if (!_instance) {
    _instance = new OpenClawGatewayClient();
  }
  return _instance;
}
