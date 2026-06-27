import { CallerPanel } from "@/components/caller-panel";
import { GradientOrb } from "@/components/gradient-orb";

export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-8">
      <div className="mb-8 text-center">
        <GradientOrb className="mb-6" />
        <p className="text-sm font-medium text-muted-foreground">Vaizo Medical Office</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
          How can we <span className="text-gradient">assist</span> you today?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          Start a voice call with Agent A to book appointments or request a human transfer.
        </p>
      </div>
      <CallerPanel />
    </div>
  );
}
