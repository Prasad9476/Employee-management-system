import { Users, Briefcase, CalendarClock, TrendingUp, ArrowUpRight, Clock } from 'lucide-react';
import { useDashboardStats, useDashboardAnalytics } from '../../hooks/useEmployees';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { Badge, Card } from '../ui';

function BarChartRow({ label, value, max, color = 'bg-blue-500' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-slate-500 truncate text-right shrink-0">{label}</span>
      <div className="flex-1 h-4 rounded-md bg-slate-100 overflow-hidden">
        <div className={`h-full ${color} rounded-md transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-xs font-semibold text-slate-700 shrink-0">{value}</span>
    </div>
  );
}

function statusTone(status: string) {
  if (status === 'Active') return 'success' as const;
  if (status === 'OnLeave') return 'warning' as const;
  return 'danger' as const;
}

export default function Dashboard() {
  const { data, isLoading } = useDashboardStats();
  const { data: analytics } = useDashboardAnalytics();
  const { user } = useAuth();
  const isStaff = user?.role === 'Admin' || user?.role === 'HR' || user?.role === 'Manager';

  const maxDept = Math.max(1, ...(analytics?.departmentCounts || []).map((d: any) => d.count));
  const maxAtt = Math.max(1, ...Object.values(analytics?.attendanceRates || {}).map((v: any) => Number(v)));
  const maxPay = Math.max(1, ...(analytics?.payrollSeries || []).map((p: any) => p.total));
  const maxPerf = Math.max(1, ...(analytics?.performanceSeries || []).map((p: any) => p.avgScore));

  const stats = [
    { label: 'Total Employees', value: data?.totalEmployees ?? '—', sub: `${data?.activeEmployees ?? 0} active`, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Departments', value: data?.departments ?? '—', sub: 'Across org', icon: Briefcase, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'On Leave', value: data?.onLeaveCount ?? '—', sub: `${data?.pendingLeaves ?? 0} pending`, icon: CalendarClock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Avg Performance', value: data?.avgPerformance ?? '—', sub: 'Out of 5.0', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white rounded-2xl p-6 border border-slate-100 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
            <div className="h-8 bg-slate-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                  <h3 className="text-3xl font-bold text-slate-800">{stat.value}</h3>
                  <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-slate-800">Recent Employees</h3>
            <Link to="/employees" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {(data?.recentEmployees || []).map((emp: any) => (
              <div key={emp.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-semibold text-sm">
                  {emp.firstName[0]}{emp.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{emp.firstName} {emp.lastName}</p>
                  <p className="text-xs text-slate-500">{emp.department?.name} · {emp.role?.name}</p>
                </div>
                <Badge tone={statusTone(emp.status)}>{emp.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-5">Quick Actions</h3>
          <div className="space-y-3">
            <Link to="/employees" className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium flex items-center gap-2 justify-center">
              <Users className="w-4 h-4" /> View Employees
            </Link>
            <Link to="/attendance" className="w-full py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-medium flex items-center gap-2 justify-center">
              <Clock className="w-4 h-4" /> Attendance
            </Link>
            <Link to="/leaves" className="w-full py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-medium flex items-center gap-2 justify-center">
              <CalendarClock className="w-4 h-4" /> Leaves
            </Link>
            <Link to="/me" className="w-full py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-medium flex items-center gap-2 justify-center">
              <Briefcase className="w-4 h-4" /> My Portal
            </Link>
          </div>
        </Card>
      </div>

      {/* Analytics */}
      {isStaff && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-5">Employee Distribution by Department</h3>
            <div className="space-y-3">
              {(analytics?.departmentCounts || []).length === 0 ? (
                <p className="text-sm text-slate-400">No departments yet</p>
              ) : (analytics?.departmentCounts || []).map((d: any) => (
                <BarChartRow key={d.department} label={d.department} value={d.count} max={maxDept} color="bg-indigo-500" />
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-5">Attendance (Last 30 Days)</h3>
            <div className="space-y-3">
              {(analytics?.attendanceRates || {}) && ['Present', 'Late', 'Absent'].map((s) =>
                <BarChartRow key={s} label={s} value={Number(analytics?.attendanceRates?.[s] ?? 0)} max={maxAtt}
                  color={s === 'Present' ? 'bg-emerald-500' : s === 'Late' ? 'bg-amber-500' : 'bg-red-500'} />
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-5">Payroll Trend (6 Months)</h3>
            <div className="space-y-3">
              {(analytics?.payrollSeries || []).map((p: any) => (
                <BarChartRow key={p.month} label={p.month} value={Math.round(p.total)} max={maxPay} color="bg-blue-500" />
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-5">Performance Trend (6 Months)</h3>
            <div className="space-y-3">
              {(analytics?.performanceSeries || []).map((p: any) => (
                <BarChartRow key={p.month} label={p.month} value={Math.round(p.avgScore * 10) / 10} max={maxPerf} color="bg-amber-500" />
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}