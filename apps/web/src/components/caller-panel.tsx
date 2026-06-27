"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import {
  Calendar,
  Headphones,
  Phone,
  PhoneOff,
  UserRound,
} from "lucide-react";
import type { CreateCallResponse } from "@vaizo/types";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const quickActions = [
  { icon: Calendar, label: "Book appointment" },
  { icon: UserRound, label: "Talk to human" },
  { icon: Headphones, label: "Check availability" },
];

function CallVisualizer() {
  const { state, audioTrack } = useVoiceAssistant();

  const stateLabel: Record<string, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting",
    initializing: "Initializing",
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
    failed: "Failed",
  };
  const label = stateLabel[state] ?? state;

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="h-28 w-full max-w-sm overflow-hidden rounded-2xl bg-slate-900/95 px-4 py-3">
        {audioTrack ? (
          <BarVisualizer
            state={state}
            barCount={20}
            trackRef={audioTrack}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            Connecting audio...
          </div>
        )}
      </div>
      <Badge variant={state === "speaking" ? "accent" : "default"}>{label}</Badge>
    </div>
  );
}

function ActiveCall({ session, onEnd }: { session: CreateCallResponse; onEnd: () => void }) {
  const endCall = async () => {
    await apiFetch(`/calls/${session.call.id}/end`, { method: "POST" });
    onEnd();
  };

  return (
    <LiveKitRoom
      serverUrl={session.livekitUrl}
      token={session.token}
      connect
      audio
      video={false}
      onDisconnected={onEnd}
      className="w-full max-w-xl"
    >
      <Card className="glass-card border-0">
        <CardContent className="space-y-4 p-8">
          <div className="text-center">
            <p className="text-sm font-medium text-primary">Connected</p>
            <h2 className="mt-1 text-xl font-semibold">Agent A is on the line</h2>
            <p className="mt-1 text-xs text-muted-foreground">{session.call.roomName}</p>
          </div>
          <CallVisualizer />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="outline" asChild>
              <Link href={`/monitor/${session.call.id}`}>Open monitor</Link>
            </Button>
            <Button variant="destructive" onClick={endCall}>
              <PhoneOff className="h-4 w-4" />
              End call
            </Button>
          </div>
        </CardContent>
      </Card>
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

export function CallerPanel() {
  const [session, setSession] = useState<CreateCallResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCall = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<CreateCallResponse>("/calls", { method: "POST" });
      setSession(data);
    } catch {
      setError("Failed to start call. Is the API running?");
    } finally {
      setLoading(false);
    }
  };

  if (session) {
    return <ActiveCall session={session} onEnd={() => setSession(null)} />;
  }

  return (
    <div className="w-full max-w-2xl space-y-4">
      <Card className="glass-card border-0">
        <CardContent className="p-6">
          <div className="rounded-2xl border border-border bg-white px-5 py-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Tap below to start a voice conversation
            </p>
            <Button
              size="lg"
              onClick={startCall}
              disabled={loading}
              className="mt-5 h-12 rounded-full px-8 shadow-md"
            >
              <Phone className="h-4 w-4" />
              {loading ? "Connecting..." : "Start voice call"}
            </Button>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={startCall}
                  disabled={loading}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-medium text-muted-foreground transition-colors",
                    "hover:border-primary/30 hover:bg-primary/5 hover:text-foreground",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
