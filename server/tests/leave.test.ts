import prisma from '../src/lib/prisma';
import {
  api,
  authHeader,
  createDepartment,
  createEmployee,
  login,
  registerOrg,
  resetDb,
} from './helpers';

beforeEach(async () => {
  await resetDb();
});

async function setup(payload: { salary?: number; email?: string } = {}) {
  const created = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
  const dept = await createDepartment(created.token, 'Engineering');
  const emp = await createEmployee(created.token, {
    firstName: 'Jane',
    lastName: 'Doe',
    email: payload.email || 'jane@acme.com',
    departmentId: dept.id,
    salary: payload.salary ?? 50000,
  });

  // control the Annual balance (employee creation seeds a default of 12)
  await prisma.leaveBalance.updateMany({
    where: { employeeId: emp.id, type: 'Annual' },
    data: { allocated: 10, used: 0 },
  });

  return { created, dept, emp };
}

function applyLeave(token: string, employeeId: string, fromDate: string, toDate: string, type = 'Annual') {
  return api
    .post('/api/leaves')
    .set(authHeader(token))
    .send({ employeeId, type, fromDate, toDate, reason: 'Vacation' });
}

describe('Leave business rules', () => {
  it('rejects an overlapping pending leave request', async () => {
    const { created, emp } = await setup();
    const first = await applyLeave(created.token, emp.id, '2026-06-01', '2026-06-05');
    expect(first.status).toBe(201);

    const overlap = await applyLeave(created.token, emp.id, '2026-06-04', '2026-06-07');
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('LEAVE_OVERLAP');

    // but a non-overlapping request is allowed
    const ok = await applyLeave(created.token, emp.id, '2026-06-08', '2026-06-09');
    expect(ok.status).toBe(201);
  });

  it('rejects leave exceeding the available balance', async () => {
    const { created, emp } = await setup();
    const res = await applyLeave(created.token, emp.id, '2026-06-01', '2026-06-30'); // 30 days > 10
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });

  it('deducts from the balance only when a request is approved', async () => {
    const { created, emp } = await setup();
    const req = await applyLeave(created.token, emp.id, '2026-06-01', '2026-06-03'); // 3 days
    expect(req.status).toBe(201);
    const leaveId = req.body.id;

    // still pending -> balance untouched
    let balance = await prisma.leaveBalance.findFirst({ where: { employeeId: emp.id, type: 'Annual' } });
    expect(balance!.used).toBe(0);

    const approve = await api
      .put(`/api/leaves/${leaveId}`)
      .set(authHeader(created.token))
      .send({ status: 'Approved' });
    expect(approve.status).toBe(200);

    balance = await prisma.leaveBalance.findFirst({ where: { employeeId: emp.id, type: 'Annual' } });
    expect(balance!.used).toBe(3);
  });

  it('does not deduct on rejection', async () => {
    const { created, emp } = await setup();
    const req = await applyLeave(created.token, emp.id, '2026-06-01', '2026-06-03'); // 3 days
    const leaveId = req.body.id;

    const reject = await api
      .put(`/api/leaves/${leaveId}`)
      .set(authHeader(created.token))
      .send({ status: 'Rejected', approvalComment: 'No' });
    expect(reject.status).toBe(200);

    const balance = await prisma.leaveBalance.findFirst({ where: { employeeId: emp.id, type: 'Annual' } });
    expect(balance!.used).toBe(0);
  });

  it('does not double-deduct when an already-approved leave is updated to approved again', async () => {
    const { created, emp } = await setup();
    const req = await applyLeave(created.token, emp.id, '2026-06-01', '2026-06-03'); // 3 days
    const leaveId = req.body.id;

    await api.patch(`/api/leaves/${leaveId}/status`).set(authHeader(created.token)).send({ status: 'Approved' });
    const again = await api
      .put(`/api/leaves/${leaveId}`)
      .set(authHeader(created.token))
      .send({ status: 'Approved' });

    expect(again.status).toBe(200);
    const balance = await prisma.leaveBalance.findFirst({ where: { employeeId: emp.id, type: 'Annual' } });
    expect(balance!.used).toBe(3);
  });
});
