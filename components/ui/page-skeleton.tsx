function PageSkeleton({ rows = 5, cols = 1 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-52 rounded-lg bg-white/8 animate-pulse" />
          <div className="h-4 w-36 rounded-lg bg-white/5 animate-pulse" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-white/8 animate-pulse" />
      </div>
      <div className="h-10 w-full max-w-sm rounded-lg bg-white/5 animate-pulse" />
      <div className={`grid gap-4 ${cols > 1 ? `grid-cols-1 md:grid-cols-${cols}` : ""}`}>
        {Array(rows).fill(0).map((_, i) => (
          <div key={i} className="glass-card p-4 h-20 animate-pulse bg-white/5" />
        ))}
      </div>
    </div>
  );
}

export default PageSkeleton;
