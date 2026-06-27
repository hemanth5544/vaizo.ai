"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import {
  AGENT_ATTRIBUTES,
  MONITORING_TOPICS,
  type AgentState,
  type CallStatus,
} from "@vaizo/types";
import {
  Activity,
  Headphones,
  Mic,
  PhoneOff,
  Radio,
  UserRound,
} from "lucide-react";
import type { RemoteParticipant, Room } from "livekit-client";
import { ParticipantEvent, RoomEvent } from "livekit-client";
import { apiFetch } from "@/lib/api";
import {
  mergeTranscriptLine,
  transcriptFromApiEvents,
  type TranscriptLine,
} from "@/lib/transcript";
import { ChatEmptyState, ChatMessage } from "@/components/chat-message";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type BookingFields = Record<string, string>;

const AGENT_STATE_LABEL: Record<AgentState, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  paused: "Paused",
  transferring: "Transferring",
};

const STATUS_VARIANT = {
  connected: "success",
  transferring: "warning",
  takeover: "accent",
  ended: "default",
} as const;

function AgentStateIndicator({ state }: { state: AgentState }) {
  const colors: Record<AgentState, string> = {
    listening: "bg-emerald-500",
    thinking: "bg-amber-500",
    speaking: "bg-primary",
    paused: "bg-muted-foreground",
    transferring: "bg-cyan-500",
  };

  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 animate-pulse rounded-full", colors[state])} />
      <span className="font-medium">{AGENT_STATE_LABEL[state]}</span>
    </div>
  );
}

function MonitorRoom({
  callId,
  token,
  livekitUrl,
  canPublish,
  onTakeover,
}: {
  callId: string;
  token: string;
  livekitUrl: string;
  canPublish: boolean;
  onTakeover: (token: string) => void;
}) {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [agentState, setAgentState] = useState<AgentState>("listening");
  const [intent, setIntent] = useState<string>("—");
  const [action, setAction] = useState<string>("—");
  const [bookingFields, setBookingFields] = useState<BookingFields>({});
  const [callStatus, setCallStatus] = useState<CallStatus>("connected");
  const [summary, setSummary] = useState<string | null>(null);
  const [takingOver, setTakingOver] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const appendTranscript = useCallback((line: Omit<TranscriptLine, "id"> & { id?: string }) => {
    setTranscript((prev) => mergeTranscriptLine(prev, line));
  }, []);

  const loadHistory = useCallback(async () => {
    const data = await apiFetch<{
      call: { status: CallStatus };
      events: { type: string; payload: Record<string, unknown>; createdAt: string }[];
      summary: { summaryText: string } | null;
    }>(`/calls/${callId}`);

    setCallStatus(data.call.status);
    if (data.summary) {
      setSummary(data.summary.summaryText);
    }

    setTranscript((prev) => {
      const historical = transcriptFromApiEvents(data.events);
      return historical.reduce(mergeTranscriptLine, prev);
    });

    for (const event of data.events) {
      const payload = event.payload;
      if (event.type === "booking_field" && payload.field && payload.value) {
        setBookingFields((prev) => ({
          ...prev,
          [String(payload.field)]: String(payload.value),
        }));
      }
      if (event.type === "state_change" && payload.state) {
        setAgentState(payload.state as AgentState);
        if (payload.intent) setIntent(String(payload.intent));
        if (payload.action) setAction(String(payload.action));
      }
    }

    setHistoryLoaded(true);
  }, [callId]);

  const refreshMetadata = useCallback(async () => {
    const data = await apiFetch<{
      call: { status: CallStatus };
      summary: { summaryText: string } | null;
    }>(`/calls/${callId}`);

    setCallStatus(data.call.status);
    if (data.summary) {
      setSummary(data.summary.summaryText);
    }
  }, [callId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const interval = setInterval(() => {
      void refreshMetadata();
    }, 3000);
    return () => clearInterval(interval);
  }, [refreshMetadata]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const handleTakeover = async () => {
    setTakingOver(true);
    try {
      const data = await apiFetch<{ token: string }>(`/calls/${callId}/takeover`, {
        method: "POST",
      });
      onTakeover(data.token);
    } finally {
      setTakingOver(false);
    }
  };

  const handleEndCall = async () => {
    await apiFetch(`/calls/${callId}/end`, { method: "POST" });
    await refreshMetadata();
  };

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={token}
      connect
      audio={canPublish}
      video={false}
    >
      <MonitorListeners
        onTranscript={appendTranscript}
        onAgentState={(state, i, a) => {
          setAgentState(state);
          if (i) setIntent(i);
          if (a) setAction(a);
        }}
        onBookingField={(field, value) =>
          setBookingFields((prev) => ({ ...prev, [field]: value }))
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="flex min-h-[560px] flex-col overflow-hidden">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 bg-primary/20">
                  <AvatarFallback className="bg-primary/20 text-primary">
                    <Radio className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">Live Conversation</CardTitle>
                  <CardDescription>Real-time caller ↔ agent chat</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canPublish && (
                  <Badge variant="accent" className="gap-1">
                    <Mic className="h-3 w-3" />
                    You are live
                  </Badge>
                )}
                <Badge variant={STATUS_VARIANT[callStatus] ?? "default"}>{callStatus}</Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col p-0">
            <ScrollArea className="flex-1 px-4 py-4">
              {!historyLoaded ? (
                <div className="space-y-4 p-2">
                  <Skeleton className="h-16 w-3/4" />
                  <Skeleton className="ml-auto h-12 w-2/5" />
                  <Skeleton className="h-20 w-4/5" />
                </div>
              ) : transcript.length === 0 ? (
                <div className="flex h-[420px] items-center justify-center">
                  <ChatEmptyState />
                </div>
              ) : (
                <div className="space-y-4 pb-2">
                  {transcript.map((line) => (
                    <ChatMessage key={line.id} line={line} />
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="border-t border-border bg-card/50 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Headphones className="h-3.5 w-3.5" />
                  {transcript.length} message{transcript.length === 1 ? "" : "s"}
                </span>
                <AgentStateIndicator state={agentState} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Agent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">State</p>
                <div className="mt-1">
                  <AgentStateIndicator state={agentState} />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Intent</p>
                <p className="mt-1 font-medium">{intent}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Current action</p>
                <p className="mt-1 text-xs leading-relaxed">{action}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="h-4 w-4 text-accent" />
                Booking Details
              </CardTitle>
              <CardDescription>Fields collected during the call</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {Object.keys(bookingFields).length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-muted-foreground">
                  No booking data yet
                </p>
              ) : (
                Object.entries(bookingFields).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2"
                  >
                    <span className="text-muted-foreground capitalize">{key}</span>
                    <span className="text-right font-medium">{value}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Controls</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {!canPublish && callStatus === "connected" && (
                <Button onClick={handleTakeover} disabled={takingOver} className="w-full">
                  <Mic className="h-4 w-4" />
                  {takingOver ? "Taking over..." : "Take Over Call"}
                </Button>
              )}
              {callStatus !== "ended" && (
                <Button variant="destructive" onClick={handleEndCall} className="w-full">
                  <PhoneOff className="h-4 w-4" />
                  End Call
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {summary && (
        <>
          <Separator className="my-6" />
          <Card>
            <CardHeader>
              <CardTitle>Post-Call Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
            </CardContent>
          </Card>
        </>
      )}

      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function MonitorListeners({
  onTranscript,
  onAgentState,
  onBookingField,
}: {
  onTranscript: (line: Omit<TranscriptLine, "id"> & { id?: string }) => void;
  onAgentState: (state: AgentState, intent?: string, action?: string) => void;
  onBookingField: (field: string, value: string) => void;
}) {
  const room = useRoomContext();
  const onTranscriptRef = useRef(onTranscript);
  const onAgentStateRef = useRef(onAgentState);
  const onBookingFieldRef = useRef(onBookingField);

  onTranscriptRef.current = onTranscript;
  onAgentStateRef.current = onAgentState;
  onBookingFieldRef.current = onBookingField;

  useEffect(() => {
    const handleAttributes = (participant: RemoteParticipant) => {
      const state = participant.attributes[AGENT_ATTRIBUTES.STATE] as AgentState | undefined;
      if (state) {
        onAgentStateRef.current(
          state,
          participant.attributes[AGENT_ATTRIBUTES.INTENT],
          participant.attributes[AGENT_ATTRIBUTES.ACTION],
        );
      }
    };

    const onParticipantConnected = (participant: RemoteParticipant) => {
      handleAttributes(participant);
      participant.on(ParticipantEvent.AttributesChanged, () => handleAttributes(participant));
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    for (const p of room.remoteParticipants.values()) {
      onParticipantConnected(p);
    }

    const topic = MONITORING_TOPICS.CALL_EVENTS;
    room.registerTextStreamHandler(topic, async (reader) => {
      const text = await reader.readAll();
      try {
        const event = JSON.parse(text) as {
          type: string;
          payload: Record<string, unknown>;
          createdAt?: string;
        };
        if (event.type === "transcript" && event.payload.text && event.payload.role) {
          onTranscriptRef.current({
            role: event.payload.role as TranscriptLine["role"],
            text: String(event.payload.text),
            at: event.createdAt ?? new Date().toISOString(),
          });
        }
        if (event.type === "booking_field" && event.payload.field && event.payload.value) {
          onBookingFieldRef.current(
            String(event.payload.field),
            String(event.payload.value),
          );
        }
      } catch {
        // ignore malformed events
      }
    });

    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.unregisterTextStreamHandler(topic);
    };
  }, [room]);

  return null;
}

export function MonitorDashboard({ callId }: { callId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string>("");
  const [canPublish, setCanPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ token: string; livekitUrl: string; canPublish: boolean }>(
      `/calls/${callId}/watcher-token`,
      { method: "POST", body: JSON.stringify({ canPublish: false }) },
    )
      .then((data) => {
        setToken(data.token);
        setLivekitUrl(data.livekitUrl);
        setCanPublish(data.canPublish);
      })
      .catch(() => setError("Failed to connect to monitor"));
  }, [callId]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-red-400">{error}</CardContent>
      </Card>
    );
  }

  if (!token || !livekitUrl) {
    return (
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="space-y-4 py-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="ml-auto h-16 w-2/5" />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <MonitorRoom
      callId={callId}
      token={token}
      livekitUrl={livekitUrl}
      canPublish={canPublish}
      onTakeover={(newToken) => {
        setToken(newToken);
        setCanPublish(true);
      }}
    />
  );
}
