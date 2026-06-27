import { z } from "zod";

export const CallStatusSchema = z.enum([
  "connected",
  "transferring",
  "takeover",
  "ended",
]);
export type CallStatus = z.infer<typeof CallStatusSchema>;

export const AgentStateSchema = z.enum([
  "listening",
  "thinking",
  "speaking",
  "paused",
  "transferring",
]);
export type AgentState = z.infer<typeof AgentStateSchema>;

export const CallEventTypeSchema = z.enum([
  "transcript",
  "state_change",
  "tool_call",
  "intent",
  "booking_field",
  "transfer",
  "summary",
]);
export type CallEventType = z.infer<typeof CallEventTypeSchema>;

export const CallEventPayloadSchema = z.object({
  role: z.enum(["user", "agent", "watcher", "system"]).optional(),
  text: z.string().optional(),
  state: AgentStateSchema.optional(),
  intent: z.string().optional(),
  action: z.string().optional(),
  toolName: z.string().optional(),
  toolArgs: z.record(z.unknown()).optional(),
  toolResult: z.unknown().optional(),
  field: z.string().optional(),
  value: z.string().optional(),
  transferStatus: z.enum(["started", "accepted", "declined", "failed"]).optional(),
});
export type CallEventPayload = z.infer<typeof CallEventPayloadSchema>;

export const CallEventSchema = z.object({
  id: z.string().optional(),
  callId: z.string(),
  type: CallEventTypeSchema,
  payload: CallEventPayloadSchema,
  createdAt: z.string().optional(),
});
export type CallEvent = z.infer<typeof CallEventSchema>;

export const AppointmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  reason: z.string(),
  scheduledAt: z.string(),
  phone: z.string(),
  status: z.enum(["confirmed", "cancelled"]),
  callId: z.string().nullable().optional(),
});
export type Appointment = z.infer<typeof AppointmentSchema>;

export const CheckAvailabilityRequestSchema = z.object({
  date: z.string(),
  time: z.string().optional(),
});
export type CheckAvailabilityRequest = z.infer<typeof CheckAvailabilityRequestSchema>;

export const BookAppointmentRequestSchema = z.object({
  name: z.string(),
  reason: z.string(),
  scheduledAt: z.string(),
  phone: z.string(),
  callId: z.string().optional(),
});
export type BookAppointmentRequest = z.infer<typeof BookAppointmentRequestSchema>;

export const CallSessionSchema = z.object({
  id: z.string(),
  roomName: z.string(),
  status: CallStatusSchema,
  startedAt: z.string(),
  endedAt: z.string().nullable().optional(),
});
export type CallSession = z.infer<typeof CallSessionSchema>;

export const CreateCallResponseSchema = z.object({
  call: CallSessionSchema,
  token: z.string(),
  livekitUrl: z.string(),
});
export type CreateCallResponse = z.infer<typeof CreateCallResponseSchema>;

export const WatcherTokenResponseSchema = z.object({
  token: z.string(),
  livekitUrl: z.string(),
  canPublish: z.boolean(),
});
export type WatcherTokenResponse = z.infer<typeof WatcherTokenResponseSchema>;

export const CallSummarySchema = z.object({
  callId: z.string(),
  summaryText: z.string(),
  intents: z.array(z.string()),
  bookingId: z.string().nullable().optional(),
});
export type CallSummary = z.infer<typeof CallSummarySchema>;

export const MONITORING_TOPICS = {
  CALL_EVENTS: "vaizo.call-events",
  CONTROL: "vaizo.control",
} as const  ;

export const RPC_METHODS = {
  TAKEOVER: "vaizo.takeover",
  END_CALL: "vaizo.endCall",
} as const;

export const AGENT_ATTRIBUTES = {
  STATE: "agent.state",
  INTENT: "agent.intent",
  ACTION: "agent.action",
} as const;
