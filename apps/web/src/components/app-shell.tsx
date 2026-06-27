import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mesh-bg flex min-h-screen">
      <AppSidebar />
      <main className="min-h-screen flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
