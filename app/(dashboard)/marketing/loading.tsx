export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-36 rounded-lg bg-white/8 animate-pulse" />
        <div className="h-4 w-52 rounded-lg bg-white/5 animate-pulse" />
      </div>
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="h-8 w-32 rounded-lg bg-white/8 animate-pulse" />
        ))}
      </div>
      <div className="glass-card p-5 h-48 animate-pulse bg-white/5" />
      <div className="glass-card overflow-hidden">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-white/5">
            <div className="w-9 h-9 rounded-full bg-white/8 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
            </div>
            <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
