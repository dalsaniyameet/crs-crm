export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-white/8 animate-pulse" />
          <div className="h-4 w-48 rounded-lg bg-white/5 animate-pulse" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-white/8 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="glass-card p-4 h-24 animate-pulse bg-white/5" />
        ))}
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array(7).fill(0).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-56 space-y-3">
            <div className="h-14 rounded-xl bg-white/8 animate-pulse" />
            {Array(2).fill(0).map((_, j) => (
              <div key={j} className="h-28 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
