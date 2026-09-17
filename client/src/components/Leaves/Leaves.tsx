import { useLeaves, useUpdateLeaveStatus } from '../../hooks/useEmployees';
import { CalendarDays, Check, X, ClipboardList } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Spinner } from '../ui';

export default function Leaves() {
  const { data, isLoading } = useLeaves();
  const updateStatus = useUpdateLeaveStatus();

  if (isLoading) {
    return <Spinner />;
  }

  const leaves = data?.leaves || [];
  const balances = data?.balances || [];

  const annual = balances.find((b: any) => b.type === 'Annual');
  const totalAnnual = annual?.allocated ?? 20;
  const taken = annual?.used ?? leaves.filter((l: any) => l.status === 'Approved').length;
  const remaining = Math.max(0, totalAnnual - taken);

  const pending = leaves.filter((l: any) => l.status === 'Pending');
  const others = leaves.filter((l: any) => l.status !== 'Pending');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Total Annual Leave</p>
          <p className="text-2xl font-bold text-slate-800">{totalAnnual} <span className="text-sm font-normal text-slate-400">Days</span></p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Leaves Taken</p>
          <p className="text-2xl font-bold text-slate-800">{taken} <span className="text-sm font-normal text-slate-400">Days</span></p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Remaining Balance</p>
          <p className="text-2xl font-bold text-emerald-600">{remaining} <span className="text-sm font-normal text-slate-400">Days</span></p>
        </Card>
      </div>

      {pending.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-slate-800">Pending Requests ({pending.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {pending.map((l: any) => (
              <div key={l.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{l.employee?.firstName} {l.employee?.lastName}</p>
                  <p className="text-sm text-slate-500">{l.type} · {new Date(l.fromDate).toLocaleDateString()} → {new Date(l.toDate).toLocaleDateString()}</p>
                  <p className="text-sm text-slate-400 mt-1">{l.reason}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="bg-emerald-50 border-transparent text-emerald-600 hover:bg-emerald-100" onClick={() => updateStatus.mutate({ id: l.id, status: 'Approved' })}>
                    <Check className="w-4 h-4" /> Approve
                  </Button>
                  <Button variant="secondary" size="sm" className="bg-red-50 border-transparent text-red-600 hover:bg-red-100" onClick={() => updateStatus.mutate({ id: l.id, status: 'Rejected' })}>
                    <X className="w-4 h-4" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">All Leave Requests</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-sm text-slate-500">
              <th className="px-6 py-3">Employee</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">From</th>
              <th className="px-6 py-3">To</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...pending, ...others].length === 0 ? (
              <tr><td colSpan={5}>
                <EmptyState icon={<ClipboardList className="w-10 h-10" />} title="No leave requests" description="Leave requests will appear here once employees apply." />
              </td></tr>
            ) : [...pending, ...others].map((l: any) => (
              <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3 text-sm font-medium text-slate-800">{l.employee?.firstName} {l.employee?.lastName}</td>
                <td className="px-6 py-3 text-sm text-slate-600">{l.type}</td>
                <td className="px-6 py-3 text-sm text-slate-600">{new Date(l.fromDate).toLocaleDateString()}</td>
                <td className="px-6 py-3 text-sm text-slate-600">{new Date(l.toDate).toLocaleDateString()}</td>
                <td className="px-6 py-3">
                  <Badge tone={l.status === 'Approved' ? 'success' : l.status === 'Rejected' ? 'danger' : 'warning'}>
                    {l.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
