import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/errors';
import { requireUser } from '../lib/access';

const getMonthLabels = (months: number) => {
  const data: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    data.push(d.toLocaleString('default', { month: 'short', year: 'numeric' }));
  }
  return data;
};

export const getEnhancedDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const tenantId = user.tenantId;
    const today = new Date();
    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 30);

    const [activeEmployees, attendanceSummary, payrollByMonth, departmentCounts, leaveStats, performanceTrend] = await Promise.all([
      prisma.employee.count({ where: { tenantId, status: 'Active' } }),
      prisma.attendance.groupBy({
        by: ['status'],
        where: { tenantId, date: { gte: last30Days } },
        _count: { status: true },
      }),
      prisma.payroll.groupBy({
        by: ['month'],
        where: { tenantId, month: { gte: new Date(today.getFullYear(), today.getMonth() - 5, 1) } },
        _sum: { netPay: true },
        orderBy: { month: 'asc' },
      }),
      prisma.department.findMany({
        where: { tenantId },
        select: {
          name: true,
          _count: { select: { employees: true } },
        },
      }),
      prisma.leave.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
      }),
      prisma.performance.groupBy({
        by: ['reviewDate'],
        where: { tenantId, reviewDate: { gte: new Date(today.getFullYear(), today.getMonth() - 5, 1) } },
        _avg: { score: true },
        orderBy: { reviewDate: 'asc' },
      }),
    ]);

    const attendanceRates = attendanceSummary.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {} as Record<string, number>);

    const payrollSeries = getMonthLabels(6).map((label) => {
      const match = payrollByMonth.find((item) => item.month.toLocaleString('default', { month: 'short', year: 'numeric' }) === label);
      return { month: label, total: match?._sum.netPay ?? 0 };
    });

    const performanceSeries = getMonthLabels(6).map((label) => {
      const match = performanceTrend.find((item) => item.reviewDate.toLocaleString('default', { month: 'short', year: 'numeric' }) === label);
      return { month: label, avgScore: match?._avg.score ?? 0 };
    });

    res.json({
      activeEmployees,
      attendanceRates,
      payrollSeries,
      departmentCounts: departmentCounts.map((item) => ({ department: item.name, count: item._count.employees })),
      leaveStats: leaveStats.map((item) => ({ status: item.status, count: item._count.status })),
      performanceSeries,
    });
});
