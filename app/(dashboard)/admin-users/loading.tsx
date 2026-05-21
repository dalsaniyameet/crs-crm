export default function Loading() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-44 rounded-lg bg-white/8 animate-pulse" />
        <div className="h-4 w-36 rounded-lg bg-white/5 animate-pulse" />
      </div>
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="h-12 bg-white/5 animate-pulse border-b border-white/10" />
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
            <div className="flex-1 h-4 rounded bg-white/8 animate-pulse" />
            <div className="w-40 h-4 rounded bg-white/5 animate-pulse" />
            <div className="w-24 h-6 rounded-full bg-white/5 animate-pulse" />
            <div className="w-28 h-8 rounded-lg bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
