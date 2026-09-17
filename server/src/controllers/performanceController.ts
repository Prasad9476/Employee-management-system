import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/errors';
import { assertCanAccessEmployee, requireUser } from '../lib/access';
import { logAction } from '../utils/audit';

export const getPerformanceReviews = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const tenantId = user.tenantId;
  const { employeeId, category } = req.query;
  const where: Record<string, unknown> = { tenantId };
  if (employeeId) {
    await assertCanAccessEmployee(user, String(employeeId));
    where.employeeId = employeeId;
  }
  if (category) where.category = category;

  const reviews = await prisma.performance.findMany({
    where,
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeId: true,
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { reviewDate: 'desc' },
  });
  res.json(reviews);
});

export const createPerformanceReview = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const tenantId = user.tenantId;
  const { employeeId, score, category, comments, reviewedBy } = req.body;
  await assertCanAccessEmployee(user, employeeId);

  const review = await prisma.performance.create({
    data: {
      tenantId,
      employeeId,
      reviewDate: new Date(),
      score: Number(score),
      category,
      comments,
      reviewedBy: reviewedBy || user.name,
    },
    include: {
      employee: {
        select: { firstName: true, lastName: true, employeeId: true },
      },
    },
  });

  await logAction({
    userId: user.id,
    tenantId,
    action: 'Created performance review',
    entity: 'Performance',
    entityId: review.id,
    details: { employeeId, category, score },
  });

  res.status(201).json(review);
});

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const user = requireUser(req.user);
    const tenantId = user.tenantId;
    const [
      totalEmployees,
      activeEmployees,
      onLeaveCount,
      departments,
      pendingLeaves,
      recentEmployees,
      performanceReviews,
    ] = await Promise.all([
      prisma.employee.count({ where: { tenantId } }),
      prisma.employee.count({ where: { tenantId, status: 'Active' } }),
      prisma.employee.count({ where: { tenantId, status: 'OnLeave' } }),
      prisma.department.count({ where: { tenantId } }),
      prisma.leave.count({ where: { tenantId, status: 'Pending' } }),
      prisma.employee.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { department: true, role: true },
      }),
      prisma.performance.aggregate({ where: { tenantId }, _avg: { score: true } }),
    ]);

    res.json({
      totalEmployees,
      activeEmployees,
      onLeaveCount,
      departments,
      pendingLeaves,
      avgPerformance: performanceReviews._avg.score?.toFixed(1) || '0.0',
      recentEmployees,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};
