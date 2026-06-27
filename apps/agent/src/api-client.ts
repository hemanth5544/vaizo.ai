import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${err}`);
  }

  return res.json() as Promise<T>;
}

export async function logCallEvent(
  callId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  try {
    await apiFetch(`/calls/${callId}/events`, {
      method: "POST",
      body: JSON.stringify({ type, payload }),
    });
  } catch (error) {
    console.error("Failed to log call event:", error);
  }
}

export async function updateCallStatus(
  callId: string,
  status: "connected" | "transferring" | "takeover" | "ended",
) {
  await apiFetch(`/calls/${callId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function saveCallSummary(
  callId: string,
  summaryText: string,
  intents: string[],
  bookingId?: string,
) {
  await apiFetch(`/calls/${callId}/summary`, {
    method: "POST",
    body: JSON.stringify({ summaryText, intents, bookingId }),
  });
}
