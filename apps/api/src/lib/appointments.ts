import { prisma } from "@vaizo/database";

const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 17;
const SLOT_MINUTES = 30;

function parseDateTime(date: string, time?: string): Date {
  if (time) {
    return new Date(`${date}T${time}:00`);
  }
  return new Date(`${date}T09:00:00`);
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

function isBusinessHour(date: Date): boolean {
  const hour = date.getHours();
  const minutes = date.getMinutes();
  if (hour < BUSINESS_START_HOUR) return false;
  if (hour > BUSINESS_END_HOUR) return false;
  if (hour === BUSINESS_END_HOUR && minutes > 0) return false;
  return minutes % SLOT_MINUTES === 0;
}

export async function getAvailableSlots(date: string, preferredTime?: string) {
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const existing = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: "confirmed",
    },
    select: { scheduledAt: true },
  });

  const booked = new Set(
    existing.map((a) => a.scheduledAt.toISOString()),
  );

  const slots: string[] = [];
  for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour++) {
    for (const minute of [0, 30]) {
      const slot = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
      if (!isBusinessHour(slot)) continue;
      if (booked.has(slot.toISOString())) continue;
      slots.push(formatTime(slot));
    }
  }

  if (preferredTime) {
    const preferred = parseDateTime(date, preferredTime);
    const available = !booked.has(preferred.toISOString()) && isBusinessHour(preferred);
    return {
      date,
      preferredTime,
      available,
      slots: available ? [preferredTime, ...slots.filter((s) => s !== preferredTime)] : slots,
    };
  }

  return { date, slots };
}

export async function bookAppointment(data: {
  name: string;
  reason: string;
  scheduledAt: string;
  phone: string;
  callId?: string;
}) {
  const scheduledAt = new Date(data.scheduledAt);
  if (!isBusinessHour(scheduledAt)) {
    throw new Error("Requested time is outside business hours (9 AM - 5 PM)");
  }

  const conflict = await prisma.appointment.findFirst({
    where: {
      scheduledAt,
      status: "confirmed",
    },
  });

  if (conflict) {
    throw new Error("That time slot is no longer available");
  }

  return prisma.appointment.create({
    data: {
      name: data.name,
      reason: data.reason,
      scheduledAt,
      phone: data.phone,
      callId: data.callId,
    },
  });
}
