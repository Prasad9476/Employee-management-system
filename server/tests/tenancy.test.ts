import prisma from '../src/lib/prisma';
import {
  api,
  authHeader,
  createDepartment,
  createEmployee,
  login,
  registerOrg,
  resetDb,
  setPassword,
} from './helpers';

beforeEach(async () => {
  await resetDb();
});

/** Activates an API-created employee (known password + cleared mustChangePassword) and logs in. */
async function activateEmployee(email: string, org: string) {
  const user = await prisma.user.findFirst({ where: { email } });
  await setPassword(user!.id, 'StartPass1');
  const session = await login(email, 'StartPass1', org);
  const res = await api
    .post('/api/auth/change-password')
    .set(authHeader(session.token))
    .send({ currentPassword: 'StartPass1', newPassword: 'FinalPass1' });
  expect(res.status).toBe(200);
  return { user: user!, token: session.token };
}

describe('Tenant isolation & RBAC', () => {
  it('keeps employee lists fully isolated between tenants', async () => {
    const a = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const b = await registerOrg('Globex', 'admin@globex.com', 'Secret1234');

    const deptA = await createDepartment(a.token, 'Engineering');
    const empA = await createEmployee(a.token, {
      firstName: 'Gene',
      lastName: 'One',
      email: 'gene@acme.com',
      departmentId: deptA.id,
      salary: 50000,
    });

    const listB = await api.get('/api/employees').set(authHeader(b.token));
    expect(listB.status).toBe(200);
    expect(listB.body.total).toBe(0);
    expect(listB.body.employees).toEqual([]);

    const listA = await api.get('/api/employees').set(authHeader(a.token));
    expect(listA.status).toBe(200);
    expect(listA.body.total).toBe(1);
    expect(listA.body.page).toBe(1);
    expect(listA.body.employees[0].id).toBe(empA.id);
  });

  it('prevents one tenant from reading another tenant employee', async () => {
    const a = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const b = await registerOrg('Globex', 'admin@globex.com', 'Secret1234');
    const deptA = await createDepartment(a.token, 'Engineering');
    const empA = await createEmployee(a.token, {
      firstName: 'Gene',
      lastName: 'One',
      email: 'gene@acme.com',
      departmentId: deptA.id,
      salary: 50000,
    });

    const cross = await api.get(`/api/employees/${empA.id}`).set(authHeader(b.token));
    // 403 (forbidden) or 404 (not found within caller's tenant) both prove the
    // cross-tenant record is never returned. 404 is preferred as it avoids leaking
    // whether the id exists at all.
    expect([403, 404]).toContain(cross.status);
  });

  it('allows the same email across tenants but not twice inside one tenant', async () => {
    const a = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const b = await registerOrg('Globex', 'admin@globex.com', 'Secret1234');
    const deptA = await createDepartment(a.token, 'Engineering');
    const deptB = await createDepartment(b.token, 'Sales');

    const inA = await createEmployee(a.token, {
      firstName: 'Gene', lastName: 'One', email: 'gene@acme.com', departmentId: deptA.id, salary: 50000,
    });
    const inB = await createEmployee(b.token, {
      firstName: 'Gene', lastName: 'Two', email: 'gene@acme.com', departmentId: deptB.id, salary: 40000,
    });
    expect(inA.id).not.toBe(inB.id);

    const dup = await api
      .post('/api/employees')
      .set(authHeader(b.token))
      .send({ firstName: 'Gene2', lastName: 'Two', email: 'gene@acme.com', departmentId: deptB.id, salary: 45000, joinDate: '2025-01-01' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('resets the per-tenant employee counter and never duplicates IDs', async () => {
    const a = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const b = await registerOrg('Globex', 'admin@globex.com', 'Secret1234');
    const deptA = await createDepartment(a.token, 'Engineering');
    const deptB = await createDepartment(b.token, 'Sales');

    const [one, two] = await Promise.all([
      createEmployee(a.token, { firstName: 'One', lastName: 'A', email: 'one@acme.com', departmentId: deptA.id, salary: 100 }),
      createEmployee(a.token, { firstName: 'Two', lastName: 'A', email: 'two@acme.com', departmentId: deptA.id, salary: 100 }),
    ]);

    const bEmp = await createEmployee(b.token, {
      firstName: 'Bee', lastName: 'B', email: 'bee@globex.com', departmentId: deptB.id, salary: 100,
    });

    expect([one.employeeId, two.employeeId].sort()).toEqual(['EMP-001', 'EMP-002']);
    expect(bEmp.employeeId).toBe('EMP-001');
  });

  it('blocks an Employee from creating accounts and editing other employees', async () => {
    const a = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const dept = await createDepartment(a.token, 'Engineering');
    const emp1 = await createEmployee(a.token, {
      firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', departmentId: dept.id, salary: 50000,
    });
    const emp2 = await createEmployee(a.token, {
      firstName: 'John', lastName: 'Roe', email: 'john@acme.com', departmentId: dept.id, salary: 40000,
    });
    const session = await activateEmployee('jane@acme.com', 'Acme Corp');

    const create = await api
      .post('/api/employees')
      .set(authHeader(session.token))
      .send({ firstName: 'Hax', lastName: 'X', email: 'hax@acme.com', departmentId: dept.id, salary: 1, joinDate: '2025-01-01' });
    expect(create.status).toBe(403);

    const editOther = await api
      .put(`/api/employees/${emp2.id}`)
      .set(authHeader(session.token))
      .send({ phone: '999' });
    expect(editOther.status).toBe(403);

    const editSelf = await api
      .patch(`/api/employees/${emp1.id}/skills`)
      .set(authHeader(session.token))
      .send({ skills: ['typescript', 'react'] });
    expect(editSelf.status).toBe(200);

    const patchOther = await api
      .patch(`/api/employees/${emp2.id}/skills`)
      .set(authHeader(session.token))
      .send({ skills: ['evil'] });
    expect(patchOther.status).toBe(403);

    const audit = await api.get('/api/audit').set(authHeader(session.token));
    expect(audit.status).toBe(403);
  });

  it('gives the Employee their own salary slip but blocks others and other tenants', async () => {
    const a = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const b = await registerOrg('Globex', 'admin@globex.com', 'Secret1234');
    const deptA = await createDepartment(a.token, 'Engineering');
    const emp1 = await createEmployee(a.token, {
      firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', departmentId: deptA.id, salary: 60000,
    });
    const emp2 = await createEmployee(a.token, {
      firstName: 'John', lastName: 'Roe', email: 'john@acme.com', departmentId: deptA.id, salary: 50000,
    });

    const payrollRes = await api.post('/api/payroll').set(authHeader(a.token)).send({ employeeId: emp1.id });
    expect(payrollRes.status).toBe(201);
    const payrollId = payrollRes.body.id;

    const jane = await activateEmployee('jane@acme.com', 'Acme Corp');
    const own = await api.get(`/api/payroll/${payrollId}/salary-slip`).set(authHeader(jane.token));
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toContain('application/pdf');

    const john = await activateEmployee('john@acme.com', 'Acme Corp');
    const others = await api.get(`/api/payroll/${payrollId}/salary-slip`).set(authHeader(john.token));
    expect(others.status).toBe(403);

    const otherTenant = await api.get(`/api/payroll/${payrollId}/salary-slip`).set(authHeader(b.token));
    expect(otherTenant.status).toBe(404);
  });

  it('paginates leaves and returns balances in the new shape', async () => {
    const a = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const b = await registerOrg('Globex', 'admin@globex.com', 'Secret1234');
    const deptA = await createDepartment(a.token, 'Engineering');
    const emp = await createEmployee(a.token, {
      firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', departmentId: deptA.id, salary: 50000,
    });

    const apply = await api.post('/api/leaves').set(authHeader(a.token)).send({
      employeeId: emp.id,
      type: 'Annual',
      fromDate: '2026-06-01',
      toDate: '2026-06-03',
      reason: 'Vacation',
    });
    expect(apply.status).toBe(201);

    const leaves = await api.get('/api/leaves').set(authHeader(a.token));
    expect(leaves.status).toBe(200);
    expect(leaves.body.total).toBe(1);
    expect(leaves.body.leaves).toHaveLength(1);
    expect(leaves.body.leaves[0].status).toBe('Pending');
    expect(Array.isArray(leaves.body.balances)).toBe(true);
    expect(leaves.body.balances[0]).toHaveProperty('remaining');

    const otherTenant = await api.get('/api/leaves').set(authHeader(b.token));
    expect(otherTenant.body.total).toBe(0);
  });
});