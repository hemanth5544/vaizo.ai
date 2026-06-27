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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Operations Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Monitor live calls, read transcripts, and take over conversations when needed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total calls</CardDescription>
            <CardTitle className="text-3xl">{loading ? "—" : stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-emerald-400" />
              Active now
            </CardDescription>
            <CardTitle className="text-3xl text-emerald-400">
              {loading ? "—" : stats.active}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl">{loading ? "—" : stats.ended}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Call sessions</CardTitle>
          <CardDescription>Click a session to open the live chat monitor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          )}

          {!loading && calls.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
              <Phone className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">No calls yet</p>
                <p className="text-sm text-muted-foreground">
                  Start a call from the Call page to see it here.
                </p>
              </div>
              <Link
                href="/"
                className="text-sm text-primary hover:underline"
              >
                Go to Call page
              </Link>
            </div>
          )}

          {calls.map((call) => (
            <Link key={call.id} href={`/monitor/${call.id}`}>
              <div className="group flex items-center justify-between rounded-lg border border-border bg-secondary/20 px-4 py-4 transition-colors hover:border-primary/40 hover:bg-secondary/40">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/15 p-2 text-primary">
                    <PhoneCall className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{call.roomName}</p>
                    <p className="text-sm text-muted-foreground">
                      Started {new Date(call.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
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
