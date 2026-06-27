export function GradientOrb({ className }: { className?: string }) {
  return (
    <div
      className={`relative mx-auto h-28 w-28 ${className ?? ""}`}
      aria-hidden
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-200 via-violet-200 to-sky-200 opacity-80 blur-2xl" />
      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-indigo-400/30 via-violet-300/40 to-blue-300/30 backdrop-blur-sm" />
      <div className="absolute inset-4 rounded-full border border-white/60 bg-white/40 shadow-inner" />
    </div>
  );
}
