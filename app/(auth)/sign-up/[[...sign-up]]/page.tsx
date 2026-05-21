import Image from "next/image";
import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-96 h-96 rounded-full bg-estate-600 opacity-10 blur-3xl top-[-10%] left-[-5%]" />
        <div className="absolute w-64 h-64 rounded-full bg-gold-500 opacity-10 blur-3xl bottom-[10%] right-[-5%]" />
      </div>
      <div className="w-full max-w-sm relative z-10 text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white shadow-neon border-2 border-estate-500/30">
            <Image src="/logo.jpeg" alt="City Real Space" fill className="object-contain p-1" />
          </div>
        </div>
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white mb-2">Registration Restricted</h1>
          <p className="text-muted-foreground text-sm">
            Self-registration is disabled. Only admin can add employees to City Real Space CRM.
          </p>
        </div>
        <div className="p-4 rounded-xl border border-gold-500/20 bg-gold-500/5 text-sm text-gold-400">
          Contact your admin to get access.
        </div>
        <Link href="/sign-in"
          className="btn-primary inline-flex items-center gap-2 text-sm px-6 py-3 rounded-xl">
          ← Back to Sign In
        </Link>
      </div>
    </div>
  );
}
