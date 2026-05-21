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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="glass-card p-4 h-40 animate-pulse bg-white/5" />
        ))}
      </div>
    </div>
  );
}
