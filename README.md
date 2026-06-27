# Vaizo Voice Agent

Conversational voice agent with LiveKit, appointment booking, live monitoring, watcher take-over, and Twilio warm transfer.

## Stack

| Layer | Tech |
|-------|------|
| Monorepo | Turborepo + pnpm |
| Frontend | Next.js 15, shadcn-style UI, `@livekit/components-react` |
| API | Hono (Node.js) — tokens, calls, appointments |
| Agent worker | `@livekit/agents` (Node.js) |
| Database | **Native local PostgreSQL** (no Docker required) |

## Prerequisites

1. **Node.js** 20+
2. **pnpm** 10+
3. **PostgreSQL** running locally with a database created (e.g. `vaizo` or `vaizo_ai`)
4. **LiveKit Cloud** project ([livekit.io](https://livekit.io))
5. **OpenAI API key** (conversation + summaries)
6. Optional: **Deepgram** / **ElevenLabs** keys (falls back to LiveKit Inference if omitted)
7. Optional: **Twilio SIP trunk** for warm transfer to a human phone

## Environment

Copy `.env.example` to `.env` at the repo root:

```bash
cp .env.example .env
```

Key variables:

```bash
# LiveKit Cloud
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# AI
OPENAI_API_KEY=
DEEPGRAM_API_KEY=          # optional — uses LiveKit Inference if empty
ELEVENLABS_API_KEY=        # optional — uses LiveKit Inference if empty

# Warm transfer (optional)
LIVEKIT_SIP_OUTBOUND_TRUNK_ID=
SUPERVISOR_PHONE_NUMBER=+1...

# Local PostgreSQL (your native install)
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/your_database

API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_AGENT_NAME=vaizo-voice-agent
```

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Push database schema to your local Postgres
pnpm db:setup

# 3. Configure agent dispatch in LiveKit Cloud
#    Agent name must match LIVEKIT_AGENT_NAME (default: vaizo-voice-agent)
```

## Run

```bash
pnpm dev
```

| Service | URL |
|---------|-----|
| Web (caller + monitor) | http://localhost:3000 |
| API | http://localhost:3001 |
| Agent worker | registers with LiveKit Cloud |

Or run individually:

```bash
pnpm --filter @vaizo/api dev
pnpm --filter @vaizo/agent dev
pnpm --filter @vaizo/web dev
```

## Flows

### 1. Start a call (browser)

```mermaid
sequenceDiagram
  participant Caller as Browser Caller
  participant API as apps/api
  participant LK as LiveKit Cloud
  participant Agent as apps/agent

  Caller->>API: POST /calls
  API->>API: Create call_sessions row
  API-->>Caller: room token + livekit URL
  Caller->>LK: WebRTC join room
  LK->>Agent: Dispatch vaizo-voice-agent
  Agent->>Caller: Voice greeting
```

### 2. Appointment booking

Agent tools call the API:

- `checkAvailability(date, time?)` — 30-min slots, 9 AM–5 PM
- `bookAppointment(name, reason, scheduledAt, phone)` — persists to `appointments`

### 3. Live monitoring

Open **Monitor** → select an active call (`/monitor/[callId]`).

The dashboard shows:

- Live transcript (`vaizo.call-events` stream + DB events)
- Agent state (`agent.state`, `agent.intent`, `agent.action` attributes)
- Collected booking fields
- Call status (`connected` → `transferring` → `takeover` → `ended`)

### 4. Watcher take-over

1. Watcher clicks **Take Over** on the monitor dashboard
2. API sends a control message to the agent (`vaizo.control` topic)
3. Agent pauses audio I/O; watcher gets a publish-enabled token
4. Watcher speaks directly to the caller

### 5. Warm transfer (Twilio)

When the caller asks for a human, Agent A uses `requestHumanTransfer`:

1. Caller placed on hold
2. LiveKit dials supervisor via SIP outbound trunk (Twilio)
3. Briefing agent summarizes the call
4. **Accept** → human joins caller's room; AI exits
5. **Decline** → AI returns and apologizes

Configure per [LiveKit Twilio SIP trunk guide](https://docs.livekit.io/sip/quickstarts/configuring-twilio-trunk/).

### 6. Post-call summary

On call end, the agent sends the transcript to OpenAI and stores a summary in `call_summaries`. The monitor view shows it when `status=ended`.

## Project structure

```
vaizo.ai/
├── apps/
│   ├── web/      # Next.js — call UI + monitor dashboard
│   ├── api/      # Hono REST API
│   └── agent/    # LiveKit Agents worker
├── packages/
│   ├── database/ # Prisma + PostgreSQL
│   ├── types/    # Shared Zod schemas
│   └── config/   # TS config
└── .env          # Root env (loaded by api + agent)
```

## Demo recording checklist (Loom)

- [ ] Booking conversation with Agent A (name, reason, date/time, phone, confirmation)
- [ ] Monitor UI updating in real time (transcript, state, booking fields)
- [ ] Watcher taking over an ongoing call
- [ ] Warm transfer: summary to human, accept path
- [ ] Warm transfer: decline path (“team unavailable”)
- [ ] Post-call summary on ended call view

## API reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/calls` | Create call + caller token |
| GET | `/calls` | List calls |
| GET | `/calls/:id` | Call detail, events, summary |
| POST | `/calls/:id/watcher-token` | Monitor token |
| POST | `/calls/:id/takeover` | Pause agent + watcher publish token |
| POST | `/calls/:id/end` | End call + summary trigger |
| GET | `/appointments/availability` | Check slots |
| POST | `/appointments` | Book appointment |

## Troubleshooting

- **Agent not joining**: Verify LiveKit Cloud agent dispatch for `vaizo-voice-agent` and that `LIVEKIT_*` keys match your project.
- **No STT/TTS**: Add provider keys or rely on LiveKit Inference (requires LiveKit Cloud credentials).
- **DB errors**: Confirm `DATABASE_URL` points to your local Postgres and run `pnpm db:push`.
- **Warm transfer**: Requires `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` and `SUPERVISOR_PHONE_NUMBER`.
