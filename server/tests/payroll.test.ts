import prisma from '../src/lib/prisma';
import { calculatePayroll } from '../src/services/payrollService';
import {
  api,
  authHeader,
  createDepartment,
  createEmployee,
  registerOrg,
  resetDb,
} from './helpers';

beforeEach(async () => {
  await resetDb();
});

describe('Payroll', () => {
  it('computes a correct breakdown for a salary above the ESI threshold', () => {
    // basic 100000 -> allowances 30% = 30000, gross 130000
    // annual = 130000 * 12 = 1,560,000
    // tax: 0% to 300k, 5% to 600k, 10% to 900k, 15% to 1.2M, 20% to 1.5M, 30% above
    //   = 15000 + 30000 + 45000 + 60000 + (60k*0.30=18000) = 168000 / 12 = 14000/mo
    // pf = 12% of 100000 = 12000, esi = 0 (gross > 21000)
    // deductions = 12000 + 0 + 14000 = 26000, net = 130000 - 26000 = 104000
    const result = calculatePayroll(100000);

    expect(result.basicSalary).toBe(100000);
    expect(result.allowances).toBe(30000);
    expect(result.gross).toBe(130000);
    expect(result.pf).toBe(12000);
    expect(result.esi).toBe(0);
    expect(result.tax).toBe(14000);
    expect(result.deductions).toBe(26000);
    expect(result.netPay).toBe(104000);
  });

  it('applies ESI for low salaries and never returns a negative net pay', () => {
    // basic 15000 -> allowances 4500, gross 19500 (<= 21000 so ESI applies)
    // esi = 19500 * 0.0175 = 341.25
    const result = calculatePayroll(15000);

    expect(result.gross).toBe(19500);
    expect(result.esi).toBe(341.25);
    expect(result.netPay).toBeGreaterThanOrEqual(0);
    expect(result.gross).toBe(result.netPay + result.deductions);
  });

  it('throws for non-positive salary', () => {
    expect(() => calculatePayroll(0)).toThrow();
    expect(() => calculatePayroll(-100)).toThrow();
  });

  it('persists the generated payroll with the same numbers the service returns', async () => {
    const a = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const dept = await createDepartment(a.token, 'Engineering');
    const emp = await createEmployee(a.token, {
      firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', departmentId: dept.id, salary: 100000,
    });

    const res = await api.post('/api/payroll').set(authHeader(a.token)).send({ employeeId: emp.id });
    expect(res.status).toBe(201);

    const expected = calculatePayroll(100000);
    expect(res.body).toMatchObject({
      basicSalary: expected.basicSalary,
      allowances: expected.allowances,
      deductions: expected.deductions,
      netPay: expected.netPay,
      status: 'Pending',
    });
    expect(res.body.breakdown).toBeDefined();
  });

  it('rejects a duplicate payroll for the same employee and month', async () => {
    const a = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const dept = await createDepartment(a.token, 'Engineering');
    const emp = await createEmployee(a.token, {
      firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', departmentId: dept.id, salary: 60000,
    });

    const first = await api.post('/api/payroll').set(authHeader(a.token)).send({ employeeId: emp.id });
    expect(first.status).toBe(201);

    const dup = await api.post('/api/payroll').set(authHeader(a.token)).send({ employeeId: emp.id });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('PAYROLL_DUPLICATE');
  });

  it('scopes payroll generation to the caller tenant', async () => {
    const a = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const b = await registerOrg('Globex', 'admin@globex.com', 'Secret1234');
    const deptA = await createDepartment(a.token, 'Engineering');
    const empA = await createEmployee(a.token, {
      firstName: 'Gene', lastName: 'One', email: 'gene@acme.com', departmentId: deptA.id, salary: 50000,
    });

    const cross = await api
      .post('/api/payroll')
      .set(authHeader(b.token))
      .send({ employeeId: empA.id });
    // Cross-tenant lookup fails closed (404 not found within caller's tenant).
    expect(cross.status).toBe(404);
  });
});
