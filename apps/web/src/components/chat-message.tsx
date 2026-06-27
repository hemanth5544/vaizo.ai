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
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {line.text}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <Avatar className={cn("h-8 w-8", isUser ? "bg-accent/20" : "bg-primary/20")}>
        <AvatarFallback
          className={cn(
            isUser ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary",
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{isUser ? "Caller" : "Agent A"}</span>
          <span>{formatTime(line.at)}</span>
        </div>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
            isUser
              ? "rounded-tr-md bg-accent text-accent-foreground"
              : "rounded-tl-md border border-border bg-secondary text-secondary-foreground",
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
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <div className="rounded-full bg-muted p-3">
        <Bot className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Waiting for conversation</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Messages appear here in real time as the caller and agent speak.
      </p>
    </div>
  );
}
