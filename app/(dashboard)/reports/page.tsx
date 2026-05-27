"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { TrendingUp, Users, Building2, DollarSign, Download } from "lucide-react";

const COLORS = ["#0ea5e9","#6366f1","#f59e0b","#f97316","#10b981","#ec4899","#a855f7","#14b8a6","#f43f5e","#84cc16"];

const fmtMoney = (n: number) =>
  n >= 10000000 ? `₹${(n/10000000).toFixed(1)}Cr`
  : n >= 100000 ? `₹${(n/100000).toFixed(1)}L`
  : n > 0 ? `₹${(n/1000).toFixed(0)}K` : "₹0";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs">
      <p className="text-white font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const PERIODS = [
  { label: "This Week",    value: "week" },
  { label: "This Month",   value: "month" },
  { label: "This Quarter", value: "quarter" },
  { label: "This Year",    value: "year" },
];

export default function ReportsPage() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState("month");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setData({}); setLoading(false); });
  }, [period]);

  if (loading) return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">City Real Space · Live Data</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="stat-card h-24 animate-pulse bg-white/5" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1,2].map(i => <div key={i} className="glass-card p-5 h-64 animate-pulse bg-white/5" />)}
      </div>
    </div>
  );

  const overview        = data?.overview ?? {};
  const brokerPerf      = data?.brokerPerformance ?? [];
  const leadsBySource   = data?.leadsBySource ?? [];
  const dealsByStage    = data?.dealsByStage ?? [];

  // Conversion funnel from dealsByStage
  const stageOrder = ["ENQUIRY","SITE_VISIT","NEGOTIATION","TOKEN","AGREEMENT","CLOSED"];
  const stageLabels: Record<string,string> = {
    ENQUIRY:"Enquiry", SITE_VISIT:"Site Visit", NEGOTIATION:"Negotiation",
    TOKEN:"Token", AGREEMENT:"Agreement", CLOSED:"Closed"
  };
  const funnelData = stageOrder.map(s => ({
    stage: stageLabels[s] ?? s,
    count: dealsByStage.find((d: any) => d.stage === s)?._count?.id ?? 0,
  })).filter(f => f.count > 0);

  const sourceChartData = leadsBySource.map((s: any, i: number) => ({
    name:  s.source.replace(/_/g," "),
    value: s._count.id,
    color: COLORS[i % COLORS.length],
  }));

  const kpis = [
    { label: "Total Revenue",      value: fmtMoney(overview.totalRevenue ?? 0),    change: "", icon: DollarSign, color: "from-gold-600 to-gold-400" },
    { label: "Commission Earned",  value: fmtMoney(overview.totalCommission ?? 0), change: "", icon: TrendingUp,  color: "from-emerald-600 to-emerald-400" },
    { label: "Deals Closed",       value: overview.dealsClosedCount ?? 0,           change: "", icon: Building2,  color: "from-estate-600 to-estate-400" },
    { label: "Total Leads",        value: overview.totalLeads ?? 0,                 change: "", icon: Users,      color: "from-purple-600 to-purple-400" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">City Real Space · Live Data</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period filter */}
          <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  period === p.value
                    ? "bg-estate-600/40 border border-estate-500/50 text-estate-300"
                    : "text-muted-foreground hover:text-white"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export PDF</span><span className="sm:hidden">PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }} className="stat-card">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center mb-3`}>
              <kpi.icon className="w-4 h-4 text-white" />
            </div>
            <div className="text-2xl font-bold text-white">{kpi.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Lead Sources + Deals by Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lead Sources */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card p-5">
          <style>{`
            @keyframes crs-outer { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
            @keyframes crs-inner { 0%{transform:rotate(0deg)} 100%{transform:rotate(-360deg)} }
            .crs-outer-ring { animation: crs-outer 4s linear infinite; transform-box: fill-box; transform-origin: center; }
            .crs-inner-ring { animation: crs-inner 7s linear infinite; transform-box: fill-box; transform-origin: center; }
          `}</style>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Lead Sources</h3>
            <span className="text-xs text-muted-foreground">{sourceChartData.reduce((s: number, d: any) => s + d.value, 0)} total leads</span>
          </div>
          {sourceChartData.length > 0 ? (
            <div className="flex gap-6 items-center">
              {/* Pure SVG Donut + Spinning Rings */}
              <div className="relative flex-shrink-0" style={{ width: 170, height: 170 }}>
                <svg viewBox="0 0 170 170" width="170" height="170" style={{ position: "absolute", top: 0, left: 0 }}>
                  {/* Outer spinning ring */}
                  <g className="crs-outer-ring">
                    <circle cx="85" cy="85" r="82" fill="none" stroke="#0ea5e9" strokeWidth="3"
                      strokeDasharray="55 25" strokeLinecap="round" opacity="0.7" />
                    <circle cx="85" cy="85" r="82" fill="none" stroke="#f59e0b" strokeWidth="3"
                      strokeDasharray="20 60" strokeDashoffset="-90" strokeLinecap="round" opacity="0.5" />
                  </g>
                  {/* Inner counter-spin ring */}
                  <g className="crs-inner-ring">
                    <circle cx="85" cy="85" r="38" fill="none" stroke="#6366f1" strokeWidth="2"
                      strokeDasharray="30 209" strokeLinecap="round" opacity="0.5" />
                    <circle cx="85" cy="85" r="38" fill="none" stroke="#10b981" strokeWidth="2"
                      strokeDasharray="15 224" strokeDashoffset="-70" strokeLinecap="round" opacity="0.4" />
                  </g>
                  {/* SVG Donut segments */}
                  {(() => {
                    const total = sourceChartData.reduce((a: number, d: any) => a + d.value, 0);
                    const cx = 85, cy = 85, r = 60, ir = 42;
                    let angle = -90;
                    return sourceChartData.map((s: any, i: number) => {
                      const pct   = s.value / total;
                      const sweep = pct * 360;
                      const a1    = (angle * Math.PI) / 180;
                      const a2    = ((angle + sweep) * Math.PI) / 180;
                      const x1o = cx + r  * Math.cos(a1), y1o = cy + r  * Math.sin(a1);
                      const x2o = cx + r  * Math.cos(a2), y2o = cy + r  * Math.sin(a2);
                      const x1i = cx + ir * Math.cos(a2), y1i = cy + ir * Math.sin(a2);
                      const x2i = cx + ir * Math.cos(a1), y2i = cy + ir * Math.sin(a1);
                      const large = sweep > 180 ? 1 : 0;
                      const d = `M${x1o},${y1o} A${r},${r} 0 ${large},1 ${x2o},${y2o} L${x1i},${y1i} A${ir},${ir} 0 ${large},0 ${x2i},${y2i} Z`;
                      angle += sweep;
                      return <path key={i} d={d} fill={s.color} opacity="0.9" />;
                    });
                  })()}
                  {/* Center text */}
                  <text x="85" y="80" textAnchor="middle" fill="white" fontSize="26" fontWeight="bold">
                    {sourceChartData.reduce((s: number, d: any) => s + d.value, 0)}
                  </text>
                  <text x="85" y="96" textAnchor="middle" fill="#64748b" fontSize="10">
                    Total Leads
                  </text>
                </svg>
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-2 min-w-0">
                {sourceChartData.map((s: any) => {
                  const total = sourceChartData.reduce((acc: number, d: any) => acc + d.value, 0);
                  const pct   = total > 0 ? Math.round((s.value / total) * 100) : 0;
                  return (
                    <div key={s.name}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <span className="text-xs text-white truncate flex-1 font-medium">{s.name}</span>
                        <span className="text-xs font-bold text-white flex-shrink-0">{s.value}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0 w-8 text-right">{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10 ml-4">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, delay: 0.3 }}
                          className="h-1 rounded-full" style={{ background: s.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">No lead data yet</div>
          )}
        </motion.div>

        {/* Deals by Stage */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card p-5">
          <h3 className="font-semibold text-white mb-4">Deals by Stage</h3>
          {funnelData.length > 0 ? (
            <div className="space-y-3 mt-2">
              {funnelData.map((f, i) => (
                <div key={f.stage} className="flex items-center gap-4">
                  <div className="w-24 text-xs text-muted-foreground text-right">{f.stage}</div>
                  <div className="flex-1 score-bar">
                    <motion.div initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (f.count / (funnelData[0]?.count || 1)) * 100)}%` }}
                      transition={{ delay: 0.4 + i * 0.1, duration: 0.8 }}
                      className="score-fill" style={{ background: COLORS[i % COLORS.length] }} />
                  </div>
                  <div className="w-8 text-right">
                    <span className="text-sm font-bold text-white">{f.count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">No deal data yet</div>
          )}
        </motion.div>
      </div>

      {/* Broker Performance */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="glass-card p-5">
        <h3 className="font-semibold text-white mb-4">Broker Performance</h3>
        {brokerPerf.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-white/5">
                  <th className="text-left pb-3 font-medium">Broker</th>
                  <th className="text-center pb-3 font-medium">Leads</th>
                  <th className="text-center pb-3 font-medium">Deals</th>
                  <th className="text-center pb-3 font-medium">Conversion</th>
                  <th className="text-center pb-3 font-medium">Commission</th>
                  <th className="text-left pb-3 font-medium">Performance</th>
                </tr>
              </thead>
              <tbody>
                {brokerPerf.map((b: any, i: number) => (
                  <tr key={b.id} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-estate-600 to-estate-400 flex items-center justify-center text-white text-xs font-bold">
                          {b.name[0]}
                        </div>
                        <span className="text-white font-medium">{b.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-center text-muted-foreground">{b.leads}</td>
                    <td className="py-3 text-center text-emerald-400 font-medium">{b.deals}</td>
                    <td className="py-3 text-center">
                      <span className="text-white font-medium">
                        {b.leads > 0 ? `${((b.deals / b.leads) * 100).toFixed(0)}%` : "0%"}
                      </span>
                    </td>
                    <td className="py-3 text-center text-gold-400 font-medium">{fmtMoney(b.commission)}</td>
                    <td className="py-3">
                      <div className="score-bar w-24">
                        <motion.div initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, b.leads > 0 ? (b.deals / b.leads) * 100 * 5 : 0)}%` }}
                          transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                          className="score-fill bg-gradient-to-r from-estate-600 to-estate-400" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">No broker data yet</div>
        )}
      </motion.div>
    </div>
  );
}
