import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { applyIdScope, assertCanAccessEmployee, findTenantRecord, isHrOrAdmin, requireUser, scopedEmployeeIds } from '../lib/access';
import { endOfMonth, startOfMonth } from '../lib/dates';
import { pagination } from '../lib/pagination';
import { calculatePayroll } from '../services/payrollService';
import { notifyUser } from '../services/notificationService';
import { logAction } from '../utils/audit';
import { Prisma } from '@prisma/client';

const payrollInclude = {
  employee: { select: { firstName: true, lastName: true, employeeId: true, department: { select: { name: true } } } },
} satisfies Prisma.PayrollInclude;

export const getPayrolls = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const { employeeId, status, month } = req.query;
  const { page, limit, skip } = pagination(req.query);
  const ids = await scopedEmployeeIds(user);

  if (user.role === 'Manager' && !isHrOrAdmin(user.role)) {
    // Managers do not see team payroll — only their own payslip.
    const ownIds = ids ? [ids[0]] : [];
    const where = applyIdScope({ tenantId: user.tenantId } as Record<string, unknown>, ownIds);
    const [total, payrolls] = await Promise.all([
      prisma.payroll.count({ where }),
      prisma.payroll.findMany({
        where,
        include: payrollInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return res.json({ total, page, limit, payrolls });
  }

  const where: Record<string, unknown> = applyIdScope({ tenantId: user.tenantId }, ids);
  if (employeeId) {
    await assertCanAccessEmployee(user, String(employeeId));
    where.employeeId = String(employeeId);
  }
  if (status) where.status = status;
  if (month) {
    const d = new Date(String(month));
    where.month = { gte: startOfMonth(d), lt: endOfMonth(d) };
  }

  const [total, payrolls] = await Promise.all([
    prisma.payroll.count({ where }),
    prisma.payroll.findMany({
      where,
      include: payrollInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);
  res.json({ total, page, limit, payrolls });
};

export const generatePayroll = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const { employeeId, month } = req.body;
  const employee = await findTenantRecord<{ salary: number }, { id: string; tenantId: string }>(
    prisma.employee,
    { id: employeeId, tenantId: user.tenantId },
    { code: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found' },
  );

  const monthStart = startOfMonth(month ? new Date(month) : new Date());
  const monthEnd = endOfMonth(monthStart);

  const existing = await prisma.payroll.findFirst({
    where: { tenantId: user.tenantId, employeeId, month: { gte: monthStart, lt: monthEnd } },
  });
  if (existing) {
    throw new AppError(409, 'PAYROLL_DUPLICATE', 'Payroll already generated for this employee for that month');
  }

  const calc = calculatePayroll(employee.salary);

  try {
    const payroll = await prisma.payroll.create({
      data: {
        tenantId: user.tenantId,
        employeeId,
        month: monthStart,
        basicSalary: calc.basicSalary,
        allowances: calc.allowances,
        deductions: calc.deductions,
        netPay: calc.netPay,
        status: 'Pending',
      },
      include: { employee: { select: { firstName: true, lastName: true, employeeId: true, userId: true } } },
    });

    await logAction({
      userId: user.id,
      tenantId: user.tenantId,
      action: 'Generated payroll',
      entity: 'Payroll',
      entityId: payroll.id,
      details: { employeeId, netPay: calc.netPay, month: monthStart },
    });

    if (payroll.employee.userId) {
      await notifyUser(
        payroll.employee.userId,
        user.tenantId,
        'PAYSLIP_AVAILABLE',
        `Payslip for ${monthStart.toLocaleString('default', { month: 'long', year: 'numeric' })} is available`,
        { payrollId: payroll.id },
      );
    }

    res.status(201).json({ ...payroll, breakdown: calc });
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === 'P2002') {
      throw new AppError(409, 'PAYROLL_DUPLICATE', 'Payroll already generated for this employee for that month');
    }
    throw error;
  }
};

export const updatePayrollStatus = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const { status } = req.body;

  const payroll = await prisma.payroll.updateMany({
    where: { id: String(req.params.id), tenantId: user.tenantId },
    data: { status },
  });
  if (payroll.count === 0) throw new AppError(404, 'PAYROLL_NOT_FOUND', 'Payroll record not found');

  const updatedPayroll = await prisma.payroll.findFirst({
    where: { id: String(req.params.id), tenantId: user.tenantId },
  });

  await logAction({
    userId: user.id,
    tenantId: user.tenantId,
    action: `Payroll marked ${status}`,
    entity: 'Payroll',
    entityId: String(req.params.id),
  });

  res.json(updatedPayroll);
};
