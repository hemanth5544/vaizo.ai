import { CallerPanel } from "@/components/caller-panel";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Voice Agent</h1>
        <p className="mt-2 text-muted-foreground">
          Talk to Agent A to schedule appointments or escalate to a human agent.
        </p>
      </div>
      <CallerPanel />
    </div>
  );
}
