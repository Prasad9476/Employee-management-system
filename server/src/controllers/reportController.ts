import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import { AppError, asyncHandler } from '../lib/errors';
import { findTenantRecord, getOwnEmployee, requireUser } from '../lib/access';

export const downloadSalarySlip = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const payroll = await prisma.payroll.findFirst({
    where: { id: String(req.params.id), tenantId: user.tenantId },
    include: { employee: { include: { department: true, role: true } } },
  });
  if (!payroll) throw new AppError(404, 'PAYROLL_NOT_FOUND', 'Payroll record not found');

  if (user.role === 'Employee') {
    const own = await getOwnEmployee(user);
    if (!own || own.id !== payroll.employeeId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only download your own payslip');
    }
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=salary-slip-${payroll.employee.employeeId}.pdf`);
  doc.pipe(res);

  doc.fontSize(20).text('Salary Slip', { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Employee: ${payroll.employee.firstName} ${payroll.employee.lastName}`);
  doc.text(`Employee ID: ${payroll.employee.employeeId}`);
  doc.text(`Department: ${payroll.employee.department.name}`);
  doc.text(`Role: ${payroll.employee.role.name}`);
  doc.text(`Month: ${payroll.month.toLocaleString('default', { month: 'long', year: 'numeric' })}`);
  doc.moveDown();
  doc.text(`Basic Salary: ₹${payroll.basicSalary.toFixed(2)}`);
  doc.text(`Allowances: ₹${payroll.allowances.toFixed(2)}`);
  doc.text(`Deductions: ₹${payroll.deductions.toFixed(2)}`);
  doc.moveDown();
  doc.fontSize(14).font('Helvetica-Bold').text(`Net Pay: ₹${payroll.netPay.toFixed(2)}`);
  doc.moveDown(2);
  doc.fontSize(10).text(`Generated on ${new Date().toLocaleDateString()}`, { align: 'right' });
  doc.end();
});
