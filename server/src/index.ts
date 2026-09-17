import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { loginLimiter, registerLimiter, forgotLimiter } from './lib/rateLimit';

import { errorHandler } from './middleware/errorHandler';
import { authenticate, authorize, requirePasswordChanged } from './middleware/auth';
import {
  login,
  register,
  refresh,
  logout,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
} from './controllers/authController';
import { getEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee } from './controllers/employeeController';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from './controllers/departmentController';
import { getAttendance, getTodayAttendance, checkIn, checkOut } from './controllers/attendanceController';
import { getLeaves, applyLeave, updateLeaveStatus, deleteLeave } from './controllers/leaveController';
import { getPayrolls, generatePayroll, updatePayrollStatus } from './controllers/payrollController';
import { getPerformanceReviews, createPerformanceReview, getDashboardStats } from './controllers/performanceController';
import { uploadAvatar, uploadResume, uploadDocuments, updateEmployeeSkills } from './controllers/uploadController';
import { getNotifications, markNotificationRead } from './controllers/notificationController';
import { getAuditLogs } from './controllers/auditController';
import { downloadSalarySlip } from './controllers/reportController';
import { getEnhancedDashboardStats } from './controllers/dashboardController';
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  leaveApplySchema,
  leaveStatusSchema,
  payrollGenerateSchema,
  payrollStatusSchema,
  performanceSchema,
  departmentSchema,
  validate,
} from './validation/schemas';

const app = express();
const PORT = process.env.PORT || 4000;

// Trust the first proxy hop (Render/nginx load balancer). Lets rate limiting
// and audit logs see the real client IP from X-Forwarded-For instead of the
// balancer's IP (otherwise every user on the platform would share one bucket).
app.set('trust proxy', 1);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: CLIENT_URL.split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Brute-force / credential-stuffing defense on public auth endpoints.

// --- Auth routes (public) ---
const authRouter = express.Router();
authRouter.post('/login', loginLimiter, validate(loginSchema), login);
authRouter.post('/register', registerLimiter, validate(registerSchema), register);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.post('/forgot-password', forgotLimiter, validate(forgotPasswordSchema), forgotPassword);
authRouter.post('/reset-password', forgotLimiter, validate(resetPasswordSchema), resetPassword);
authRouter.get('/me', authenticate, getMe);
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);
app.use('/api/auth', authRouter);

// --- Protected API routes ---
const api = express.Router();
api.use(authenticate, requirePasswordChanged);

// Dashboard
api.get('/dashboard/stats', getDashboardStats);
api.get('/dashboard/analytics', getEnhancedDashboardStats);

// Employees
api.get('/employees', getEmployees);
api.get('/employees/:id', getEmployee);
api.post('/employees', authorize('Admin', 'Manager', 'HR'), validate(employeeCreateSchema), createEmployee);
api.put('/employees/:id', authorize('Admin', 'Manager', 'HR'), validate(employeeUpdateSchema), updateEmployee);
api.delete('/employees/:id', authorize('Admin'), deleteEmployee);
api.post('/employees/:id/avatar', authorize('Admin', 'Manager', 'HR'), uploadAvatar);
api.post('/employees/:id/resume', authorize('Admin', 'Manager', 'HR'), uploadResume);
api.post('/employees/:id/documents', authorize('Admin', 'Manager', 'HR'), uploadDocuments);
api.patch('/employees/:id/skills', authorize('Admin', 'Manager', 'HR', 'Employee'), updateEmployeeSkills);

// Departments
api.get('/departments', getDepartments);
api.post('/departments', authorize('Admin', 'Manager'), validate(departmentSchema), createDepartment);
api.put('/departments/:id', authorize('Admin', 'Manager'), validate(departmentSchema.partial()), updateDepartment);
api.delete('/departments/:id', authorize('Admin'), deleteDepartment);

// Attendance
api.get('/attendance', getAttendance);
api.get('/attendance/today', getTodayAttendance);
api.post('/attendance/checkin', checkIn);
api.post('/attendance/checkout', checkOut);

// Leaves
api.get('/leaves', getLeaves);
api.post('/leaves', validate(leaveApplySchema), applyLeave);
api.put('/leaves/:id', authorize('Admin', 'Manager'), validate(leaveStatusSchema), updateLeaveStatus);
api.delete('/leaves/:id', authorize('Admin', 'Manager'), deleteLeave);

// Payroll
api.get('/payroll', getPayrolls);
api.post('/payroll', authorize('Admin', 'Manager', 'HR'), validate(payrollGenerateSchema), generatePayroll);
api.put('/payroll/:id', authorize('Admin', 'Manager', 'HR'), validate(payrollStatusSchema), updatePayrollStatus);
api.get('/payroll/:id/salary-slip', authorize('Admin', 'Manager', 'HR', 'Employee'), downloadSalarySlip);

// Notifications
api.get('/notifications', getNotifications);
api.put('/notifications/:id/read', markNotificationRead);

// Audit Logs
api.get('/audit', authorize('Admin', 'HR'), getAuditLogs);

// Performance
api.get('/performance', getPerformanceReviews);
api.post('/performance', authorize('Admin', 'Manager'), validate(performanceSchema), createPerformanceReview);

app.use('/api', api);

app.use(errorHandler);

export default app;