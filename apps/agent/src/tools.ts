import { llm, beta, inference, voice } from "@livekit/agents";
import type { Room } from "@livekit/rtc-node";
import { z } from "zod";
import { apiFetch, logCallEvent, updateCallStatus } from "./api-client.js";
import {
  publishBookingField,
  publishToolCall,
} from "./monitoring.js";

export function createBookingTools(ctx: { callId: string; room: Room }) {
  const checkAvailability = llm.tool({
    description:
      "Check appointment availability for a given date and optional preferred time. Business hours are 9 AM to 5 PM.",
    parameters: z.object({
      date: z.string().describe("Date in YYYY-MM-DD format"),
      time: z
        .string()
        .optional()
        .describe("Preferred time in HH:MM 24h format"),
    }),
    execute: async ({ date, time }) => {
      await publishToolCall(ctx.room, ctx.callId, "checkAvailability", {
        date,
        time,
      });

      const result = await apiFetch<{
        date: string;
        slots: string[];
        available?: boolean;
        preferredTime?: string;
      }>(`/appointments/availability?date=${date}${time ? `&time=${time}` : ""}`);

      await publishToolCall(
        ctx.room,
        ctx.callId,
        "checkAvailability",
        { date, time },
        result,
      );

      return JSON.stringify(result);
    },
  });

  const bookAppointment = llm.tool({
    description:
      "Book an appointment after confirming all details with the caller: name, reason, date/time, and phone number.",
    parameters: z.object({
      name: z.string(),
      reason: z.string(),
      scheduledAt: z
        .string()
        .describe("ISO datetime or YYYY-MM-DDTHH:MM format"),
      phone: z.string(),
    }),
    execute: async ({ name, reason, scheduledAt, phone }) => {
      await publishBookingField(ctx.room, ctx.callId, "name", name);
      await publishBookingField(ctx.room, ctx.callId, "reason", reason);
      await publishBookingField(ctx.room, ctx.callId, "scheduledAt", scheduledAt);
      await publishBookingField(ctx.room, ctx.callId, "phone", phone);

      await publishToolCall(ctx.room, ctx.callId, "bookAppointment", {
        name,
        reason,
        scheduledAt,
        phone,
      });

      const appointment = await apiFetch<{
        id: string;
        scheduledAt: string;
      }>("/appointments", {
        method: "POST",
        body: JSON.stringify({
          name,
          reason,
          scheduledAt,
          phone,
          callId: ctx.callId,
        }),
      });

      await publishToolCall(
        ctx.room,
        ctx.callId,
        "bookAppointment",
        { name, reason, scheduledAt, phone },
        appointment,
      );

      return JSON.stringify({
        success: true,
        confirmationId: appointment.id,
        scheduledAt: appointment.scheduledAt,
        message: `Appointment confirmed for ${name} on ${appointment.scheduledAt}`,
      });
    },
  });

  return { checkAvailability, bookAppointment };
}

export function createTransferTool(ctx: { callId: string; room: Room }) {
  return llm.tool({
    description:
      "Transfer the caller to a human agent when they ask to speak to a person, have a billing issue, complaint, or request escalation.",
    parameters: z.object({
      reason: z.string().describe("Why the caller needs a human"),
    }),
    execute: async ({ reason }, opts) => {
      await logCallEvent(ctx.callId, "transfer", {
        transferStatus: "started",
        text: reason,
      });
      await updateCallStatus(ctx.callId, "transferring");

      const sipTrunkId =
        process.env.LIVEKIT_SIP_OUTBOUND_TRUNK_ID ??
        process.env.LIVEKIT_SIP_OUTBOUND_TRUNK;
      const supervisorPhone = process.env.SUPERVISOR_PHONE_NUMBER;

      if (!sipTrunkId || !supervisorPhone) {
        await updateCallStatus(ctx.callId, "connected");
        return "Warm transfer is not configured. Apologize and offer to take a message or continue helping.";
      }

      await opts.ctx.waitForPlayout();

      return llm.handoff({
        agent: new beta.WarmTransferTask({
          sipCallTo: supervisorPhone,
          sipTrunkId,
          chatCtx: opts.ctx.session.chatCtx,
        }),
        returns:
          "Connecting the caller to a human agent now. If the team declines, apologize and offer alternatives.",
      });
    },
  });
}
