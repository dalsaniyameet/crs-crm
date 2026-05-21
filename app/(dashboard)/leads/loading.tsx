export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded-lg bg-white/8 animate-pulse" />
          <div className="h-4 w-32 rounded-lg bg-white/5 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-white/8 animate-pulse" />
        </div>
      </div>
      <div className="h-10 w-full max-w-sm rounded-lg bg-white/5 animate-pulse" />
      <div className="glass-card overflow-hidden">
        <div className="h-12 bg-white/5 animate-pulse border-b border-white/5" />
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/3">
            <div className="w-9 h-9 rounded-full bg-white/8 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
            </div>
            <div className="h-6 w-20 rounded-full bg-white/5 animate-pulse" />
            <div className="h-6 w-16 rounded-full bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
