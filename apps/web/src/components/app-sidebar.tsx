"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  History,
  LayoutDashboard,
  Phone,
  Radio,
  Search,
  Sparkles,
} from "lucide-react";
import type { CallSession } from "@vaizo/types";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/", label: "Voice Call", icon: Phone },
  { href: "/monitor", label: "Monitor", icon: LayoutDashboard },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch<{ calls: CallSession[] }>("/calls");
        setCalls(data.calls.slice(0, 8));
      } catch {
        setCalls([]);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredCalls = calls.filter((call) =>
    call.roomName.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Vaizo</p>
          <p className="text-xs text-muted-foreground">Voice Agent</p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search calls..."
            className="h-9 rounded-xl bg-secondary/50 pl-9 text-xs"
          />
        </div>
      </div>

      <nav className="space-y-1 px-3">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator className="my-4" />

      <div className="flex min-h-0 flex-1 flex-col px-4">
        <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Recent calls
        </div>
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-1">
            {filteredCalls.length === 0 && (
              <p className="px-2 py-4 text-xs text-muted-foreground">No calls yet</p>
            )}
            {filteredCalls.map((call) => {
              const active = pathname === `/monitor/${call.id}`;
              const isLive = call.status !== "ended";
              return (
                <Link
                  key={call.id}
                  href={`/monitor/${call.id}`}
                  className={cn(
                    "block rounded-xl px-3 py-2.5 transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-sidebar-foreground hover:bg-secondary/70 hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isLive && <Radio className="h-3 w-3 shrink-0 text-emerald-500" />}
                    <p className="truncate text-xs font-medium">{call.roomName}</p>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {new Date(call.startedAt).toLocaleString()}
                  </p>
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
