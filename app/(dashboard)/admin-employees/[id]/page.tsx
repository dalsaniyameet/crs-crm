"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  ArrowLeft, Clock, CalendarDays, CheckCircle2, XCircle,
  AlertCircle, Loader2, TrendingUp, Users, Camera, Shield, Key,
  FileText, ExternalLink, Trash2, IndianRupee, AlertTriangle, Printer, Download, Upload,
} from "lucide-react";

const DOC_TYPES = [
  "CV", "PAN_CARD", "AADHAR_CARD", "BANK_PASSBOOK", "EXPERIENCE_LETTER",
  "SALARY_SLIP", "OFFER_LETTER", "CONTRACT", "OTHER",
];

const DOC_LABELS: Record<string, { label: string; icon: string }> = {
  CV:                 { label: "CV / Resume",        icon: "📋" },
  PAN_CARD:           { label: "PAN Card",            icon: "🪪" },
  AADHAR_CARD:        { label: "Aadhar Card",         icon: "🆔" },
  BANK_PASSBOOK:      { label: "Bank Passbook",       icon: "🏦" },
  EXPERIENCE_LETTER:  { label: "Experience Letter",   icon: "📜" },
  SALARY_SLIP:        { label: "Salary Slip",         icon: "💰" },
  OFFER_LETTER:       { label: "Offer Letter",        icon: "📩" },
  CONTRACT:           { label: "Contract",            icon: "📝" },
  OTHER:              { label: "Other",               icon: "📄" },
};

const ROLES = ["BROKER", "SALES_MANAGER", "MARKETING", "ADMIN"];
const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-500/20 text-red-400", BROKER: "bg-blue-500/20 text-blue-400",
  SALES_MANAGER: "bg-green-500/20 text-green-400", MARKETING: "bg-purple-500/20 text-purple-400",
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:  { label: "Pending",  color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: <AlertCircle className="w-3 h-3" /> },
  APPROVED: { label: "Approved", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  REJECTED: { label: "Rejected", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: <XCircle className="w-3 h-3" /> },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function SalarySlipPrint({ slip, employee, onClose, onSendToEmployee, sending }: {
  slip: any; employee: any; onClose: () => void;
  onSendToEmployee?: () => void; sending?: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const win = window.open("", "_blank");
    if (!win || !content) return;
    win.document.write(`
      <html><head><title>Salary Slip - ${employee.name} - ${slip.month}/${slip.year}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #000; }
        .header { background: #1e3a5f; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .company { font-size: 20px; font-weight: bold; }
        .subtitle { font-size: 12px; opacity: 0.8; margin-top: 4px; }
        .slip-title { font-size: 16px; font-weight: bold; text-align: center; margin: 16px 0; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .info-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
        .info-label { font-size: 11px; color: #64748b; margin-bottom: 2px; }
        .info-value { font-size: 13px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-size: 12px; border: 1px solid #e2e8f0; }
        td { padding: 8px 12px; font-size: 13px; border: 1px solid #e2e8f0; }
        .total-row { background: #f8fafc; font-weight: bold; }
        .net-box { background: #1e3a5f; color: white; padding: 16px; border-radius: 8px; text-align: center; margin-top: 16px; }
        .net-label { font-size: 12px; opacity: 0.8; }
        .net-amount { font-size: 28px; font-weight: bold; margin-top: 4px; }
        .footer { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .sign-line { border-top: 1px solid #000; padding-top: 4px; font-size: 11px; color: #64748b; margin-top: 40px; }
        @media print { body { padding: 0; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  const gross = slip.gross || (slip.basicSalary + slip.hra + slip.conveyance + slip.medical + slip.bonus);
  const pf    = slip.pf || Math.round(slip.basicSalary * 0.12);
  const esi   = slip.esi || (gross <= 21000 ? Math.round(gross * 0.0075) : 0);
  const totalDeductions = slip.deductions + pf + esi;
  const net   = slip.net || Math.max(0, gross - totalDeductions);
  const workingDays = 26;
  const absentDeduction = slip.absentDays * (slip.basicSalary / workingDays);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
        {/* Action bar */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-800">Salary Slip Preview</h3>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
              <Printer className="w-4 h-4" /> Print / Download PDF
            </button>
            {onSendToEmployee && (
              <button onClick={onSendToEmployee} disabled={sending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Send to Employee
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200">Close</button>
          </div>
        </div>

        {/* Slip content */}
        <div ref={printRef} className="p-6">
          {/* Company Header */}
          <div className="header">
            <div className="company">City Real Space</div>
            <div className="subtitle">A-708, Prahlad Nagar Trade Centre, Satellite, Ahmedabad - 380015</div>
            <div className="subtitle">📞 +91 9825031247 | 🌐 cityrealspace.com</div>
          </div>

          <div className="slip-title">SALARY SLIP — {MONTHS[slip.month - 1].toUpperCase()} {slip.year}</div>

          {/* Employee Info */}
          <div className="info-grid">
            <div className="info-box">
              <div className="info-label">Employee Name</div>
              <div className="info-value">{employee.name}</div>
            </div>
            <div className="info-box">
              <div className="info-label">Designation</div>
              <div className="info-value">{employee.position}</div>
            </div>
            <div className="info-box">
              <div className="info-label">Email</div>
              <div className="info-value">{employee.email}</div>
            </div>
            <div className="info-box">
              <div className="info-label">Department</div>
              <div className="info-value">{employee.role}</div>
            </div>
            <div className="info-box">
              <div className="info-label">Working Days</div>
              <div className="info-value">{workingDays} days</div>
            </div>
            <div className="info-box">
              <div className="info-label">Present / Absent</div>
              <div className="info-value">{slip.presentDays || (workingDays - slip.absentDays)} / {slip.absentDays} days</div>
            </div>
            <div className="info-box">
              <div className="info-label">Total Hours</div>
              <div className="info-value">{slip.totalHours ? `${slip.totalHours.toFixed(1)}h` : "-"}</div>
            </div>
          </div>

          {/* Earnings & Deductions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {/* Earnings */}
            <table>
              <thead><tr><th colSpan={2}>EARNINGS</th></tr></thead>
              <tbody>
                <tr><td>Basic Salary</td><td>₹{slip.basicSalary.toLocaleString("en-IN")}</td></tr>
                <tr><td>HRA</td><td>₹{slip.hra.toLocaleString("en-IN")}</td></tr>
                <tr><td>Conveyance</td><td>₹{slip.conveyance.toLocaleString("en-IN")}</td></tr>
                <tr><td>Medical</td><td>₹{slip.medical.toLocaleString("en-IN")}</td></tr>
                {slip.bonus > 0 && <tr><td>Bonus</td><td>₹{slip.bonus.toLocaleString("en-IN")}</td></tr>}
                <tr className="total-row"><td>Gross Salary</td><td>₹{gross.toLocaleString("en-IN")}</td></tr>
              </tbody>
            </table>
            {/* Deductions */}
            <table>
              <thead><tr><th colSpan={2}>DEDUCTIONS</th></tr></thead>
              <tbody>
                <tr><td>PF (12%)</td><td>₹{pf.toLocaleString("en-IN")}</td></tr>
                {esi > 0 && <tr><td>ESI (0.75%)</td><td>₹{esi.toLocaleString("en-IN")}</td></tr>}
                {slip.absentDays > 0 && <tr><td>Absent ({slip.absentDays}d)</td><td>-₹{Math.round(absentDeduction).toLocaleString("en-IN")}</td></tr>}
                {slip.lateDeduct > 0 && <tr><td>Late ({slip.lateMinutes}min)</td><td>-₹{slip.lateDeduct.toLocaleString("en-IN")}</td></tr>}
                {slip.deductions > 0 && <tr><td>Other Deductions</td><td>₹{slip.deductions.toLocaleString("en-IN")}</td></tr>}
                {slip.otBonus > 0 && <tr><td>OT Bonus ({slip.otHours?.toFixed(1)}h)</td><td style={{color:"#10b981"}}>+₹{slip.otBonus.toLocaleString("en-IN")}</td></tr>}
                <tr className="total-row"><td>Total Deductions</td><td>₹{(totalDeductions + Math.round(absentDeduction)).toLocaleString("en-IN")}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Net Salary */}
          <div className="net-box">
            <div className="net-label">NET SALARY PAYABLE</div>
            <div className="net-amount">₹{net.toLocaleString("en-IN")}</div>
            <div className="net-label" style={{ marginTop: 4 }}>{MONTHS[slip.month - 1]} {slip.year}</div>
          </div>

          {/* Signatures */}
          <div className="footer">
            <div>
              <div className="sign-line">Employee Signature</div>
            </div>
            <div>
              <div className="sign-line">Authorized Signatory</div>
            </div>
          </div>

          <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 16, textAlign: "center" }}>
            This is a computer generated salary slip. No signature required.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [employee, setEmployee]     = useState<any>(null);
  const [leaves, setLeaves]         = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leads, setLeads]           = useState<any[]>([]);
  const [deals, setDeals]           = useState<any[]>([]);
  const [visits, setVisits]         = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [empStats, setEmpStats]     = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [newPwd, setNewPwd]         = useState("");
  const [resetting, setResetting]   = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [documents, setDocuments]   = useState<any[]>([]);
  const [approvingAtt, setApprovingAtt] = useState<string | null>(null);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [adminDocForm, setAdminDocForm] = useState({ name: "", type: "CV", notes: "" });
  const [adminDocUploading, setAdminDocUploading] = useState(false);
  const [processingDoc, setProcessingDoc] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const adminDocFileRef = useRef<HTMLInputElement>(null);
  const adminDocCamRef  = useRef<HTMLInputElement>(null);
  const [showSlipPreview, setShowSlipPreview] = useState(false);
  const [slipData, setSlipData]         = useState<any>(null);
  const [sendingSlip, setSendingSlip]   = useState(false);
  const [salaryMode, setSalaryMode]     = useState<"auto"|"manual">("auto");
  const [basicSalary, setBasicSalary]   = useState(0);
  const [hra, setHra]                   = useState(0);
  const [conveyance, setConveyance]     = useState(0);
  const [medical, setMedical]           = useState(0);
  const [bonus, setBonus]               = useState(0);
  const [deductions, setDeductions]     = useState(0);
  const [absentDays, setAbsentDays]     = useState(0);
  const [manualLateMin, setManualLateMin]   = useState(0);
  const [manualOTHrs, setManualOTHrs]       = useState(0);
  const [slipMonth, setSlipMonth]       = useState(new Date().getMonth() + 1);
  const [slipYear, setSlipYear]         = useState(new Date().getFullYear());
  const [lateDeductPerMin, setLateDeductPerMin] = useState(5);
  const [overtimeRatePerHr, setOvertimeRatePerHr] = useState(50);

  const myRole = (user?.publicMetadata?.role as string)?.toUpperCase();
  useEffect(() => { if (user && myRole !== "ADMIN") router.replace("/dashboard"); }, [user, myRole, router]);

  useEffect(() => {
    if (!params.id) return;
    Promise.all([
      fetch(`/api/admin/employees/${params.id}`).then(r => r.json()),
      fetch(`/api/employee/documents?employeeId=${params.id}`).then(r => r.json()),
    ]).then(([data, docs]) => {
      setEmployee(data.employee || data);
      setLeaves(Array.isArray(data.leaves) ? data.leaves : []);
      setAttendance(Array.isArray(data.attendance) ? data.attendance : []);
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      setDeals(Array.isArray(data.deals) ? data.deals : []);
      setVisits(Array.isArray(data.visits) ? data.visits : []);
      setActivities(Array.isArray(data.activities) ? data.activities : []);
      setEmpStats(data.stats || null);
      setDocuments(Array.isArray(docs) ? docs : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [params.id]);

  const handleLeaveAction = async (leaveId: string, status: "APPROVED" | "REJECTED") => {
    setProcessing(leaveId);
    try {
      const res = await fetch(`/api/leaves/${leaveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) { setLeaves(prev => prev.map(l => l.id === leaveId ? data : l)); toast.success(`Leave ${status.toLowerCase()}`); }
      else toast.error(data.error || "Failed");
    } catch { toast.error("Network error"); }
    finally { setProcessing(null); }
  };

  const handleRoleChange = async (newRole: string) => {
    setSavingRole(true);
    const res = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: employee.id, name: employee.name, email: employee.email, position: employee.position, role: newRole }),
    });
    const data = await res.json();
    if (res.ok) { setEmployee((e: any) => ({ ...e, role: newRole })); toast.success("Role updated!"); }
    else toast.error(data.error || "Failed");
    setSavingRole(false);
  };

  const handleToggleActive = async () => {
    const res = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: employee.id, name: employee.name, email: employee.email, position: employee.position, isActive: !employee.isActive }),
    });
    if (res.ok) {
      setEmployee((e: any) => ({ ...e, isActive: !e.isActive }));
      toast.success(employee.isActive ? "Employee deactivated" : "Employee activated");
    } else toast.error("Failed");
  };

  const handleApproveAttendance = async (attId: string, approved: boolean) => {
    setApprovingAtt(attId);
    try {
      const res = await fetch("/api/attendance/guest", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: attId, approved, approvedBy: user?.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setAttendance(prev => prev.map((a: any) => a.id === attId ? { ...a, approved, approvedAt: data.approvedAt } : a));
        toast.success(approved ? "Attendance approved ✅" : "Attendance rejected");
      } else toast.error(data.error || "Failed");
    } catch { toast.error("Network error"); }
    setApprovingAtt(null);
  };

  const deleteDoc = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    const res = await fetch("/api/employee/documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) { setDocuments(prev => prev.filter((d: any) => d.id !== id)); toast.success("Deleted"); }
  };

  const handleAdminDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!adminDocForm.name.trim()) { toast.error("Enter document name first"); e.target.value = ""; return; }
    setAdminDocUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("folder", "employee-docs");
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const { url, error: upErr } = await upRes.json();
      if (!url) { toast.error(upErr || "Upload failed"); return; }
      const res = await fetch("/api/employee/documents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: adminDocForm.name, type: adminDocForm.type, url, notes: adminDocForm.notes, employeeId: params.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setDocuments(prev => [data, ...prev]);
        setAdminDocForm({ name: "", type: "CV", notes: "" });
        setShowDocUpload(false);
        toast.success("Document uploaded! 📄");
      } else toast.error(data.error || "Failed");
    } catch { toast.error("Network error"); }
    setAdminDocUploading(false);
    e.target.value = "";
  };

  const handleDocAction = async (docId: string, status: "APPROVED" | "REJECTED") => {
    setProcessingDoc(docId);
    try {
      const res = await fetch("/api/employee/documents", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: docId, status, adminNote: rejectNote[docId] || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setDocuments(prev => prev.map(d => d.id === docId ? data : d));
        toast.success(status === "APPROVED" ? "Document approved ✅" : "Document rejected ❌");
        setRejectNote(p => ({ ...p, [docId]: "" }));
      } else toast.error(data.error || "Failed");
    } catch { toast.error("Network error"); }
    setProcessingDoc(null);
  };

  const handleResetPassword = async () => {
    if (!newPwd || newPwd.length < 6) { toast.error("Min 6 characters"); return; }
    setResetting(true);
    const res = await fetch("/api/admin/employees/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: employee.email, password: newPwd }),
    });
    if (res.ok) { toast.success("Password reset! ✅"); setNewPwd(""); }
    else toast.error("Failed to reset password");
    setResetting(false);
  };

  const handleSendSlip = async () => {
    if (!slipData || !employee) return;
    setSendingSlip(true);
    try {
      // Generate slip as text summary and save as document for employee
      const name = `Salary Slip — ${MONTHS[slipData.month - 1]} ${slipData.year}`;
      // Save as employee document (admin upload = auto approved)
      const res = await fetch("/api/employee/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: params.id,
          name,
          type: "SALARY_SLIP",
          url: `data:text/plain,Salary Slip ${MONTHS[slipData.month-1]} ${slipData.year} | Net: Rs.${slipData.net}`,
          notes: `Net Salary: ₹${slipData.net?.toLocaleString("en-IN")} | Gross: ₹${slipData.gross?.toLocaleString("en-IN")} | Present: ${slipData.presentDays || "—"} days`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDocuments(prev => [data, ...prev]);
        toast.success(`✅ Salary slip sent to ${employee.name}!`);
        setShowSlipPreview(false);
      } else {
        toast.error(data.error || "Failed to send");
      }
    } catch { toast.error("Network error"); }
    setSendingSlip(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("folder", "employees");
    const up = await fetch("/api/upload", { method: "POST", body: fd });
    const { url } = await up.json();
    if (url) {
      await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: employee.id, name: employee.name, email: employee.email, position: employee.position, avatarUrl: url }),
      });
      setEmployee((e: any) => ({ ...e, avatarUrl: url }));
      toast.success("Photo updated!");
    } else toast.error("Upload failed");
    setUploadingPhoto(false);
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <Loader2 className="w-8 h-8 animate-spin text-estate-400" />
    </div>
  );

  if (!employee) return (
    <div className="p-6 text-center text-muted-foreground">Employee not found</div>
  );

  const uniqueAttDays = new Set(attendance.map((a: any) => new Date(a.punchIn).toDateString())).size;
  const totalDays  = uniqueAttDays;
  const totalHours = attendance.reduce((s: number, a: any) => s + (a.workHours || 0), 0);
  const pendingLeaves  = leaves.filter(l => l.status === "PENDING").length;
  const approvedLeaves = leaves.filter(l => l.status === "APPROVED").length;
  const approvedAtt    = attendance.filter((a: any) => a.approved && a.punchOut);
  const totalLateMin   = approvedAtt.reduce((s: number, a: any) => s + (a.lateMinutes || 0), 0);
  const totalOTHours   = approvedAtt.reduce((s: number, a: any) => s + (a.overtimeHours || 0), 0);
  const pendingAttCount = attendance.filter((a: any) => a.punchOut && !a.approved).length;

  const DEAL_STAGE_COLOR: Record<string, string> = {
    LEAD:       "bg-blue-500/20 text-blue-400",
    NEGOTIATION:"bg-yellow-500/20 text-yellow-400",
    CLOSED:     "bg-emerald-500/20 text-emerald-400",
    LOST:       "bg-red-500/20 text-red-400",
  };
  const VISIT_STATUS_COLOR: Record<string, string> = {
    SCHEDULED:  "bg-blue-500/20 text-blue-400",
    COMPLETED:  "bg-emerald-500/20 text-emerald-400",
    CANCELLED:  "bg-red-500/20 text-red-400",
    NO_SHOW:    "bg-yellow-500/20 text-yellow-400",
  };
  const LEAD_STATUS_COLOR: Record<string, string> = {
    NEW:        "bg-blue-500/20 text-blue-400",
    CONTACTED:  "bg-yellow-500/20 text-yellow-400",
    QUALIFIED:  "bg-purple-500/20 text-purple-400",
    CONVERTED:  "bg-emerald-500/20 text-emerald-400",
    LOST:       "bg-red-500/20 text-red-400",
  };

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header / Profile */}
      <div className="glass-card p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors flex-shrink-0 mt-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-white/10 border-2 border-estate-500/30">
              {employee.avatarUrl ? (
                <Image src={employee.avatarUrl} alt={employee.name} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white">{employee.name[0]}</div>
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-estate-600 border-2 border-background flex items-center justify-center hover:bg-estate-500 transition-colors">
              {uploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : <Camera className="w-3 h-3 text-white" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{employee.name}</h1>
            <p className="text-sm text-muted-foreground">{employee.position} · {employee.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-xs ${ROLE_COLORS[employee.role] ?? "bg-white/10 text-white"}`}>{employee.role}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs border ${
                employee.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>{employee.isActive ? "✓ Active" : "✕ Inactive"}</span>
            </div>
          </div>
        </div>

        {/* Admin Controls */}
        <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Role */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Shield className="w-3 h-3" /> Change Role</label>
            <div className="flex gap-2">
              <select value={employee.role} onChange={e => handleRoleChange(e.target.value)} disabled={savingRole}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50 disabled:opacity-50">
                {ROLES.map(r => <option key={r} value={r} className="bg-[#0f1f35]">{r}</option>)}
              </select>
              {savingRole && <Loader2 className="w-4 h-4 animate-spin text-estate-400 self-center" />}
            </div>
          </div>
          {/* Password Reset */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Key className="w-3 h-3" /> Reset Password</label>
            <div className="flex gap-2">
              <input value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="New password"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50" />
              <button onClick={handleResetPassword} disabled={resetting}
                className="px-3 py-2 rounded-lg bg-estate-500/20 text-estate-300 border border-estate-500/30 hover:bg-estate-500/30 text-xs disabled:opacity-50">
                {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Set"}
              </button>
            </div>
          </div>
          {/* Activate/Deactivate */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Account Access</label>
            <button onClick={handleToggleActive}
              className={`w-full py-2 rounded-lg text-sm font-medium border transition-colors ${
                employee.isActive
                  ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
              }`}>
              {employee.isActive ? "✕ Deactivate Employee" : "✓ Activate Employee"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Days Present",    value: totalDays,                        icon: <Users className="w-4 h-4" />,       color: "from-blue-600 to-blue-400" },
          { label: "Hours Worked",    value: `${totalHours.toFixed(1)}h`,      icon: <Clock className="w-4 h-4" />,       color: "from-emerald-600 to-emerald-400" },
          { label: "Leaves Pending",  value: pendingLeaves,                    icon: <AlertCircle className="w-4 h-4" />, color: "from-yellow-600 to-yellow-400" },
          { label: "Leaves Approved", value: approvedLeaves,                   icon: <TrendingUp className="w-4 h-4" />,  color: "from-purple-600 to-purple-400" },
        ].map(s => (
          <div key={s.label} className="glass-card p-4">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-3`}>
              {s.icon}
            </div>
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* CRM Activity Stats */}
      {empStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Leads Assigned",  value: empStats.totalLeads,  color: "from-indigo-600 to-indigo-400" },
            { label: "Total Deals",     value: empStats.totalDeals,  color: "from-orange-600 to-orange-400" },
            { label: "Deals Closed",    value: empStats.closedDeals, color: "from-emerald-600 to-emerald-400" },
            { label: "Site Visits",     value: empStats.totalVisits, color: "from-pink-600 to-pink-400" },
          ].map(s => (
            <div key={s.label} className="glass-card p-4">
              <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${s.color} mb-2`} />
              <div className="text-xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Leads */}
      {leads.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-white">Assigned Leads</h2>
            <span className="text-xs text-muted-foreground ml-auto">{leads.length} total</span>
          </div>
          <div className="space-y-2">
            {leads.map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.phone} · {l.source}</div>
                </div>
                {l.budget && <div className="text-xs text-estate-400">₹{Number(l.budget).toLocaleString("en-IN")}</div>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${LEAD_STATUS_COLOR[l.status] ?? "bg-white/10 text-white"}`}>{l.status}</span>
                <div className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString("en-IN")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deals */}
      {deals.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            <h2 className="font-semibold text-white">Deals</h2>
            <span className="text-xs text-muted-foreground ml-auto">{deals.length} total</span>
          </div>
          <div className="space-y-2">
            {deals.map((d: any) => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{d.title}</div>
                  {d.lead?.name && <div className="text-xs text-muted-foreground">Lead: {d.lead.name}</div>}
                </div>
                {d.value && <div className="text-xs text-estate-400">₹{Number(d.value).toLocaleString("en-IN")}</div>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${DEAL_STAGE_COLOR[d.stage] ?? "bg-white/10 text-white"}`}>{d.stage}</span>
                <div className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString("en-IN")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Site Visits */}
      {visits.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-pink-400" />
            <h2 className="font-semibold text-white">Site Visits</h2>
            <span className="text-xs text-muted-foreground ml-auto">{visits.length} total</span>
          </div>
          <div className="space-y-2">
            {visits.map((v: any) => (
              <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{v.lead?.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{v.property?.title} {v.property?.locality ? `· ${v.property.locality}` : ""}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${VISIT_STATUS_COLOR[v.status] ?? "bg-white/10 text-white"}`}>{v.status}</span>
                <div className="text-xs text-muted-foreground">{new Date(v.scheduledAt).toLocaleDateString("en-IN")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Log */}
      {activities.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-estate-400" />
            <h2 className="font-semibold text-white">Recent Activity</h2>
          </div>
          <div className="space-y-2">
            {activities.slice(0, 15).map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-estate-400 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white">{a.description}</div>
                  <div className="text-xs text-muted-foreground">{a.type}</div>
                </div>
                <div className="text-xs text-muted-foreground flex-shrink-0">{new Date(a.createdAt).toLocaleDateString("en-IN")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave Requests */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-5 h-5 text-estate-400" />
          <h2 className="font-semibold text-white">Leave Requests</h2>
        </div>
        {leaves.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No leave requests</div>
        ) : (
          <div className="space-y-3">
            {leaves.map(l => {
              const cfg = STATUS_CFG[l.status];
              return (
                <div key={l.id} className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-white">{l.type.replace("_", " ")}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{l.days} day{l.days !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(l.fromDate).toLocaleDateString("en-IN")} → {new Date(l.toDate).toLocaleDateString("en-IN")}
                      </div>
                      <div className="text-sm text-white mt-1">{l.reason}</div>
                      {l.adminNote && (
                        <div className="text-xs text-yellow-400 mt-1">Admin Note: {l.adminNote}</div>
                      )}
                    </div>
                    {l.status === "PENDING" && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleLeaveAction(l.id, "APPROVED")} disabled={processing === l.id}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
                          {processing === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Approve
                        </button>
                        <button onClick={() => handleLeaveAction(l.id, "REJECTED")} disabled={processing === l.id}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                          {processing === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Salary Slip Generator ── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <IndianRupee className="w-5 h-5 text-estate-400" />
          <h2 className="font-semibold text-white">Salary Slip Generator</h2>
          {pendingAttCount > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> {pendingAttCount} attendance pending approval
            </span>
          )}
        </div>

        {/* Mode Toggle */}
        <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 mb-5">
          <button onClick={() => setSalaryMode("auto")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${salaryMode === "auto" ? "bg-estate-600 text-white" : "text-muted-foreground hover:text-white"}`}>
            ⚡ Auto (from Attendance)
          </button>
          <button onClick={() => setSalaryMode("manual")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${salaryMode === "manual" ? "bg-gold-500/80 text-black" : "text-muted-foreground hover:text-white"}`}>
            ✏️ Manual Entry
          </button>
        </div>

        {/* Month/Year + Basic Salary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Month</label>
            <select value={slipMonth} onChange={e => setSlipMonth(Number(e.target.value))} className={inputCls}>
              {MONTHS.map((m, i) => <option key={m} value={i+1} className="bg-[#0f1f35]">{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Year</label>
            <input type="number" value={slipYear} onChange={e => setSlipYear(Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Basic Salary (₹/month) *</label>
            <input type="number" value={basicSalary || ""} onChange={e => setBasicSalary(Number(e.target.value))}
              placeholder="e.g. 25000" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bonus (₹)</label>
            <input type="number" value={bonus || ""} onChange={e => setBonus(Number(e.target.value))}
              placeholder="0" className={inputCls} />
          </div>
        </div>

        {/* Auto mode */}
        {salaryMode === "auto" && (() => {
          const WORKING_DAYS = 26;
          // Filter attendance for selected month/year
          const monthAtt = attendance.filter((a: any) => {
            const d = new Date(a.punchIn);
            return d.getMonth() + 1 === slipMonth && d.getFullYear() === slipYear && a.punchOut;
          });
          const presentDays = new Set(monthAtt.map((a: any) => new Date(a.punchIn).toDateString())).size;
          // Deduplicate: one record per day (latest punch)
          const monthAttUniq = Object.values(
            monthAtt.reduce((acc: Record<string, any>, a: any) => {
              const day = new Date(a.punchIn).toDateString();
              if (!acc[day] || new Date(a.punchIn) > new Date(acc[day].punchIn)) acc[day] = a;
              return acc;
            }, {})
          ) as any[];
          const calcAbsent    = Math.max(0, WORKING_DAYS - presentDays);
          const totalHrsMonth = monthAttUniq.reduce((s: number, a: any) => s + (a.workHours || 0), 0);
          const lateMinTotal  = monthAttUniq.reduce((s: number, a: any) => s + (a.lateMinutes || 0), 0);
          const otHrsTotal    = monthAttUniq.reduce((s: number, a: any) => s + (a.overtimeHours || 0), 0);

          // Salary calc
          const hraAmt       = Math.round(basicSalary * 0.4);   // 40% HRA
          const convAmt      = Math.round(basicSalary * 0.1);   // 10% Conveyance
          const medAmt       = Math.round(basicSalary * 0.05);  // 5% Medical
          const gross        = basicSalary + hraAmt + convAmt + medAmt + bonus;
          const pf           = Math.round(basicSalary * 0.12);
          const esi          = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
          const perDaySal    = basicSalary / WORKING_DAYS;
          const absentDeduct = Math.round(calcAbsent * perDaySal);
          const lateDeduct   = Math.round(lateMinTotal * lateDeductPerMin);
          const otBonus      = Math.round(otHrsTotal * overtimeRatePerHr);
          const totalDeduct  = pf + esi + absentDeduct + lateDeduct + deductions;
          const net          = Math.max(0, gross - totalDeduct + otBonus);

          return (
            <>
              {/* Attendance Summary */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
                <p className="text-xs font-semibold text-estate-400 mb-3">📊 Auto from Attendance — {MONTHS[slipMonth-1]} {slipYear}</p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { label: "Present",    val: presentDays,              color: "text-emerald-400" },
                    { label: "Absent",     val: calcAbsent,               color: "text-red-400" },
                    { label: "Total Hrs",  val: `${totalHrsMonth.toFixed(1)}h`, color: "text-white" },
                    { label: "Late (min)", val: lateMinTotal,             color: lateMinTotal > 0 ? "text-yellow-400" : "text-white" },
                    { label: "OT (hrs)",   val: otHrsTotal.toFixed(1),    color: otHrsTotal > 0 ? "text-blue-400" : "text-white" },
                    { label: "Working",    val: `${WORKING_DAYS}d`,       color: "text-muted-foreground" },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <div className={`text-sm font-bold ${s.color}`}>{s.val}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Earnings breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                  <p className="text-xs font-semibold text-emerald-400">💰 Earnings</p>
                  {[
                    ["Basic Salary", basicSalary],
                    ["HRA (40%)", hraAmt],
                    ["Conveyance (10%)", convAmt],
                    ["Medical (5%)", medAmt],
                    ...(bonus > 0 ? [["Bonus", bonus]] : []),
                  ].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{l}</span>
                      <span className="text-white font-medium">₹{(v as number).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold border-t border-emerald-500/20 pt-2">
                    <span className="text-emerald-400">Gross</span>
                    <span className="text-emerald-400">₹{gross.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 space-y-2">
                  <p className="text-xs font-semibold text-red-400">➖ Deductions</p>
                  {[
                    ["PF (12%)", pf],
                    ...(esi > 0 ? [["ESI (0.75%)", esi]] : []),
                    ...(absentDeduct > 0 ? [[`Absent (${calcAbsent}d)`, absentDeduct]] : []),
                    ...(lateDeduct > 0 ? [[`Late (${lateMinTotal}min)`, lateDeduct]] : []),
                    ...(deductions > 0 ? [["Other", deductions]] : []),
                  ].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{l}</span>
                      <span className="text-red-400 font-medium">-₹{(v as number).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                  {otBonus > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">OT Bonus ({otHrsTotal.toFixed(1)}h)</span>
                      <span className="text-blue-400 font-medium">+₹{otBonus.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold border-t border-red-500/20 pt-2">
                    <span className="text-red-400">Total Deductions</span>
                    <span className="text-red-400">-₹{totalDeduct.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              {/* Extra deductions */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Other Deductions (₹)</label>
                  <input type="number" value={deductions || ""} onChange={e => setDeductions(Number(e.target.value))}
                    placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Late Deduct (₹/min)</label>
                  <input type="number" value={lateDeductPerMin} onChange={e => setLateDeductPerMin(Number(e.target.value))}
                    className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Overtime Rate (₹/hr)</label>
                  <input type="number" value={overtimeRatePerHr} onChange={e => setOvertimeRatePerHr(Number(e.target.value))}
                    className={inputCls} />
                </div>
              </div>

              {/* Net Salary */}
              <div className="p-4 rounded-xl bg-estate-600/20 border border-estate-500/30 flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">NET SALARY PAYABLE</p>
                  <p className="text-2xl font-bold text-white">₹{net.toLocaleString("en-IN")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{MONTHS[slipMonth-1]} {slipYear} · {presentDays}/{WORKING_DAYS} days present</p>
                </div>
                <button
                  disabled={!basicSalary}
                  onClick={() => {
                    setSlipData({ basicSalary, hra: hraAmt, conveyance: convAmt, medical: medAmt, bonus,
                      deductions: totalDeduct - pf - esi - absentDeduct - lateDeduct,
                      absentDays: calcAbsent, lateMinutes: lateMinTotal, otHours: otHrsTotal,
                      lateDeduct, otBonus, pf, esi, gross, net,
                      presentDays, totalHours: totalHrsMonth,
                      month: slipMonth, year: slipYear });
                    setShowSlipPreview(true);
                  }}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-estate-600 hover:bg-estate-500 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <Printer className="w-4 h-4" /> Generate Slip
                </button>
              </div>
            </>
          );
        })()}

        {/* Manual mode */}
        {salaryMode === "manual" && (() => {
          const hraAmt  = hra || Math.round(basicSalary * 0.4);
          const convAmt = conveyance || Math.round(basicSalary * 0.1);
          const medAmt  = medical || Math.round(basicSalary * 0.05);
          const gross   = basicSalary + hraAmt + convAmt + medAmt + bonus;
          const pf      = Math.round(basicSalary * 0.12);
          const esi     = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
          const perDay  = basicSalary / 26;
          const absentDeduct = Math.round(absentDays * perDay);
          const lateDeduct   = Math.round(manualLateMin * lateDeductPerMin);
          const otBonus      = Math.round(manualOTHrs * overtimeRatePerHr);
          const totalDeduct  = pf + esi + absentDeduct + lateDeduct + deductions;
          const net          = Math.max(0, gross - totalDeduct + otBonus);
          return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {[
                  { label: "HRA (₹)",         val: hra,         set: setHra,         ph: `Auto: ${Math.round(basicSalary*0.4)}` },
                  { label: "Conveyance (₹)",  val: conveyance,  set: setConveyance,  ph: `Auto: ${Math.round(basicSalary*0.1)}` },
                  { label: "Medical (₹)",     val: medical,     set: setMedical,     ph: `Auto: ${Math.round(basicSalary*0.05)}` },
                  { label: "Absent Days",     val: absentDays,  set: setAbsentDays,  ph: "0" },
                  { label: "Late (minutes)",  val: manualLateMin, set: setManualLateMin, ph: "0" },
                  { label: "OT (hours)",      val: manualOTHrs, set: setManualOTHrs, ph: "0" },
                  { label: "Other Deductions (₹)", val: deductions, set: setDeductions, ph: "0" },
                  { label: "Late Deduct (₹/min)",  val: lateDeductPerMin, set: setLateDeductPerMin, ph: "5" },
                  { label: "OT Rate (₹/hr)",        val: overtimeRatePerHr, set: setOvertimeRatePerHr, ph: "50" },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                    <input type="number" value={f.val || ""} onChange={e => f.set(Number(e.target.value))}
                      placeholder={f.ph} className={inputCls} />
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-400 mb-2">💰 Earnings</p>
                  {[["Basic",basicSalary],["HRA",hraAmt],["Conveyance",convAmt],["Medical",medAmt],...(bonus>0?[["Bonus",bonus]]:[])].map(([l,v])=>(
                    <div key={l as string} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{l}</span>
                      <span className="text-white">₹{(v as number).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold border-t border-emerald-500/20 pt-1.5">
                    <span className="text-emerald-400">Gross</span><span className="text-emerald-400">₹{gross.toLocaleString("en-IN")}</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 space-y-1.5">
                  <p className="text-xs font-semibold text-red-400 mb-2">➖ Deductions</p>
                  {[["PF (12%)",pf],...(esi>0?[["ESI",esi]]:[]),...(absentDeduct>0?[[`Absent (${absentDays}d)`,absentDeduct]]:[]),...(lateDeduct>0?[[`Late (${manualLateMin}min)`,lateDeduct]]:[]),...(deductions>0?[["Other",deductions]]:[])].map(([l,v])=>(
                    <div key={l as string} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{l}</span>
                      <span className="text-red-400">-₹{(v as number).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                  {otBonus>0&&<div className="flex justify-between text-xs"><span className="text-muted-foreground">OT Bonus</span><span className="text-blue-400">+₹{otBonus.toLocaleString("en-IN")}</span></div>}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-estate-600/20 border border-estate-500/30 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">NET SALARY PAYABLE</p>
                  <p className="text-2xl font-bold text-white">₹{net.toLocaleString("en-IN")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{MONTHS[slipMonth-1]} {slipYear}</p>
                </div>
                <button disabled={!basicSalary}
                  onClick={() => {
                    setSlipData({ basicSalary, hra: hraAmt, conveyance: convAmt, medical: medAmt, bonus,
                      deductions, absentDays, lateMinutes: manualLateMin, otHours: manualOTHrs,
                      lateDeduct, otBonus, pf, esi, gross, net, month: slipMonth, year: slipYear });
                    setShowSlipPreview(true);
                  }}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-estate-600 hover:bg-estate-500 text-white font-semibold transition-colors disabled:opacity-40">
                  <Printer className="w-4 h-4" /> Generate Slip
                </button>
              </div>
            </>
          );
        })()}
      </div>

      {/* ── Attendance History with Approval ── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-estate-400" />
          <h2 className="font-semibold text-white">Attendance History</h2>
          <span className="text-xs text-muted-foreground ml-auto">Approve to include in salary</span>
        </div>
        {attendance.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No attendance records</div>
        ) : (
          <div className="space-y-2">
            {attendance.slice(0, 30).map((a: any) => (
              <div key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
                a.approved ? "bg-emerald-500/5 border-emerald-500/15" : "bg-white/5 border-white/5"
              }`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.approved ? "bg-emerald-400" : a.punchOut ? "bg-yellow-400" : "bg-blue-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">
                    {new Date(a.punchIn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    {a.punchOut && <> → {new Date(a.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</>}
                    {a.lateMinutes > 0 && <span className="ml-2 text-red-400">{a.lateMinutes}min late</span>}
                    {a.overtimeHours > 0 && <span className="ml-2 text-emerald-400">+{a.overtimeHours.toFixed(1)}h OT</span>}
                  </div>
                </div>
                <div className="text-xs font-medium text-estate-400 flex-shrink-0">
                  {a.workHours ? `${a.workHours.toFixed(1)}h` : "In Office"}
                </div>
                {a.punchOut && (
                  a.approved ? (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 flex-shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                    </span>
                  ) : (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => handleApproveAttendance(a.id, true)} disabled={approvingAtt === a.id}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50">
                        {approvingAtt === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Approve
                      </button>
                      <button onClick={() => handleApproveAttendance(a.id, false)} disabled={approvingAtt === a.id}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Documents ── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-estate-400" />
          <h2 className="font-semibold text-white">Documents</h2>
          <span className="text-xs text-muted-foreground ml-1">({documents.length})</span>
          {documents.filter((d: any) => d.status === "PENDING" && d.uploadedBy === "EMPLOYEE").length > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
              <AlertTriangle className="w-3 h-3" />
              {documents.filter((d: any) => d.status === "PENDING" && d.uploadedBy === "EMPLOYEE").length} pending
            </span>
          )}
          <button onClick={() => setShowDocUpload(v => !v)}
            className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-estate-500/20 text-estate-300 border border-estate-500/30 hover:bg-estate-500/30 transition-colors">
            <Upload className="w-3.5 h-3.5" /> Upload Doc
          </button>
        </div>

        {/* Admin Upload Form */}
        {showDocUpload && (
          <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <p className="text-xs font-semibold text-estate-400">Upload Document for {employee.name}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Document Name *</label>
                <input value={adminDocForm.name} onChange={e => setAdminDocForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Aadhar Card" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <select value={adminDocForm.type} onChange={e => setAdminDocForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                  {DOC_TYPES.map(t => (
                    <option key={t} value={t} className="bg-[#0f1f35]">
                      {DOC_LABELS[t]?.icon} {DOC_LABELS[t]?.label || t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
              <input value={adminDocForm.notes} onChange={e => setAdminDocForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes..." className={inputCls} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => adminDocCamRef.current?.click()} disabled={adminDocUploading || !adminDocForm.name.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all disabled:opacity-50 bg-blue-500/10 text-blue-400 border-blue-500/25 hover:bg-blue-500/20">
                {adminDocUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "📷"} Camera / Scan
              </button>
              <button type="button" onClick={() => adminDocFileRef.current?.click()} disabled={adminDocUploading || !adminDocForm.name.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all disabled:opacity-50 bg-estate-500/10 text-estate-300 border-estate-500/25 hover:bg-estate-500/20">
                {adminDocUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Choose File
              </button>
            </div>
            {!adminDocForm.name.trim() && <p className="text-xs text-yellow-400/70">⚠️ Enter document name to enable upload</p>}
            <button onClick={() => setShowDocUpload(false)} className="text-xs text-muted-foreground hover:text-white">Cancel</button>
            <input ref={adminDocCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAdminDocUpload} />
            <input ref={adminDocFileRef} type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden" onChange={handleAdminDocUpload} />
          </div>
        )}

        {/* Quick upload buttons */}
        {!showDocUpload && (
          <div className="flex flex-wrap gap-2 mb-4">
            {["CV", "PAN_CARD", "AADHAR_CARD", "BANK_PASSBOOK", "EXPERIENCE_LETTER", "OFFER_LETTER", "CONTRACT"].map(type => {
              const already = documents.some((d: any) => d.type === type && d.status === "APPROVED");
              return (
                <button key={type} onClick={() => { setAdminDocForm({ name: DOC_LABELS[type].label, type, notes: "" }); setShowDocUpload(true); }}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                    already
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-white/5 text-muted-foreground border-white/10 hover:text-white hover:border-white/20"
                  }`}>
                  {DOC_LABELS[type].icon} {DOC_LABELS[type].label}{already && " ✓"}
                </button>
              );
            })}
          </div>
        )}

        {documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No documents uploaded</div>
        ) : (
          <div className="space-y-2">
            {documents.map((d: any) => (
              <div key={d.id} className={`p-3 rounded-xl border ${
                d.status === "PENDING" && d.uploadedBy === "EMPLOYEE"
                  ? "bg-yellow-500/5 border-yellow-500/20"
                  : d.status === "REJECTED"
                  ? "bg-red-500/5 border-red-500/15"
                  : "bg-white/5 border-white/5"
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl flex-shrink-0">{DOC_LABELS[d.type]?.icon || "📄"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{d.name}</div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {DOC_LABELS[d.type]?.label || d.type.replace(/_/g, " ")} · {new Date(d.createdAt).toLocaleDateString("en-IN")}
                      </span>
                      {d.uploadedBy === "EMPLOYEE" && (
                        <span className="text-xs text-blue-400">👤 Employee uploaded</span>
                      )}
                      {d.status === "PENDING" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">⏳ Pending</span>
                      )}
                      {d.status === "APPROVED" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">✅ Approved</span>
                      )}
                      {d.status === "REJECTED" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">❌ Rejected</span>
                      )}
                    </div>
                    {d.adminNote && <p className="text-xs text-muted-foreground mt-0.5">Note: {d.adminNote}</p>}
                  </div>
                  <a
                    href={d.url?.endsWith(".pdf") || d.url?.includes("/raw/") || d.url?.includes("application/pdf")
                      ? `https://docs.google.com/viewer?url=${encodeURIComponent(d.url)}&embedded=true`
                      : d.url}
                    target="_blank" rel="noreferrer"
                    className="p-1.5 rounded-lg hover:bg-estate-500/10 text-muted-foreground hover:text-estate-400 transition-colors flex-shrink-0">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button onClick={() => deleteDoc(d.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Approve / Reject — only for employee-uploaded pending docs */}
                {d.status === "PENDING" && d.uploadedBy === "EMPLOYEE" && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                    <input
                      value={rejectNote[d.id] || ""}
                      onChange={e => setRejectNote(p => ({ ...p, [d.id]: e.target.value }))}
                      placeholder="Rejection reason (optional)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-red-500/50"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleDocAction(d.id, "APPROVED")} disabled={processingDoc === d.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-medium transition-all disabled:opacity-50">
                        {processingDoc === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Approve
                      </button>
                      <button onClick={() => handleDocAction(d.id, "REJECTED")} disabled={processingDoc === d.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 text-xs font-medium transition-all disabled:opacity-50">
                        {processingDoc === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Salary Slip Preview Modal */}
      {showSlipPreview && slipData && employee && (
        <SalarySlipPrint slip={slipData} employee={employee} onClose={() => setShowSlipPreview(false)}
          onSendToEmployee={handleSendSlip} sending={sendingSlip} />
      )}
    </div>
  );
}
