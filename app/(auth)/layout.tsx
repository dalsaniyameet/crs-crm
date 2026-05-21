export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-96 h-96 rounded-full bg-estate-600 opacity-10 blur-3xl top-[-10%] left-[-5%]" />
        <div className="absolute w-64 h-64 rounded-full bg-gold-500 opacity-10 blur-3xl bottom-[10%] right-[-5%]" />
      </div>
      {children}
    </div>
  );
}
