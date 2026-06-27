import "./env.js";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { prisma } from "@vaizo/database";
import { BookAppointmentRequestSchema, CheckAvailabilityRequestSchema } from "@vaizo/types";
import { bookAppointment, getAvailableSlots } from "./lib/appointments.js";
import {
  createParticipantToken,
  deleteRoom,
  getLiveKitUrl,
  sendControlToAgent,
} from "./lib/livekit.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.post("/calls", async (c) => {
  const roomName = `call-${crypto.randomUUID().slice(0, 8)}`;
  const call = await prisma.callSession.create({
    data: { roomName, status: "connected" },
  });

  const token = await createParticipantToken({
    roomName,
    identity: `caller-${call.id}`,
    name: "Caller",
    canPublish: true,
    canSubscribe: true,
    metadata: JSON.stringify({ role: "caller", callId: call.id }),
    roomConfig: {
      agents: [{ agentName: process.env.LIVEKIT_AGENT_NAME ?? "vaizo-voice-agent" }],
    },
  });

  return c.json({
    call: {
      id: call.id,
      roomName: call.roomName,
      status: call.status,
      startedAt: call.startedAt.toISOString(),
      endedAt: call.endedAt?.toISOString() ?? null,
    },
    token,
    livekitUrl: getLiveKitUrl(),
  });
});

app.get("/calls", async (c) => {
  const status = c.req.query("status");
  const calls = await prisma.callSession.findMany({
    where: status ? { status: status as "connected" } : undefined,
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { summary: true },
  });

  return c.json({
    calls: calls.map((call) => ({
      id: call.id,
      roomName: call.roomName,
      status: call.status,
      startedAt: call.startedAt.toISOString(),
      endedAt: call.endedAt?.toISOString() ?? null,
      hasSummary: Boolean(call.summary),
    })),
  });
});

app.get("/calls/:id", async (c) => {
  const id = c.req.param("id");
  const call = await prisma.callSession.findUnique({
    where: { id },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      summary: true,
      appointments: true,
    },
  });

  if (!call) {
    return c.json({ error: "Call not found" }, 404);
  }

  return c.json({
    call: {
      id: call.id,
      roomName: call.roomName,
      status: call.status,
      startedAt: call.startedAt.toISOString(),
      endedAt: call.endedAt?.toISOString() ?? null,
    },
    events: call.events.map((e) => ({
      id: e.id,
      callId: e.callId,
      type: e.type,
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
    })),
    summary: call.summary
      ? {
          callId: call.summary.callId,
          summaryText: call.summary.summaryText,
          intents: call.summary.intents,
          bookingId: call.summary.bookingId,
        }
      : null,
    appointments: call.appointments.map((a) => ({
      id: a.id,
      name: a.name,
      reason: a.reason,
      scheduledAt: a.scheduledAt.toISOString(),
      phone: a.phone,
      status: a.status,
    })),
  });
});

app.post("/calls/:id/events", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ type: string; payload: unknown }>();

  const call = await prisma.callSession.findUnique({ where: { id } });
  if (!call) {
    return c.json({ error: "Call not found" }, 404);
  }

  const event = await prisma.callEvent.create({
    data: {
      callId: id,
      type: body.type,
      payload: body.payload as object,
    },
  });

  return c.json({
    id: event.id,
    callId: event.callId,
    type: event.type,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  });
});

app.patch("/calls/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ status: string }>();

  const call = await prisma.callSession.update({
    where: { id },
    data: {
      status: body.status as "connected" | "transferring" | "takeover" | "ended",
      endedAt: body.status === "ended" ? new Date() : undefined,
    },
  });

  return c.json({
    id: call.id,
    status: call.status,
    endedAt: call.endedAt?.toISOString() ?? null,
  });
});

app.post("/calls/:id/watcher-token", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ canPublish?: boolean }>().catch(() => ({
    canPublish: false,
  }));

  const call = await prisma.callSession.findUnique({ where: { id } });
  if (!call) {
    return c.json({ error: "Call not found" }, 404);
  }

  const canPublish = body.canPublish ?? false;
  const token = await createParticipantToken({
    roomName: call.roomName,
    identity: `watcher-${id}-${Date.now()}`,
    name: "Watcher",
    canPublish,
    canSubscribe: true,
    metadata: JSON.stringify({ role: "watcher", callId: id }),
  });

  return c.json({
    token,
    livekitUrl: getLiveKitUrl(),
    canPublish,
  });
});

app.post("/calls/:id/takeover", async (c) => {
  const id = c.req.param("id");
  const call = await prisma.callSession.findUnique({ where: { id } });
  if (!call) {
    return c.json({ error: "Call not found" }, 404);
  }

  await sendControlToAgent(call.roomName, "takeover");

  await prisma.callSession.update({
    where: { id },
    data: { status: "takeover" },
  });

  const token = await createParticipantToken({
    roomName: call.roomName,
    identity: `watcher-${id}-takeover`,
    name: "Human Agent",
    canPublish: true,
    canSubscribe: true,
    metadata: JSON.stringify({ role: "watcher", callId: id, takeover: true }),
  });

  return c.json({
    token,
    livekitUrl: getLiveKitUrl(),
    canPublish: true,
  });
});

app.post("/calls/:id/end", async (c) => {
  const id = c.req.param("id");
  const call = await prisma.callSession.findUnique({ where: { id } });
  if (!call) {
    return c.json({ error: "Call not found" }, 404);
  }

  try {
    await sendControlToAgent(call.roomName, "end");
  } catch {
    // Agent may have already left
  }

  await prisma.callSession.update({
    where: { id },
    data: { status: "ended", endedAt: new Date() },
  });

  await deleteRoom(call.roomName);

  return c.json({ ok: true });
});

app.post("/calls/:id/summary", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    summaryText: string;
    intents: string[];
    bookingId?: string;
  }>();

  const summary = await prisma.callSummary.upsert({
    where: { callId: id },
    create: {
      callId: id,
      summaryText: body.summaryText,
      intents: body.intents,
      bookingId: body.bookingId,
    },
    update: {
      summaryText: body.summaryText,
      intents: body.intents,
      bookingId: body.bookingId,
    },
  });

  await prisma.callSession.update({
    where: { id },
    data: { status: "ended", endedAt: new Date() },
  });

  return c.json({
    callId: summary.callId,
    summaryText: summary.summaryText,
    intents: summary.intents,
    bookingId: summary.bookingId,
  });
});

app.get("/appointments/availability", async (c) => {
  const date = c.req.query("date");
  const time = c.req.query("time") ?? undefined;
  if (!date) {
    return c.json({ error: "date is required" }, 400);
  }

  const parsed = CheckAvailabilityRequestSchema.safeParse({ date, time });
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const result = await getAvailableSlots(parsed.data.date, parsed.data.time);
  return c.json(result);
});

app.post("/appointments", async (c) => {
  const body = await c.req.json();
  const parsed = BookAppointmentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const appointment = await bookAppointment(parsed.data);
    return c.json({
      id: appointment.id,
      name: appointment.name,
      reason: appointment.reason,
      scheduledAt: appointment.scheduledAt.toISOString(),
      phone: appointment.phone,
      status: appointment.status,
      callId: appointment.callId,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Booking failed" },
      400,
    );
  }
});

export default app;

import { serve } from "@hono/node-server";

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, () => {
  console.log(`API listening on http://localhost:${port}`);
});
