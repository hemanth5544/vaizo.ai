import { fileURLToPath } from "node:url";
import "./env.js";
import {
  cli,
  defineAgent,
  inference,
  voice,
  type JobContext,
} from "@livekit/agents";
import { WorkerOptions } from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import * as openai from "@livekit/agents-plugin-openai";
import * as silero from "@livekit/agents-plugin-silero";
import { RoomEvent, type DataPacketKind, type RemoteParticipant } from "@livekit/rtc-node";
import { MONITORING_TOPICS } from "@vaizo/types";
import {
  apiFetch,
  saveCallSummary,
  updateCallStatus,
} from "./api-client.js";
import {
  publishAgentState,
  publishTranscript,
} from "./monitoring.js";
import { createBookingTools, createTransferTool } from "./tools.js";

const { AgentSessionEventTypes, zipFunctionCallsAndOutputs } = voice;

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const LIVEKIT_LLM_MODEL = process.env.LIVEKIT_LLM_MODEL ?? "openai/gpt-4.1-mini";

function createLlm() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (process.env.OPENAI_LLM_DIRECT === "true" && apiKey) {
    return new openai.LLM({
      model: OPENAI_MODEL,
      apiKey,
    });
  }
  return new inference.LLM({ model: LIVEKIT_LLM_MODEL });
}

async function resolveCallId(roomName: string) {
  const calls = await apiFetch<{ calls: { id: string; roomName: string }[] }>(
    "/calls",
  );
  const session = calls.calls.find((c) => c.roomName === roomName);
  return session?.id ?? roomName;
}

async function generateSummary(messages: { role: string; content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || messages.length === 0) {
    return {
      summaryText: "Call ended.",
      intents: [] as string[],
    };
  }

  const transcript = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Summarize this voice call in 3-5 sentences. On the last line write INTENTS: followed by a JSON array of detected intents.",
        },
        { role: "user", content: transcript },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    return { summaryText: "Call ended. Summary generation failed.", intents: [] };
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const content = data.choices[0]?.message?.content ?? "";
  const intentsMatch = content.match(/INTENTS:\s*(\[.*\])/);
  let intents: string[] = [];
  if (intentsMatch) {
    try {
      intents = JSON.parse(intentsMatch[1]) as string[];
    } catch {
      intents = [];
    }
  }

  return {
    summaryText: content.replace(/\nINTENTS:.*$/, "").trim(),
    intents,
  };
}

export default defineAgent({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    const room = ctx.room;
    const roomName = room.name ?? "";
    const callId = await resolveCallId(roomName);

    let takeoverActive = false;
    const transcriptLog: { role: string; content: string }[] = [];

    const vad = ctx.proc.userData.vad as silero.VAD;

    const stt = process.env.DEEPGRAM_API_KEY
      ? new deepgram.STT({ model: "nova-3", language: "en" })
      : new inference.STT({ model: "deepgram/nova-3", language: "en" });

    const tts = process.env.ELEVENLABS_API_KEY
      ? new elevenlabs.TTS()
      : new inference.TTS({ model: "cartesia/sonic-3" });

    const session = new voice.AgentSession({
      vad,
      stt,
      llm: createLlm(),
      tts,
    });

    const bookingTools = createBookingTools({ callId, room });
    const transferTool = createTransferTool({ callId, room });

    const agent = new voice.Agent({
      instructions: `You are Agent A, a friendly voice assistant for Vaizo Medical Office.
Help callers book appointments by collecting: full name, reason for visit, preferred date and time, and contact phone number.
Before confirming, always check availability with checkAvailability, then book with bookAppointment.
Read the confirmation back clearly including the confirmation ID.
If the caller wants a human, has billing questions, complaints, or says "talk to a person", use requestHumanTransfer.
Be concise, warm, and conversational. Confirm details before booking.`,
      tools: {
        checkAvailability: bookingTools.checkAvailability,
        bookAppointment: bookingTools.bookAppointment,
        requestHumanTransfer: transferTool,
      },
    });

    room.on(
      RoomEvent.DataReceived,
      (
        payload: Uint8Array,
        _participant?: RemoteParticipant,
        _kind?: DataPacketKind,
        topic?: string,
      ) => {
        if (topic !== MONITORING_TOPICS.CONTROL) return;
        try {
          const message = JSON.parse(new TextDecoder().decode(payload)) as {
            action?: string;
          };
          if (message.action === "takeover") {
            takeoverActive = true;
            session.input.setAudioEnabled(false);
            session.output.setAudioEnabled(false);
            void publishAgentState(room, callId, "paused", undefined, "watcher_takeover");
          }
          if (message.action === "end") {
            void (async () => {
              const { summaryText, intents } = await generateSummary(transcriptLog);
              await saveCallSummary(callId, summaryText, intents);
              await updateCallStatus(callId, "ended");
            })();
          }
        } catch {
          // ignore malformed control messages
        }
      },
    );

    session.on(AgentSessionEventTypes.UserInputTranscribed, (ev) => {
      if (!ev.isFinal || !ev.transcript) return;
      transcriptLog.push({ role: "user", content: ev.transcript });
      void publishTranscript(room, callId, "user", ev.transcript);
      if (!takeoverActive) {
        void publishAgentState(room, callId, "listening");
      }
    });

    session.on(AgentSessionEventTypes.AgentStateChanged, (ev) => {
      if (takeoverActive) return;
      const stateMap: Record<string, "listening" | "thinking" | "speaking"> = {
        listening: "listening",
        thinking: "thinking",
        speaking: "speaking",
        idle: "listening",
        initializing: "thinking",
      };
      const mapped = stateMap[ev.newState];
      if (mapped) {
        void publishAgentState(room, callId, mapped);
      }
    });

    session.on(AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      const item = ev.item;
      if (!("textContent" in item) || item.role !== "assistant") return;
      const text = item.textContent;
      if (!text) return;
      transcriptLog.push({ role: "assistant", content: text });
      void publishTranscript(room, callId, "agent", text);
    });

    session.on(AgentSessionEventTypes.FunctionToolsExecuted, (ev) => {
      for (const [call, output] of zipFunctionCallsAndOutputs(ev)) {
        void publishAgentState(
          room,
          callId,
          "thinking",
          call.name,
          output?.output?.slice(0, 80) ?? "running tool",
        );
      }
    });

    session.on(AgentSessionEventTypes.Error, (ev) => {
      const message =
        ev.error instanceof Error ? ev.error.message : String(ev.error);
      console.error("[vaizo-agent] session error:", message, ev.error);
      void publishAgentState(room, callId, "listening", undefined, `error: ${message}`);
    });

    ctx.addShutdownCallback(async () => {
      if (transcriptLog.length > 0) {
        const { summaryText, intents } = await generateSummary(transcriptLog);
        try {
          await saveCallSummary(callId, summaryText, intents);
        } catch {
          // may already be saved
        }
      }
      try {
        await updateCallStatus(callId, "ended");
      } catch {
        // ignore
      }
    });

    await session.start({ agent, room: ctx.room });
    await publishAgentState(room, callId, "listening", "greeting");

    await session.generateReply({
      instructions:
        "Greet the caller warmly. Introduce yourself as Agent A from Vaizo Medical Office and ask how you can help today.",
    });
  },
});

cli.runApp(
  new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: process.env.LIVEKIT_AGENT_NAME ?? "vaizo-voice-agent",
  }),
);
