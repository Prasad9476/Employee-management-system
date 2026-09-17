import { usePayrolls, useGeneratePayroll, useUpdatePayrollStatus, useEmployees } from '../../hooks/useEmployees';
import api from '../../api/axios';
import { Wallet, DollarSign, FileDown, RefreshCw, CheckCircle2, Plus } from 'lucide-react';
import { Badge, Button, Card, Select, Spinner } from '../ui';

export default function Payroll() {
  const { data: payrollData, isLoading } = usePayrolls();
  const { data: employeesData } = useEmployees({ limit: 500 });
  const generateMut = useGeneratePayroll();
  const updateStatus = useUpdatePayrollStatus();
  const employees = employeesData?.employees || [];
  const payrolls = payrollData?.payrolls || [];

  if (isLoading) {
    return <Spinner />;
  }

  const totalNet = payrolls.reduce((s: number, p: any) => s + p.netPay, 0);
  const processed = payrolls.filter((p: any) => p.status === 'Processed' || p.status === 'Paid').length;

  const downloadSlip = async (id: string) => {
    try {
      const res = await api.get(`/payroll/${id}/salary-slip`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'salary-slip.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // Ignore download failures silently.
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center"><Wallet className="w-6 h-6 text-blue-600" /></div>
          <div><p className="text-sm text-slate-500">Total Payroll</p><p className="text-2xl font-bold text-slate-800">₹{totalNet.toLocaleString()}</p></div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center"><DollarSign className="w-6 h-6 text-emerald-600" /></div>
          <div><p className="text-sm text-slate-500">Processed</p><p className="text-2xl font-bold text-slate-800">{processed}/{(payrolls || []).length}</p></div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center"><Wallet className="w-6 h-6 text-violet-600" /></div>
          <div><p className="text-sm text-slate-500">Avg Net Pay</p><p className="text-2xl font-bold text-slate-800">₹{(payrolls?.length ? Math.round(totalNet / payrolls.length) : 0).toLocaleString()}</p></div>
        </Card>
      </div>

      {/* Generate payroll */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-blue-600" /> Generate Payroll</h3>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Select
            id="payroll-employee"
            className="flex-1"
            defaultValue=""
            onChange={e => { e.target.dataset.selected = e.target.value; }}
          >
            <option value="">Select employee...</option>
            {employees.map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} · {e.employeeId}</option>)}
          </Select>
          <Button
            onClick={() => {
              const sel = (document.getElementById('payroll-employee') as HTMLSelectElement)?.value;
              if (!sel) return;
              generateMut.mutate({ employeeId: sel });
              ((document.getElementById('payroll-employee') as HTMLSelectElement)).value = '';
            }}
            disabled={generateMut.isPending}
          >
            <RefreshCw className="w-4 h-4" /> Generate
          </Button>
        </div>
        {generateMut.isError && (
          <p className="mt-3 text-sm text-red-600">{(generateMut.error as any)?.response?.data?.error?.message || 'Failed to generate payroll'}</p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Payroll Records</h3>
          <Button variant="ghost" size="sm" onClick={() => {
            const headers = ['Employee,Department,Basic Salary,Allowances,Deductions,Net Pay,Status'];
            const rows = (payrolls || []).map((p: any) => `${p.employee?.firstName} ${p.employee?.lastName},${p.employee?.department?.name},${p.basicSalary},${p.allowances},${p.deductions},${p.netPay},${p.status}`);
            const csv = [...headers, ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'payroll.csv';
            a.click();
          }}>
            Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-sm text-slate-500">
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3 text-right">Basic</th>
                <th className="px-6 py-3 text-right">Allowances</th>
                <th className="px-6 py-3 text-right">Deductions</th>
                <th className="px-6 py-3 text-right">Net Pay</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(payrolls || []).length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400">No payroll records</td></tr>
              ) : (payrolls || []).map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-slate-800">{p.employee?.firstName} {p.employee?.lastName}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{p.employee?.department?.name}</td>
                  <td className="px-6 py-3 text-sm text-slate-600 text-right">₹{p.basicSalary.toLocaleString()}</td>
                  <td className="px-6 py-3 text-sm text-emerald-600 text-right">+₹{p.allowances.toLocaleString()}</td>
                  <td className="px-6 py-3 text-sm text-red-600 text-right">-₹{p.deductions.toLocaleString()}</td>
                  <td className="px-6 py-3 text-sm font-semibold text-slate-800 text-right">₹{p.netPay.toLocaleString()}</td>
                  <td className="px-6 py-3">
                    <Badge tone={p.status === 'Paid' ? 'success' : p.status === 'Processed' ? 'info' : 'warning'}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-1.5">
                      {p.status !== 'Processed' && p.status !== 'Paid' && (
                        <Button onClick={() => updateStatus.mutate({ id: p.id, status: 'Processed' })} title="Mark Processed" size="sm" variant="secondary" className="bg-blue-50 border-transparent text-blue-700 hover:bg-blue-100">
                          <RefreshCw className="w-3.5 h-3.5" /> Process
                        </Button>
                      )}
                      {p.status !== 'Paid' && (
                        <Button onClick={() => updateStatus.mutate({ id: p.id, status: 'Paid' })} title="Mark Paid" size="sm" variant="secondary" className="bg-emerald-50 border-transparent text-emerald-700 hover:bg-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                        </Button>
                      )}
                      <Button onClick={() => downloadSlip(p.id)} title="Download Salary Slip" size="sm" variant="secondary" className="bg-slate-100 border-transparent text-slate-700 hover:bg-slate-200">
                        <FileDown className="w-3.5 h-3.5" /> Slip
                      </Button>
                    </div>
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
