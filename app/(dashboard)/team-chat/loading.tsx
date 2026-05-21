export default function Loading() {
  return (
    <div className="p-4 md:p-6 h-[calc(100vh-56px)] flex flex-col gap-4">
      <div className="h-8 w-36 rounded-lg bg-white/8 animate-pulse flex-shrink-0" />
      <div className="flex-1 glass-card overflow-hidden flex flex-col">
        <div className="h-12 border-b border-white/10 flex-shrink-0 flex">
          <div className="flex-1 h-full bg-white/5 animate-pulse" />
          <div className="flex-1 h-full bg-white/3 animate-pulse" />
        </div>
        <div className="flex-1 divide-y divide-white/5">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="w-10 h-10 rounded-full bg-white/8 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-28 rounded bg-white/8 animate-pulse" />
                <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
