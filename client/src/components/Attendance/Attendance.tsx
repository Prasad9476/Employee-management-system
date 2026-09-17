import { useState } from 'react';
import { useTodayAttendance, useCheckIn, useCheckOut, useEmployees } from '../../hooks/useEmployees';
import { Clock, UserCheck, UserX, AlertTriangle, LogIn, LogOut } from 'lucide-react';
import { Badge, Button, Card, Select, Spinner } from '../ui';

export default function Attendance() {
  const { data, isLoading } = useTodayAttendance();
  const { data: employeesData } = useEmployees({ limit: 500 });
  const checkInMut = useCheckIn();
  const checkOutMut = useCheckOut();
  const [selected, setSelected] = useState('');

  const summary = data?.summary || { total: 0, present: 0, late: 0, absent: 0, onLeave: 0 };
  const records = data?.records || [];
  const employees = employeesData?.employees || [];

  const cards = [
    { label: 'Present', value: summary.present, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Late', value: summary.late, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Absent', value: summary.absent, icon: UserX, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'On Leave', value: summary.onLeave, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  if (isLoading) {
    return <Spinner />;
  }

  const activeEmployees = employees.filter((e: any) => e.status === 'Active');
  const checkedInIds = new Set(records.map((r: any) => r.employeeId));

  const doCheckIn = async () => {
    if (!selected) return;
    try {
      await checkInMut.mutateAsync(selected);
      setSelected('');
    } catch { /* handled below via UI state */ }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <Card key={i} className="p-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg}`}>
                  <Icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{c.value}</p>
                  <p className="text-xs text-slate-500">{c.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Mark Attendance */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Mark Attendance</h3>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="flex-1"
          >
            <option value="">Select employee...</option>
            {activeEmployees.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName} · {e.employeeId}{checkedInIds.has(e.id) ? ' (checked in)' : ''}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button
              onClick={doCheckIn}
              disabled={!selected || checkInMut.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <LogIn className="w-4 h-4" /> Check In
            </Button>
          </div>
        </div>
        {(checkInMut.isError || checkOutMut.isError) && (
          <p className="mt-3 text-sm text-red-600">
            {(checkInMut.error as any)?.response?.data?.error?.message || 'Failed to update attendance'}
          </p>
        )}
      </Card>

      {/* Today's records with check-out actions */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Today's Attendance</h3>
          <p className="text-sm text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-sm text-slate-500">
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Check In</th>
                <th className="px-6 py-3">Check Out</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No attendance records today</td></tr>
              ) : records.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-slate-800">{r.employee?.firstName} {r.employee?.lastName}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{r.employee?.department?.name}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '—'}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '—'}</td>
                  <td className="px-6 py-3">
                    <Badge tone={r.status === 'Present' ? 'success' : r.status === 'Late' ? 'warning' : 'danger'}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    {!r.checkOut ? (
                      <Button
                        onClick={() => checkOutMut.mutate(r.employeeId)}
                        disabled={checkOutMut.isPending}
                        variant="secondary"
                        size="sm"
                        className="bg-slate-100 border-transparent hover:bg-slate-200"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Check Out
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
