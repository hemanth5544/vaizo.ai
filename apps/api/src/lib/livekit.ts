import { RoomConfiguration } from "@livekit/protocol";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { MONITORING_TOPICS } from "@vaizo/types";

function livekitConfig() {
  return {
    url: process.env.LIVEKIT_URL ?? "",
    apiKey: process.env.LIVEKIT_API_KEY ?? "",
    apiSecret: process.env.LIVEKIT_API_SECRET ?? "",
  };
}

export function getLiveKitUrl() {
  const { url } = livekitConfig();
  if (!url) {
    throw new Error(
      "LIVEKIT_URL is not configured. Set it in the repo root .env file.",
    );
  }
  return url;
}

function getHttpUrl() {
  return getLiveKitUrl()
    .replace("wss://", "https://")
    .replace("ws://", "http://");
}

export function createRoomService() {
  const { apiKey, apiSecret } = livekitConfig();
  return new RoomServiceClient(getHttpUrl(), apiKey, apiSecret);
}

export async function createParticipantToken(options: {
  roomName: string;
  identity: string;
  name: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  metadata?: string;
  roomConfig?: { agents?: { agentName: string }[] };
}) {
  const { apiKey, apiSecret } = livekitConfig();
  const at = new AccessToken(apiKey, apiSecret, {
    identity: options.identity,
    name: options.name,
    metadata: options.metadata,
  });

  at.addGrant({
    roomJoin: true,
    room: options.roomName,
    canPublish: options.canPublish ?? true,
    canSubscribe: options.canSubscribe ?? true,
    canPublishData: true,
  });

  if (options.roomConfig?.agents?.length) {
    at.roomConfig = new RoomConfiguration({
      agents: options.roomConfig.agents.map((a) => ({
        agentName: a.agentName,
      })),
    });
  }

  return at.toJwt();
}

export async function sendControlToAgent(roomName: string, action: string) {
  const roomService = createRoomService();
  const participants = await roomService.listParticipants(roomName);
  const agent = participants.find(
    (p) =>
      p.identity.includes("agent") ||
      p.attributes?.["lk.agent.state"] !== undefined,
  );

  if (!agent) {
    throw new Error("Agent participant not found in room");
  }

  const payload = new TextEncoder().encode(JSON.stringify({ action }));
  await roomService.sendData(roomName, payload, 1, {
    destinationIdentities: [agent.identity],
    topic: MONITORING_TOPICS.CONTROL,
  });
}

export async function deleteRoom(roomName: string) {
  const roomService = createRoomService();
  try {
    await roomService.deleteRoom(roomName);
  } catch {
    // Room may already be deleted
  }
}
