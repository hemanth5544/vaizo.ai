"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Phone, PhoneCall, Radio } from "lucide-react";
import type { CallSession } from "@vaizo/types";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type CallListItem = CallSession & { hasSummary?: boolean };

const statusVariant = {
  connected: "success",
  transferring: "warning",
  takeover: "accent",
  ended: "default",
} as const;

export default function MonitorListPage() {
  const [calls, setCalls] = useState<CallListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch<{ calls: CallListItem[] }>("/calls");
        setCalls(data.calls);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const active = calls.filter((c) => c.status !== "ended").length;
    const ended = calls.filter((c) => c.status === "ended").length;
    return { total: calls.length, active, ended };
  }, [calls]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Operations</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Live <span className="text-gradient">monitor</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Watch active calls, read transcripts, and take over conversations when needed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total calls", value: stats.total },
          { label: "Active now", value: stats.active, highlight: true },
          { label: "Completed", value: stats.ended },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle
                className={
                  stat.highlight ? "text-3xl text-emerald-600" : "text-3xl font-semibold"
                }
              >
                {loading ? "—" : stat.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Call sessions</CardTitle>
          <CardDescription>Open a session to view the live chat feed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && (
            <>
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </>
          )}

          {!loading && calls.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-white/60 py-14 text-center">
              <Phone className="h-8 w-8 text-muted-foreground/70" />
              <div>
                <p className="font-medium">No calls yet</p>
                <p className="text-sm text-muted-foreground">
                  Start a call from the Voice Call page.
                </p>
              </div>
              <Link href="/" className="text-sm font-medium text-primary hover:underline">
                Go to Voice Call
              </Link>
            </div>
          )}

          {calls.map((call) => (
            <Link key={call.id} href={`/monitor/${call.id}`}>
              <div className="group flex items-center justify-between rounded-xl border border-border bg-white px-4 py-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <PhoneCall className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{call.roomName}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(call.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {call.status !== "ended" && (
                    <Radio className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                  <Badge variant={statusVariant[call.status] ?? "default"}>
                    {call.status}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
