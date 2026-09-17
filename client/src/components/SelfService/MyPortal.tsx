import {
  UserCheck, CalendarClock, Wallet, TrendingUp, LogIn, LogOut,
  Clock, FileDown, Star, Bell,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  useTodayAttendance, useCheckIn, useCheckOut, useMyLeaveBalances, useNotifications, useMarkNotificationRead,
} from '../../hooks/useEmployees';
import api from '../../api/axios';
import { Badge, Card, Spinner, EmptyState } from '../ui';
import { useQuery } from '@tanstack/react-query';

export default function MyPortal() {
  const { user } = useAuth();
  const { data: today, isLoading: attLoading } = useTodayAttendance();
  const { data: balances } = useMyLeaveBalances();
  const { data: notifData } = useNotifications();
  const markRead = useMarkNotificationRead();
  const checkInMut = useCheckIn();
  const checkOutMut = useCheckOut();

  const { data: payrolls, isLoading: payLoading } = useQuery({
    queryKey: ['my-payrolls'],
    queryFn: async () => {
      // Backend scopes payroll to the caller's own record for Employee/Manager roles.
      const res = await api.get('/payroll');
      return res.data?.payrolls || [];
    },
    staleTime: 30_000,
  });

  const { data: performance, isLoading: perfLoading } = useQuery({
    queryKey: ['my-performance'],
    queryFn: () => api.get('/performance').then(r => r.data || []),
    staleTime: 30_000,
  });

  if (attLoading || payLoading || perfLoading) return <Spinner />;

  const notifications = notifData?.notifications || [];
  // Backend scopes today's attendance to the caller's own record for employees.
  const myRecord = (today?.records || [])[0];

  const downloadSlip = async (id: string) => {
    try {
      const res = await api.get(`/payroll/${id}/salary-slip`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'salary-slip.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const avgScore = performance?.length ? (performance.reduce((s: number, r: any) => s + r.score, 0) / performance.length).toFixed(1) : '0.0';
  const latestSalary = payrolls?.[0];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold">Welcome back, {user?.name?.split(' ')[0]} 👋</h2>
        <p className="text-white/70 text-sm mt-1">Here's your personal overview for today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center"><UserCheck className="w-5 h-5 text-emerald-600" /></div>
          <div><p className="text-sm text-slate-500">Today</p><p className="text-2xl font-bold text-slate-800">{myRecord ? (myRecord.status === 'Late' ? 'Late' : 'Present') : 'Not checked in'}</p></div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center"><CalendarClock className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-sm text-slate-500">Annual Leave Left</p><p className="text-2xl font-bold text-slate-800">{(() => { const a = (balances || []).find((b: any) => b.type === 'Annual'); return a ? a.allocated - a.used : 0; })()} <span className="text-sm font-normal text-slate-400">days</span></p></div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center"><Wallet className="w-5 h-5 text-violet-600" /></div>
          <div><p className="text-sm text-slate-500">Latest Net Pay</p><p className="text-2xl font-bold text-slate-800">{latestSalary ? `₹${latestSalary.netPay.toLocaleString()}` : '—'}</p></div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-amber-600" /></div>
          <div><p className="text-sm text-slate-500">Avg Performance</p><p className="text-2xl font-bold text-slate-800">{avgScore} <span className="text-sm font-normal text-slate-400">/ 5</span></p></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Check-in / Out */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> Attendance</h3>
          <p className="text-sm text-slate-500 mb-5">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
              <div>
                <p className="text-xs text-slate-400">Check In</p>
                <p className="text-lg font-bold text-slate-800">{myRecord?.checkIn ? new Date(myRecord.checkIn).toLocaleTimeString() : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Check Out</p>
                <p className="text-lg font-bold text-slate-800">{myRecord?.checkOut ? new Date(myRecord.checkOut).toLocaleTimeString() : '—'}</p>
              </div>
            </div>
            {!myRecord?.checkOut ? (
              myRecord?.checkIn ? (
                <button onClick={() => checkOutMut.mutate(myRecord.employeeId)} disabled={checkOutMut.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-900 disabled:opacity-50">
                  <LogOut className="w-4 h-4" /> {checkOutMut.isPending ? 'Checking out...' : 'Check Out'}
                </button>
              ) : (
                <button onClick={() => checkInMut.mutate(myRecord?.employeeId)} disabled={checkInMut.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  <LogIn className="w-4 h-4" /> {checkInMut.isPending ? 'Checking in...' : 'Check In'}
                </button>
              )
            ) : (
              <p className="text-center text-sm text-emerald-600 font-medium py-2">Day complete ✓</p>
            )}
            {(checkInMut.isError || checkOutMut.isError) && (
              <p className="text-sm text-red-600">{(checkInMut.error as any)?.response?.data?.error?.message || checkOutMut.error ? (checkOutMut.error as any)?.response?.data?.error?.message || 'Failed' : ''}</p>
            )}
          </div>
        </Card>

        {/* Leave balances */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-blue-600" /> Leave Balance</h3>
          {(balances || []).length === 0 ? (
            <EmptyState icon={<CalendarClock className="w-8 h-8" />} title="No leave balance" />
          ) : (
            <div className="space-y-4">
              {(balances || []).map((b: any) => {
                const remaining = b.allocated - b.used;
                const pct = b.allocated ? Math.min(100, (b.used / b.allocated) * 100) : 0;
                return (
                  <div key={b.id}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-700 font-medium">{b.type}</span>
                      <span className="text-slate-500">{remaining}/{b.allocated} days</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Notifications */}
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-slate-800">Notifications</h3>
            {notifData?.unread > 0 && <Badge tone="warning">{notifData.unread} unread</Badge>}
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-auto">
            {notifications.length === 0 ? (
              <EmptyState icon={<Bell className="w-8 h-8" />} title="No notifications" />
            ) : notifications.map((n: any) => (
              <div key={n.id} onClick={() => { if (!n.read) markRead.mutate(n.id); }}
                className={`px-6 py-3 text-sm cursor-pointer transition-colors ${n.read ? 'text-slate-500' : 'text-slate-800 bg-blue-50/40'}`}>
                <p className="font-medium">{n.message}</p>
                <p className="text-xs text-slate-400 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Payroll + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800 flex items-center gap-2"><Wallet className="w-4 h-4 text-blue-600" /> My Salary Slips</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-sm text-slate-500">
                  <th className="px-6 py-3">Month</th><th className="px-6 py-3 text-right">Net Pay</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(payrolls || []).length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-400">No payroll records yet</td></tr>
                ) : (payrolls || []).map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-6 py-3 text-sm text-slate-700">{new Date(p.month).toLocaleString('default', { month: 'short', year: 'numeric' })}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-slate-800 text-right">₹{p.netPay.toLocaleString()}</td>
                    <td className="px-6 py-3"><Badge tone={p.status === 'Paid' ? 'success' : p.status === 'Processed' ? 'info' : 'warning'}>{p.status}</Badge></td>
                    <td className="px-6 py-3">
                      <button onClick={() => downloadSlip(p.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200">
                        <FileDown className="w-3.5 h-3.5" /> Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> My Performance</h3>
          <div className="mb-4">
            <p className="text-sm text-slate-500">Average Score</p>
            <p className="text-3xl font-bold text-slate-800">{avgScore} <span className="text-lg font-normal text-slate-400">/ 5</span></p>
          </div>
          <div className="space-y-3 max-h-56 overflow-auto">
            {(performance || []).length === 0 ? (
              <EmptyState icon={<Star className="w-8 h-8" />} title="No reviews yet" />
            ) : (performance || []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.category || 'General review'}</p>
                  <p className="text-xs text-slate-400">{new Date(r.reviewDate).toLocaleDateString()} · {r.reviewedBy}</p>
                </div>
                <div className="flex">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= r.score ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
