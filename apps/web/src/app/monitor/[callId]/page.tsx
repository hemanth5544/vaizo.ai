import { MonitorDashboard } from "@/components/monitor-dashboard";

export default async function MonitorCallPage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const { callId } = await params;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Call Monitor</h1>
        <p className="mt-2 text-muted-foreground">
          Interactive live chat, agent activity, and takeover controls.
        </p>
      </div>
      <MonitorDashboard callId={callId} />
    </div>
  );
}
