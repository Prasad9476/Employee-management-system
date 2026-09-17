import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  organizationName: z.string().min(2).max(120),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  organizationName: z.string().min(2).max(120),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32, 'Invalid token'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2).max(80),
  organizationName: z.string().min(2).max(120),
});

export const employeeCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  departmentId: z.string().min(1),
  roleId: z.string().optional(),
  salary: z.coerce.number().positive('salary must be greater than 0'),
  joinDate: z.string().or(z.coerce.date()),
  status: z.enum(['Candidate', 'Onboarding', 'Probation', 'Active', 'Resigned', 'Terminated', 'Inactive', 'OnLeave']).optional(),
  employmentType: z.enum(['FullTime', 'PartTime', 'Contract', 'Intern']).optional(),
  workMode: z.enum(['Onsite', 'Hybrid', 'Remote']).optional(),
  location: z.string().optional(),
  probationEndDate: z.string().optional(),
  managerId: z.string().optional().nullable(),
  skills: z.array(z.string()).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
});

export const employeeUpdateSchema = employeeCreateSchema.partial();

export const leaveApplySchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(['Annual', 'Sick', 'Emergency', 'Maternity']),
  fromDate: z.string().or(z.coerce.date()),
  toDate: z.string().or(z.coerce.date()),
  reason: z.string().min(3),
  isHalfDay: z.boolean().optional(),
}).refine((data) => new Date(data.fromDate) <= new Date(data.toDate), {
  message: 'fromDate must be on or before toDate',
  path: ['toDate'],
});

export const leaveStatusSchema = z.object({
  status: z.enum(['Approved', 'Rejected', 'Pending']),
  approvalComment: z.string().optional(),
});

export const payrollGenerateSchema = z.object({
  employeeId: z.string().min(1),
  month: z.string().optional(),
});

export const payrollStatusSchema = z.object({
  status: z.enum(['Pending', 'Processed', 'Paid']),
});

export const performanceSchema = z.object({
  employeeId: z.string().min(1),
  score: z.coerce.number().min(1).max(5),
  category: z.string().optional(),
  comments: z.string().optional(),
  reviewedBy: z.string().optional(),
});

export const departmentSchema = z.object({
  name: z.string().min(1),
  budget: z.coerce.number().nonnegative().optional(),
  headId: z.string().optional(),
});

export const roleUpdateSchema = z.object({
  role: z.enum(['Admin', 'HR', 'Manager', 'Employee']),
});

export function validate(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues[0]?.message || 'Invalid request';
      return next(new AppError(400, 'VALIDATION_ERROR', message));
    }
    req.body = result.data;
    next();
  };
}
