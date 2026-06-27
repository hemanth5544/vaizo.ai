import type { Room } from "@livekit/rtc-node";
import {
  AGENT_ATTRIBUTES,
  type AgentState,
  MONITORING_TOPICS,
} from "@vaizo/types";
import { logCallEvent } from "./api-client.js";

export async function publishAgentState(
  room: Room,
  callId: string,
  state: AgentState,
  intent?: string,
  action?: string,
) {
  const local = room.localParticipant;
  if (!local) return;

  const attrs: Record<string, string> = {
    [AGENT_ATTRIBUTES.STATE]: state,
  };
  if (intent) attrs[AGENT_ATTRIBUTES.INTENT] = intent;
  if (action) attrs[AGENT_ATTRIBUTES.ACTION] = action;

  await local.setAttributes(attrs);

  await logCallEvent(callId, "state_change", {
    state,
    intent,
    action,
  });
}

export async function publishTranscript(
  room: Room,
  callId: string,
  role: "user" | "agent",
  text: string,
) {
  const writer = await room.localParticipant?.streamText({
    topic: MONITORING_TOPICS.CALL_EVENTS,
  });

  const payload = JSON.stringify({
    type: "transcript",
    callId,
    payload: { role, text },
    createdAt: new Date().toISOString(),
  });

  if (writer) {
    await writer.write(payload);
    await writer.close();
  }

  await logCallEvent(callId, "transcript", { role, text });
}

export async function publishBookingField(
  room: Room,
  callId: string,
  field: string,
  value: string,
) {
  const writer = await room.localParticipant?.streamText({
    topic: MONITORING_TOPICS.CALL_EVENTS,
  });

  const payload = JSON.stringify({
    type: "booking_field",
    callId,
    payload: { field, value },
    createdAt: new Date().toISOString(),
  });

  if (writer) {
    await writer.write(payload);
    await writer.close();
  }

  await logCallEvent(callId, "booking_field", { field, value });
}

export async function publishToolCall(
  room: Room,
  callId: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
  toolResult?: unknown,
) {
  const writer = await room.localParticipant?.streamText({
    topic: MONITORING_TOPICS.CALL_EVENTS,
  });

  const payload = JSON.stringify({
    type: "tool_call",
    callId,
    payload: { toolName, toolArgs, toolResult },
    createdAt: new Date().toISOString(),
  });

  if (writer) {
    await writer.write(payload);
    await writer.close();
  }

  await logCallEvent(callId, "tool_call", { toolName, toolArgs, toolResult });
}
