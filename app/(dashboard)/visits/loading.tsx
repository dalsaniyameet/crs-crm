export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded-lg bg-white/8 animate-pulse" />
          <div className="h-4 w-48 rounded-lg bg-white/5 animate-pulse" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-white/8 animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="glass-card p-4 h-24 animate-pulse bg-white/5" />
        ))}
      </div>
      <div className="space-y-3">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="glass-card p-4 flex items-center gap-4">
            <div className="w-24 h-12 rounded-lg bg-white/8 animate-pulse flex-shrink-0" />
            <div className="w-px h-12 bg-white/10 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-32 rounded bg-white/5 animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
              <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
