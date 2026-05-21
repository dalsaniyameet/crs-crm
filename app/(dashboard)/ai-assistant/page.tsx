"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Sparkles, Copy, RefreshCw, Building2, Users, FileText, MessageSquare, TrendingUp, Zap } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const quickPrompts = [
  { icon: MessageSquare, label: "Follow-up message", prompt: "Write a WhatsApp follow-up message for a lead interested in office space in Prahlad Nagar" },
  { icon: Building2, label: "Property description", prompt: "Write a compelling description for a 2200 sqft premium office space in Prahlad Nagar, Ahmedabad at ₹75,000/month" },
  { icon: TrendingUp, label: "Deal probability", prompt: "Analyze this deal: Client wants 3BHK in Satellite under 1.2Cr, visited 2 properties, budget confirmed. What's the deal probability?" },
  { icon: Users, label: "Client reply draft", prompt: "Draft a professional reply to a client asking about the difference between carpet area and super built-up area" },
  { icon: FileText, label: "Social media post", prompt: "Create an Instagram post for a luxury 4BHK villa in Bopal, Ahmedabad at ₹2.8Cr" },
  { icon: Zap, label: "Market insight", prompt: "What are the current commercial real estate trends in Ahmedabad's SG Highway corridor?" },
];

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: `👋 Hello! I'm your **City Real Space AI Assistant**.

I can help you with:
• 📝 Draft client follow-up messages & replies
• 🏠 Generate property descriptions
• 📊 Analyze deal probability & lead scores
• 📱 Create WhatsApp & social media content
• 💡 Provide Ahmedabad real estate market insights
• 🔍 Suggest best properties for leads

What would you like help with today?`,
    timestamp: new Date(),
  },
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          context: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "I apologize, I couldn't process that request.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      // Fallback demo response
      const demoResponses: Record<string, string> = {
        "follow-up": `Here's a WhatsApp follow-up message:\n\n*Hi [Name]! 👋*\n\nHope you're doing well! This is [Broker] from *City Real Space*, Ahmedabad.\n\nWe have some exciting new office spaces in Prahlad Nagar that match your requirements perfectly. 🏢\n\nWould you like to schedule a quick visit this week? We have slots available on Wednesday and Friday.\n\nReply YES to confirm or call us anytime! 📞`,
        "description": `**Premium Office Space - Prahlad Nagar, Ahmedabad**\n\nElevate your business presence with this exceptional 2,200 sq.ft. office space in the heart of Prahlad Nagar. Designed for modern enterprises, this premium workspace offers an ideal blend of functionality and sophistication.\n\nKey Highlights:\n• Carpet Area: 1,800 sq.ft. | Super Built-up: 2,200 sq.ft.\n• 5th Floor with panoramic city views\n• Fully air-conditioned with 24/7 power backup\n• Dedicated parking for 4 vehicles\n• High-speed fiber internet ready\n\nPriced at ₹75,000/month, this is an unmatched opportunity for businesses seeking a prestigious address in Ahmedabad's prime commercial hub.`,
      };

      const key = content.toLowerCase().includes("follow") ? "follow-up" : "description";
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: demoResponses[key] || `I understand you're asking about: "${content}"\n\nAs your City Real Space AI assistant, I can help with property descriptions, follow-up messages, deal analysis, and market insights for Ahmedabad real estate. Please configure your OpenAI API key to enable full AI capabilities.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const formatMessage = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="flex flex-col h-full p-3 md:p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center">
            <Bot className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-white">AI Assistant</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="pulse-dot green" />
              <span className="ml-2">GPT-4o · City Real Space</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400 text-xs">
          <Sparkles className="w-3 h-3" /> AI Active
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Quick Prompts Sidebar — desktop only */}
        <div className="hidden lg:flex flex-col gap-2 w-56 flex-shrink-0">
          <p className="text-xs text-muted-foreground font-medium px-1">Quick Actions</p>
          {quickPrompts.map((qp, i) => (
            <motion.button
              key={qp.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => sendMessage(qp.prompt)}
              className="flex items-center gap-2 p-3 rounded-xl bg-white/3 border border-white/5 hover:bg-white/8 hover:border-white/15 transition-all text-left group"
            >
              <qp.icon className="w-4 h-4 text-gold-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-xs text-muted-foreground group-hover:text-white transition-colors">{qp.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col glass-card overflow-hidden min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === "assistant"
                      ? "bg-gradient-to-br from-gold-500 to-gold-700"
                      : "bg-gradient-to-br from-estate-600 to-estate-400"
                  }`}>
                    {msg.role === "assistant" ? <Bot className="w-4 h-4 text-white" /> : <span className="text-white text-xs font-bold">U</span>}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[75%] group ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "assistant"
                        ? "bg-white/5 border border-white/10 text-foreground rounded-tl-sm"
                        : "bg-estate-600/30 border border-estate-500/30 text-white rounded-tr-sm"
                    }`}>
                      <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                    </div>

                    <div className={`flex items-center gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <span className="text-xs text-muted-foreground">
                        {msg.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {msg.role === "assistant" && (
                        <button
                          onClick={() => copyMessage(msg.content)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading */}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/5 border border-white/10">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        className="w-1.5 h-1.5 rounded-full bg-gold-400"
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  placeholder="Ask AI to draft a message, describe a property, analyze a deal..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold-500/50 resize-none transition-all placeholder:text-muted-foreground"
                />
              </div>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center text-white hover:from-gold-400 hover:to-gold-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-neon-gold flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
