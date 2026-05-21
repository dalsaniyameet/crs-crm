export default function Loading() {
  return (
    <div className="p-4 md:p-6 h-[calc(100vh-56px)] flex flex-col gap-4">
      <div className="h-8 w-36 rounded-lg bg-white/8 animate-pulse flex-shrink-0" />
      <div className="flex-1 glass-card overflow-hidden flex">
        <div className="w-56 border-r border-white/10 p-3 space-y-2 hidden lg:block">
          <div className="h-4 w-24 rounded bg-white/5 animate-pulse mb-3" />
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4 space-y-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
                <div className="w-8 h-8 rounded-full bg-white/8 animate-pulse flex-shrink-0" />
                <div className={`h-16 rounded-2xl bg-white/5 animate-pulse ${i % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-white/5">
            <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
