"use client";

import { Bot, User } from "lucide-react";
import type { TranscriptLine } from "@/lib/transcript";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ChatMessage({ line }: { line: TranscriptLine }) {
  const isUser = line.role === "user";
  const isSystem = line.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
          {line.text}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <Avatar className="h-8 w-8 border border-border bg-white shadow-sm">
        <AvatarFallback
          className={cn(
            "bg-white text-xs",
            isUser ? "text-indigo-600" : "text-violet-600",
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
          <span className="font-medium">{isUser ? "Caller" : "Agent A"}</span>
          <span>{formatTime(line.at)}</span>
        </div>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-md bg-primary text-primary-foreground shadow-sm"
              : "rounded-tl-md border border-border bg-white text-foreground shadow-sm",
          )}
        >
          {line.text}
        </div>
      </div>
    </div>
  );
}

export function ChatEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <Bot className="h-7 w-7 text-primary/70" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No messages yet</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          The live conversation will appear here as the caller and agent speak.
        </p>
      </div>
    </div>
  );
}
