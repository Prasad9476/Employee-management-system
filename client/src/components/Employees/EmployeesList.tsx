import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, X, ChevronRight } from 'lucide-react';
import { useEmployees, useDepartments, useCreateEmployee } from '../../hooks/useEmployees';
import { Badge, Button, Card, Field, Input, Select } from '../ui';

export default function EmployeesList() {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useEmployees({ search });
  const { data: departments } = useDepartments();
  const createMut = useCreateEmployee();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', departmentId: '', roleId: '', salary: '', joinDate: '' });

  const employees = data?.employees || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMut.mutateAsync(form);
    setShowAdd(false);
    setForm({ firstName: '', lastName: '', email: '', phone: '', departmentId: '', roleId: '', salary: '', joinDate: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text" placeholder="Search employees..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => {
            const headers = ['ID,First Name,Last Name,Email,Department,Role,Status'];
            const rows = employees.map((e: any) => `${e.employeeId},${e.firstName},${e.lastName},${e.email},${e.department?.name},${e.role?.name},${e.status}`);
            const csv = [...headers, ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'employees.csv';
            a.click();
          }}>
            Export CSV
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Add Employee
          </Button>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add New Employee</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name">
                  <Input required placeholder="First Name" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} />
                </Field>
                <Field label="Last Name">
                  <Input required placeholder="Last Name" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} />
                </Field>
              </div>
              <Field label="Email">
                <Input required type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </Field>
              <Field label="Phone">
                <Input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </Field>
              <Field label="Department">
                <Select required value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})}>
                  <option value="">Select Department</option>
                  {(departments || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Salary">
                  <Input required type="number" placeholder="Salary" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} />
                </Field>
                <Field label="Join Date">
                  <Input required type="date" value={form.joinDate} onChange={e => setForm({...form, joinDate: e.target.value})} />
                </Field>
              </div>
              <Button type="submit" loading={createMut.isPending} className="w-full">
                {createMut.isPending ? 'Creating...' : 'Create Employee'}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-sm font-medium text-slate-500">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">Loading...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No employees found</td></tr>
              ) : employees.map((emp: any) => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <Link to={`/employees/${emp.id}`} className="flex items-center gap-3 group">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-medium text-sm">
                        {emp.firstName[0]}{emp.lastName[0]}
                      </div>
                      <div className="font-medium text-slate-800 group-hover:text-blue-600 group-hover:underline underline-offset-2">{emp.firstName} {emp.lastName}</div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{emp.employeeId}</td>
                  <td className="px-6 py-4"><Badge tone="neutral">{emp.department?.name}</Badge></td>
                  <td className="px-6 py-4 text-sm text-slate-600">{emp.role?.name}</td>
                  <td className="px-6 py-4">
                    <Badge tone={emp.status === 'Active' ? 'success' : emp.status === 'OnLeave' ? 'warning' : 'danger'}>
                      <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'Active' ? 'bg-emerald-500' : emp.status === 'OnLeave' ? 'bg-amber-500' : 'bg-red-500'}`} />
                      {emp.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.total > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 text-sm text-slate-500">
            Showing {employees.length} of {data.total} employees
          </div>
        )}
      </Card>
    </div>
  );
}
