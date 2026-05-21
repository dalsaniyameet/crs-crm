export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-white/8 animate-pulse" />
          <div className="h-4 w-32 rounded-lg bg-white/5 animate-pulse" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-white/8 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="glass-card p-4 h-24 animate-pulse bg-white/5" />
        ))}
      </div>
      <div className="glass-card overflow-hidden">
        <div className="h-12 bg-white/5 animate-pulse border-b border-white/5" />
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-white/3">
            <div className="w-10 h-10 rounded-full bg-white/8 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-20 rounded-lg bg-white/5 animate-pulse" />
              <div className="h-8 w-20 rounded-lg bg-white/5 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
