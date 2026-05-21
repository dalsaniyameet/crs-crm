export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="space-y-2">
        <div className="h-7 w-32 rounded-lg bg-white/8 animate-pulse" />
        <div className="h-4 w-52 rounded-lg bg-white/5 animate-pulse" />
      </div>
      {Array(4).fill(0).map((_, i) => (
        <div key={i} className="glass-card p-5 h-40 animate-pulse bg-white/5" />
      ))}
    </div>
  );
}
