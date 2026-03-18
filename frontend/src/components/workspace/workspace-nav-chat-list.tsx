"use client";

import { BotIcon, MessagesSquare, ShieldCheck, Terminal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useI18n } from "@/core/i18n/hooks";

export function WorkspaceNavChatList() {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <SidebarGroup className="pt-1">
      <SidebarMenu>
        {/* ── Standard workspace nav ────────────────────────────────────── */}
        <SidebarMenuItem>
          <SidebarMenuButton isActive={pathname === "/workspace/chats"} asChild>
            <Link className="text-muted-foreground" href="/workspace/chats">
              <MessagesSquare />
              <span>{t.sidebar.chats}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname.startsWith("/workspace/agents")}
            asChild
          >
            <Link className="text-muted-foreground" href="/workspace/agents">
              <BotIcon />
              <span>{t.sidebar.agents}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {/* ── OpenClaw Gateway nav ──────────────────────────────────────── */}
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname.startsWith("/workspace/gateway/chat")}
            asChild
          >
            <Link
              className="text-muted-foreground"
              href="/workspace/gateway/chat"
            >
              <Terminal />
              <span>Gateway Chat</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname.startsWith("/workspace/gateway/control")}
            asChild
          >
            <Link
              className="text-muted-foreground"
              href="/workspace/gateway/control"
            >
              <ShieldCheck />
              <span>Gateway Control</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
