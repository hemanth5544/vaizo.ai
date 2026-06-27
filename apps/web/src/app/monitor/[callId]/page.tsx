import { MonitorDashboard } from "@/components/monitor-dashboard";

export default async function MonitorCallPage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const { callId } = await params;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Session</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Call <span className="text-gradient">monitor</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live chat, agent activity, and takeover controls.
        </p>
      </div>
      <MonitorDashboard callId={callId} />
    </div>
  );
}
