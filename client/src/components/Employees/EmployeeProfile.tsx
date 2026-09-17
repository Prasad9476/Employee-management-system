import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, CalendarCheck, ClipboardList, Wallet, BarChart3, FileText,
  Mail, Phone, MapPin, Briefcase, Users, Clock, Download, Star, CalendarClock,
} from 'lucide-react';
import { useEmployee, useUpdateLeaveStatus } from '../../hooks/useEmployees';
import api from '../../api/axios';
import { Badge, Card, Spinner, EmptyState } from '../ui';

type Tab = 'overview' | 'attendance' | 'leaves' | 'payroll' | 'performance' | 'documents';

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'leaves', label: 'Leaves', icon: ClipboardList },
  { id: 'payroll', label: 'Payroll', icon: Wallet },
  { id: 'performance', label: 'Performance', icon: BarChart3 },
  { id: 'documents', label: 'Documents', icon: FileText },
];

function statusTone(status: string) {
  if (status === 'Active') return 'success';
  if (status === 'OnLeave') return 'warning';
  return 'danger';
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800 truncate">{value ?? '—'}</p>
      </div>
    </div>
  );
}

export default function EmployeeProfile() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: emp, isLoading } = useEmployee(id);
  const [tab, setTab] = useState<Tab>('overview');
  const updateStatus = useUpdateLeaveStatus();

  if (isLoading) return <Spinner />;
  if (!emp) {
    return <EmptyState icon={<User className="w-10 h-10" />} title="Employee not found" description="The employee record doesn't exist or you don't have access." />;
  }

  const downloadSlip = async (payrollId: string) => {
    try {
      const res = await api.get(`/payroll/${payrollId}/salary-slip`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'salary-slip.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const attendance = emp.attendance || [];
  const leaves = emp.leaves || [];
  const payrolls = emp.payrolls || [];
  const performance = emp.performance || [];
  const balances = emp.leaveBalances || [];
  const documents = Array.isArray(emp.documents) ? emp.documents : [];
  const skills = emp.skills ? (typeof emp.skills === 'string' ? JSON.parse(emp.skills || '[]') : emp.skills) : [];

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header card */}
      <Card className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl font-bold shrink-0">
          {emp.firstName[0]}{emp.lastName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-800">{emp.firstName} {emp.lastName}</h2>
            <Badge tone={statusTone(emp.status)}>{emp.status}</Badge>
            <Badge tone="info">{emp.role?.name}</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">{emp.employeeId} · {emp.department?.name} · {emp.employmentType}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5"><Mail className="w-4 h-4 text-slate-400" /> {emp.email}</span>
            {emp.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-4 h-4 text-slate-400" /> {emp.phone}</span>}
            {emp.location && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {emp.location}</span>}
            {emp.manager && <span className="inline-flex items-center gap-1.5"><Users className="w-4 h-4 text-slate-400" /> Reports to {emp.manager.firstName} {emp.manager.lastName}</span>}
          </div>
        </div>
        {emp.resumeUrl && (
          <a href={emp.resumeUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors shrink-0">
            <Download className="w-4 h-4" /> Resume
          </a>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 p-1.5 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0 ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <h3 className="font-semibold text-slate-800 mb-2">Personal</h3>
            <InfoRow icon={Briefcase} label="Role" value={emp.role?.name} />
            <InfoRow icon={MapPin} label="Location" value={emp.location} />
            <InfoRow icon={CalendarClock} label="Joined" value={new Date(emp.joinDate).toLocaleDateString()} />
            <InfoRow icon={Users} label="Employment Type" value={emp.employmentType} />
            <InfoRow icon={Clock} label="Work Mode" value={emp.workMode} />
            <InfoRow icon={Briefcase} label="Manager" value={emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : undefined} />
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-slate-800 mb-2">Salary & Lifecycle</h3>
            <InfoRow icon={Wallet} label="Salary" value={`₹${(emp.salary ?? 0).toLocaleString()}`} />
            <InfoRow icon={CalendarClock} label="Probation Ends" value={emp.probationEndDate ? new Date(emp.probationEndDate).toLocaleDateString() : undefined} />
            <InfoRow icon={CalendarClock} label="Confirmed" value={emp.confirmationDate ? new Date(emp.confirmationDate).toLocaleDateString() : undefined} />
            {emp.resignationDate && <InfoRow icon={Clock} label="Resigned" value={new Date(emp.resignationDate).toLocaleDateString()} />}
            {emp.lastWorkingDay && <InfoRow icon={Clock} label="Last Working Day" value={new Date(emp.lastWorkingDay).toLocaleDateString()} />}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-slate-800 mb-2">Skills & Emergency Contact</h3>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {skills.map((s: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">{s}</span>
                ))}
              </div>
            )}
            {emp.emergencyContactName && (
              <div className="text-sm text-slate-600 space-y-1">
                <p><span className="text-slate-400">Contact:</span> {emp.emergencyContactName}</p>
                <p><span className="text-slate-400">Phone:</span> {emp.emergencyContactPhone}</p>
                <p><span className="text-slate-400">Relation:</span> {emp.emergencyContactRelation}</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'attendance' && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800">Recent Attendance</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-sm text-slate-500">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Check In</th>
                  <th className="px-6 py-3">Check Out</th>
                  <th className="px-6 py-3">Hours</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No attendance records</td></tr>
                ) : attendance.map((r: any) => (
                  <tr key={r.id}>
                    <td className="px-6 py-3 text-sm text-slate-700">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '—'}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '—'}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{r.checkIn && r.checkOut ? Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 3600000 * 10) / 10 + 'h' : '—'}</td>
                    <td className="px-6 py-3"><Badge tone={r.status === 'Present' ? 'success' : r.status === 'Late' ? 'warning' : 'danger'}>{r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'leaves' && (
        <div className="space-y-4">
          {balances.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {balances.map((b: any) => {
                const remaining = b.allocated - b.used;
                const pct = b.allocated ? Math.min(100, (b.used / b.allocated) * 100) : 0;
                return (
                  <Card key={b.id} className="p-5">
                    <p className="text-sm text-slate-500">{b.type} Leave</p>
                    <p className="text-2xl font-bold text-slate-800">{remaining} <span className="text-sm font-normal text-slate-400">/ {b.allocated} days</span></p>
                    <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800">Leave History</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-sm text-slate-500">
                    <th className="px-6 py-3">Type</th><th className="px-6 py-3">From</th><th className="px-6 py-3">To</th><th className="px-6 py-3">Reason</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No leave requests</td></tr>
                  ) : leaves.map((l: any) => (
                    <tr key={l.id}>
                      <td className="px-6 py-3 text-sm text-slate-700">{l.type}</td>
                      <td className="px-6 py-3 text-sm text-slate-600">{new Date(l.fromDate).toLocaleDateString()}</td>
                      <td className="px-6 py-3 text-sm text-slate-600">{new Date(l.toDate).toLocaleDateString()}</td>
                      <td className="px-6 py-3 text-sm text-slate-500 max-w-[200px] truncate">{l.reason}</td>
                      <td className="px-6 py-3"><Badge tone={l.status === 'Approved' ? 'success' : l.status === 'Rejected' ? 'danger' : 'warning'}>{l.status}</Badge></td>
                      <td className="px-6 py-3">
                        {l.status === 'Pending' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => updateStatus.mutate({ id: l.id, status: 'Approved' })} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100">Approve</button>
                            <button onClick={() => updateStatus.mutate({ id: l.id, status: 'Rejected' })} className="px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100">Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'payroll' && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800">Payroll Records</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-sm text-slate-500">
                  <th className="px-6 py-3">Month</th><th className="px-6 py-3 text-right">Basic</th><th className="px-6 py-3 text-right">Allowances</th><th className="px-6 py-3 text-right">Deductions</th><th className="px-6 py-3 text-right">Net Pay</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrolls.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">No payroll records</td></tr>
                ) : payrolls.map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-6 py-3 text-sm text-slate-700">{new Date(p.month).toLocaleString('default', { month: 'short', year: 'numeric' })}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 text-right">₹{p.basicSalary.toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm text-emerald-600 text-right">+₹{p.allowances.toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm text-red-600 text-right">-₹{p.deductions.toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-slate-800 text-right">₹{p.netPay.toLocaleString()}</td>
                    <td className="px-6 py-3"><Badge tone={p.status === 'Paid' ? 'success' : p.status === 'Processed' ? 'info' : 'warning'}>{p.status}</Badge></td>
                    <td className="px-6 py-3">
                      <button onClick={() => downloadSlip(p.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200">
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'performance' && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800">Performance Reviews</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-sm text-slate-500">
                  <th className="px-6 py-3">Date</th><th className="px-6 py-3">Category</th><th className="px-6 py-3">Score</th><th className="px-6 py-3">Reviewed By</th><th className="px-6 py-3">Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {performance.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No performance reviews</td></tr>
                ) : performance.map((r: any) => (
                  <tr key={r.id}>
                    <td className="px-6 py-3 text-sm text-slate-700">{new Date(r.reviewDate).toLocaleDateString()}</td>
                    <td className="px-6 py-3"><span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">{r.category || 'General'}</span></td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="flex">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= r.score ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />)}</div>
                        <span className="text-sm font-medium text-slate-700">{r.score}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">{r.reviewedBy}</td>
                    <td className="px-6 py-3 text-sm text-slate-500 max-w-[240px] truncate">{r.comments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'documents' && (
        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Documents ({documents.length})</h3>
          {documents.length === 0 ? (
            <EmptyState icon={<FileText className="w-10 h-10" />} title="No documents uploaded" description="Documents like resumes, offers, and IDs will appear here." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map((d: any, i: number) => (
                <a key={i} href={d.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-red-500" /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{d.name}</p>
                    <p className="text-xs text-slate-400">{d.mimeType} · {new Date(d.uploadedAt).toLocaleDateString()}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
