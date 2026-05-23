"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const GREETINGS = [
  { range: [5,  12], emoji: "🌅", greeting: "Good Morning",   sub: "Let's make today count!" },
  { range: [12, 17], emoji: "☀️", greeting: "Good Afternoon", sub: "Keep pushing, you're doing great!" },
  { range: [17, 21], emoji: "🌆", greeting: "Good Evening",   sub: "How many leads did you close today?" },
  { range: [21, 24], emoji: "🌙", greeting: "Good Night",     sub: "Rest well, big day tomorrow!" },
  { range: [0,  5],  emoji: "🦉", greeting: "Working Late?",  sub: "Your dedication is inspiring! 💪" },
];

function getGreeting(h: number) {
  return GREETINGS.find(g => h >= g.range[0] && h < g.range[1]) ?? GREETINGS[0];
}

function Particle({ delay, x, size }: { delay: number; x: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: `${x}%`, bottom: -10, width: size, height: size, background: "rgba(234,179,8,0.25)" }}
      animate={{ y: [0, -800], opacity: [0, 0.7, 0] }}
      transition={{ duration: 5 + (x % 3), delay, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

interface Props { name: string; role: string; avatar?: string; onDone: () => void; }

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin", BROKER: "Broker",
  SALES_MANAGER: "Sales Manager", MARKETING: "Marketing",
};

export default function WelcomeSplash({ name, role, avatar, onDone }: Props) {
  const [visible, setVisible] = useState(true);
  const hour      = new Date().getHours();
  const g         = getGreeting(hour);
  const firstName = name.split(" ")[0] || name;

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(false), 3800);
    const t2 = setTimeout(() => onDone(), 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  const particles = Array.from({ length: 20 }, (_, i) => ({
    delay: i * 0.2, x: (i * 41 + 7) % 100, size: 3 + (i % 5) * 2,
  }));

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{ background: "linear-gradient(160deg, #04080f 0%, #0b1a2e 60%, #04080f 100%)" }}
        >
          {/* Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p, i) => <Particle key={i} {...p} />)}
          </div>

          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-[0.07] blur-[80px]"
              style={{ background: "radial-gradient(circle, #eab308, transparent 70%)" }} />
          </div>

          {/* Content — no card box, just centered content */}
          <div className="flex flex-col items-center text-center px-8 select-none">

            {/* Profile avatar — circular, no box */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.1 }}
              className="relative mb-6"
            >
              {/* Gold ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ padding: 3, background: "linear-gradient(135deg, #eab308, #facc15, #ca8a04)" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <div className="w-full h-full rounded-full" style={{ background: "#04080f" }} />
              </motion.div>

              <div className="relative w-24 h-24 rounded-full overflow-hidden"
                style={{ border: "3px solid transparent", background: "linear-gradient(#04080f, #04080f) padding-box, linear-gradient(135deg, #eab308, #facc15) border-box" }}>
                {avatar ? (
                  <Image src={avatar} alt={firstName} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #1e3a5f, #0f1f35)" }}>
                    {firstName[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Online dot */}
              <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#04080f]" />
            </motion.div>

            {/* Emoji */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.4, 1] }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-5xl mb-4"
            >
              {g.emoji}
            </motion.div>

            {/* Single-line greeting + name */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, type: "spring", stiffness: 200 }}
              className="text-4xl font-extrabold text-white mb-2 leading-tight"
            >
              {g.greeting},{" "}
              <span style={{
                background: "linear-gradient(135deg, #eab308, #facc15, #fde68a)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                {firstName}!
              </span>
            </motion.h1>

            {/* Role */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4"
              style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)", color: "#facc15" }}
            >
              {ROLE_LABEL[role] ?? role}
            </motion.div>

            {/* Sub message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75 }}
              className="text-base text-slate-400 mb-8"
            >
              {g.sub}
            </motion.p>

            {/* Company tag */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="flex items-center gap-2 text-xs text-slate-500"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              City Real Space CRM · Ahmedabad
            </motion.div>

            {/* Progress bar — bottom of screen */}
            <motion.div
              className="fixed bottom-0 left-0 h-[3px]"
              style={{ background: "linear-gradient(90deg, #eab308, #facc15)" }}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ delay: 0.5, duration: 3.3, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
