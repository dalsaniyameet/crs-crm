export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-52 rounded-lg bg-white/8 animate-pulse" />
          <div className="h-4 w-36 rounded-lg bg-white/5 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-white/8 animate-pulse" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="glass-card overflow-hidden">
            <div className="h-48 bg-white/5 animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-4 w-3/4 rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse" />
              <div className="grid grid-cols-3 gap-2">
                {Array(3).fill(0).map((_, j) => (
                  <div key={j} className="h-12 rounded-lg bg-white/5 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
