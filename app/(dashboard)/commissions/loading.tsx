export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded-lg bg-white/8 animate-pulse" />
          <div className="h-4 w-32 rounded-lg bg-white/5 animate-pulse" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-white/8 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="glass-card p-4 h-24 animate-pulse bg-white/5" />
        ))}
      </div>
      <div className="glass-card overflow-hidden">
        <div className="h-12 bg-white/5 animate-pulse border-b border-white/5" />
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/3">
            <div className="flex-1 h-4 rounded bg-white/8 animate-pulse" />
            <div className="w-24 h-4 rounded bg-white/5 animate-pulse" />
            <div className="w-16 h-4 rounded bg-white/5 animate-pulse" />
            <div className="w-20 h-6 rounded-full bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
