export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="glass-card p-5">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-white/8 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-40 rounded-lg bg-white/8 animate-pulse" />
            <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
            <div className="h-4 w-24 rounded bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 gap-1">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="flex-1 h-9 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="glass-card p-4 h-24 animate-pulse bg-white/5" />
        ))}
      </div>
      <div className="glass-card p-5 h-48 animate-pulse bg-white/5" />
    </div>
  );
}
