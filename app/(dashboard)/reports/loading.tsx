export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-52 rounded-lg bg-white/8 animate-pulse" />
          <div className="h-4 w-36 rounded-lg bg-white/5 animate-pulse" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-white/5 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="glass-card p-4 h-24 animate-pulse bg-white/5" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5 h-64 animate-pulse bg-white/5" />
        <div className="glass-card p-5 h-64 animate-pulse bg-white/5" />
      </div>
      <div className="glass-card p-5 h-48 animate-pulse bg-white/5" />
    </div>
  );
}
