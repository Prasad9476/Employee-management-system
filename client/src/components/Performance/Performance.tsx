import { usePerformanceReviews } from '../../hooks/useEmployees';
import { Star } from 'lucide-react';
import { Badge, Card, Spinner } from '../ui';

export default function Performance() {
  const { data: reviews, isLoading } = usePerformanceReviews();

  if (isLoading) {
    return <Spinner />;
  }

  const avgScore = reviews?.length ? (reviews.reduce((s: number, r: any) => s + r.score, 0) / reviews.length).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center"><Star className="w-6 h-6 text-amber-600" /></div>
          <div><p className="text-sm text-slate-500">Avg Score</p><p className="text-2xl font-bold text-slate-800">{avgScore}/5.0</p></div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center"><Star className="w-6 h-6 text-blue-600" /></div>
          <div><p className="text-sm text-slate-500">Total Reviews</p><p className="text-2xl font-bold text-slate-800">{reviews?.length || 0}</p></div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center"><Star className="w-6 h-6 text-emerald-600" /></div>
          <div><p className="text-sm text-slate-500">Top Performers</p><p className="text-2xl font-bold text-slate-800">{reviews?.filter((r: any) => r.score >= 4).length || 0}</p></div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800">Performance Reviews</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-sm text-slate-500">
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Score</th>
                <th className="px-6 py-3">Reviewed By</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(reviews || []).length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No reviews yet</td></tr>
              ) : (reviews || []).map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-slate-800">{r.employee?.firstName} {r.employee?.lastName}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{r.employee?.department?.name}</td>
                  <td className="px-6 py-3"><Badge tone="neutral">{r.category}</Badge></td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="flex">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= r.score ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />)}</div>
                      <span className="text-sm font-medium text-slate-700">{r.score}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">{r.reviewedBy}</td>
                  <td className="px-6 py-3 text-sm text-slate-500">{new Date(r.reviewDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
