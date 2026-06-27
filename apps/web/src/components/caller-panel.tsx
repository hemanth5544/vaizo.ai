"use client";

import { useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Phone, PhoneOff } from "lucide-react";
import type { CreateCallResponse } from "@vaizo/types";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="h-32 w-full max-w-md">
        {audioTrack && (
          <BarVisualizer
            state={state}
            barCount={24}
            trackRef={audioTrack}
            className="h-full w-full"
          />
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
      className="space-y-4"
    >
      <Card>
        <CardHeader>
          <CardTitle>Connected to Agent A</CardTitle>
          <CardDescription>Room: {session.call.roomName}</CardDescription>
        </CardHeader>
        <CardContent>
          <CallVisualizer />
          <div className="flex justify-center gap-3">
            <Button variant="destructive" onClick={endCall}>
              <PhoneOff className="h-4 w-4" />
              End Call
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
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Start a Voice Call</CardTitle>
        <CardDescription>
          Connect with Agent A to book an appointment or request a human transfer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button size="lg" onClick={startCall} disabled={loading} className="w-full">
          <Phone className="h-4 w-4" />
          {loading ? "Connecting..." : "Start Call"}
        </Button>
      </CardContent>
    </Card>
  );
}
