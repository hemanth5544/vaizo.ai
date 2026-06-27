export type TranscriptLine = {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  at: string;
};

export function transcriptKey(role: string, text: string) {
  return `${role}:${text.trim()}`;
}

export function mergeTranscriptLine(
  prev: TranscriptLine[],
  line: Omit<TranscriptLine, "id"> & { id?: string },
): TranscriptLine[] {
  const key = transcriptKey(line.role, line.text);
  if (prev.some((entry) => transcriptKey(entry.role, entry.text) === key)) {
    return prev;
  }
  return [
    ...prev,
    {
      ...line,
      id: line.id ?? crypto.randomUUID(),
    },
  ];
}

export function mergeTranscriptLines(
  prev: TranscriptLine[],
  lines: Array<Omit<TranscriptLine, "id"> & { id?: string }>,
): TranscriptLine[] {
  return lines.reduce(mergeTranscriptLine, prev);
}

export function transcriptFromApiEvents(
  events: { type: string; payload: Record<string, unknown>; createdAt: string }[],
): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  for (const event of events) {
    const payload = event.payload;
    if (event.type !== "transcript" || !payload.text || !payload.role) continue;
    mergeTranscriptLine(lines, {
      id: `${event.createdAt}-${transcriptKey(String(payload.role), String(payload.text))}`,
      role: payload.role as TranscriptLine["role"],
      text: String(payload.text),
      at: event.createdAt,
    });
  }
  return lines;
}
