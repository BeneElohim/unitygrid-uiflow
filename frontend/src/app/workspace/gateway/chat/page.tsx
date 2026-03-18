"use client";

/**
 * UnityGrid Agent Flow — Gateway Chat Page
 * ─────────────────────────────────────────
 * Connects to the OpenClaw Gateway via WebSocket (/gw proxy) and provides
 * a full streaming chat interface with:
 *   - Real-time token streaming
 *   - Agent tool-call cards
 *   - Stop / abort support
 *   - Gateway connection status indicator
 *   - Transcript history on connect
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SendHorizonal, Square, Terminal, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getGatewayClient,
  type GatewayEvent,
} from "@/lib/openclaw-gateway-client";

// ── Types ──────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant" | "tool" | "system";

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  streaming?: boolean;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  aborted?: boolean;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// ── Component ──────────────────────────────────────────────────────────────

export default function GatewayChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isRunning, setIsRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);

  // ── Connect to Gateway ───────────────────────────────────────────────────
  useEffect(() => {
    setStatus("connecting");
    const client = getGatewayClient();

    const unsubscribe = client.on((event: GatewayEvent) => {
      switch (event.type) {
        case "presence":
          if (event.status === "connected") setStatus("connected");
          else if (event.status === "disconnected") setStatus("disconnected");
          else if (event.status === "error") setStatus("error");
          break;

        case "ack":
          // chat.send acknowledged — a run has started
          if (event.status === "started") setIsRunning(true);
          else if (event.status === "ok") setIsRunning(false);
          break;

        case "chat":
          if (event.delta) {
            // Streaming token — append to current assistant message
            setMessages((prev) => {
              const id = streamingIdRef.current;
              if (!id) {
                const newId = `msg-${Date.now()}`;
                streamingIdRef.current = newId;
                return [
                  ...prev,
                  {
                    id: newId,
                    role: "assistant",
                    text: event.delta ?? "",
                    streaming: true,
                  },
                ];
              }
              return prev.map((m) =>
                m.id === id
                  ? { ...m, text: m.text + (event.delta ?? ""), streaming: true }
                  : m,
              );
            });
          } else if (event.text) {
            // Final message — replace streaming bubble
            setMessages((prev) => {
              const id = streamingIdRef.current;
              streamingIdRef.current = null;
              setIsRunning(false);
              if (id) {
                return prev.map((m) =>
                  m.id === id
                    ? { ...m, text: event.text ?? "", streaming: false }
                    : m,
                );
              }
              return [
                ...prev,
                {
                  id: `msg-${Date.now()}`,
                  role: "assistant",
                  text: event.text ?? "",
                  streaming: false,
                },
              ];
            });
          }
          break;

        case "agent":
          // Tool call card
          setMessages((prev) => [
            ...prev,
            {
              id: `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              role: "tool",
              text: "",
              toolName: event.tool,
              toolInput: event.toolInput,
              toolOutput: event.toolOutput,
            },
          ]);
          break;

        case "error":
          setIsRunning(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "system",
              text: `Gateway error: ${event.error ?? "unknown"}`,
            },
          ]);
          break;
      }
    });

    client.connect();

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isRunning) return;

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text },
    ]);
    setInput("");
    streamingIdRef.current = null;

    getGatewayClient().send({ text });
  }, [input, isRunning]);

  const handleStop = useCallback(() => {
    getGatewayClient().abort();
    setIsRunning(false);
    // Mark current streaming message as aborted
    setMessages((prev) =>
      prev.map((m) =>
        m.id === streamingIdRef.current ? { ...m, streaming: false, aborted: true } : m,
      ),
    );
    streamingIdRef.current = null;
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Terminal className="size-5 text-muted-foreground" />
        <span className="font-semibold text-sm">Gateway Chat</span>
        <div className="ml-auto flex items-center gap-2">
          <ConnectionBadge status={status} />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="flex flex-col gap-3 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-16">
              {status === "connected"
                ? "Connected to OpenClaw Gateway. Send a message to begin."
                : status === "connecting"
                  ? "Connecting to Gateway..."
                  : "Gateway offline. Start the Gateway to enable this channel."}
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t px-4 py-3">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Textarea
            className="min-h-[44px] max-h-[200px] resize-none"
            placeholder={
              status === "connected"
                ? "Message the Gateway... (Enter to send, Shift+Enter for newline)"
                : "Gateway offline"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status !== "connected" || isRunning}
            rows={1}
          />
          {isRunning ? (
            <Button
              size="icon"
              variant="destructive"
              onClick={handleStop}
              title="Stop"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={status !== "connected" || !input.trim()}
              title="Send"
            >
              <SendHorizonal className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const variants: Record<
    ConnectionStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    connected: { label: "Connected", variant: "default" },
    connecting: { label: "Connecting…", variant: "secondary" },
    disconnected: { label: "Offline", variant: "outline" },
    error: { label: "Error", variant: "destructive" },
  };
  const { label, variant } = variants[status];
  return (
    <Badge variant={variant} className="gap-1 text-xs">
      {status === "connected" ? (
        <Wifi className="size-3" />
      ) : (
        <WifiOff className="size-3" />
      )}
      {label}
    </Badge>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "tool") {
    return (
      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs font-mono">
        <div className="text-muted-foreground mb-1 font-semibold uppercase tracking-wide">
          Tool: {message.toolName ?? "unknown"}
        </div>
        {message.toolInput !== undefined && (
          <pre className="text-muted-foreground overflow-auto whitespace-pre-wrap">
            {JSON.stringify(message.toolInput, null, 2)}
          </pre>
        )}
        {message.toolOutput !== undefined && (
          <>
            <div className="text-muted-foreground mt-1 font-semibold uppercase tracking-wide">
              Output
            </div>
            <pre className="overflow-auto whitespace-pre-wrap">
              {JSON.stringify(message.toolOutput, null, 2)}
            </pre>
          </>
        )}
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className="text-center text-xs text-destructive py-1">
        {message.text}
      </div>
    );
  }

  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
          message.aborted && "opacity-60 italic",
        )}
      >
        <span className="whitespace-pre-wrap">{message.text}</span>
        {message.streaming && (
          <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-current opacity-70" />
        )}
        {message.aborted && (
          <span className="ml-2 text-xs opacity-60">[stopped]</span>
        )}
      </div>
    </div>
  );
}
