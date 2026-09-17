import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma';
import {
  api,
  authHeader,
  createDepartment,
  createEmployee,
  issueAuthToken,
  login,
  registerOrg,
  resetDb,
} from './helpers';

beforeEach(async () => {
  await resetDb();
});

describe('Auth', () => {
  it('reports health OK', async () => {
    const res = await api.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('requires organizationName on login', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('registers an organization and logs in with the correct org', async () => {
    await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const ok = await login('admin@acme.com', 'Secret1234', 'Acme Corp');
    expect(ok.res.status).toBe(200);
    expect(ok.token).toBeTruthy();
    expect(ok.user.role).toBe('Admin');
    expect(ok.user.tenantId).toBeTruthy();
  });

  it('rejects a valid email/password when the wrong org is supplied', async () => {
    await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const dup = await login('admin@acme.com', 'Secret1234', 'Acme Copr');
    expect(dup.res.status).toBe(401);
    expect(dup.res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('does not let the same email in two orgs log in with the wrong org (cross-tenant fix)', async () => {
    await registerOrg('Acme Corp', 'shared@acme.com', 'Secret1234');
    await registerOrg('Globex', 'shared@acme.com', 'Secret1234');

    const asAcme = await login('shared@acme.com', 'Secret1234', 'Acme Corp');
    expect(asAcme.res.status).toBe(200);
    expect(asAcme.user.tenantId).toBeTruthy();

    const asGlobex = await login('shared@acme.com', 'Secret1234', 'Globex');
    expect(asGlobex.res.status).toBe(200);
    expect(asGlobex.user.tenantId).not.toBe(asAcme.user.tenantId);
  });

  it('rejects duplicate organization names', async () => {
    await registerOrg('Acme Corp', 'a@acme.com', 'Secret1234');
    const dup = await api.post('/api/auth/register').send({ organizationName: 'Acme Corp', email: 'b@acme.com', password: 'Secret1234', name: 'B Admin' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ORG_EXISTS');
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const created = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');

    const first = await api.post('/api/auth/refresh').set('Cookie', created.cookie);
    expect(first.status).toBe(200);
    expect(first.body.token).toBeTruthy();
    const rotatedCookie = first.headers['set-cookie'] as unknown as string[];

    const reuse = await api.post('/api/auth/refresh').set('Cookie', created.cookie);
    expect(reuse.status).toBe(401);

    const second = await api.post('/api/auth/refresh').set('Cookie', rotatedCookie);
    expect(second.status).toBe(200);
  });

  it('revokes the refresh token on logout', async () => {
    const created = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    await api.post('/api/auth/logout').set('Cookie', created.cookie);
    const refresh = await api.post('/api/auth/refresh').set('Cookie', created.cookie);
    expect(refresh.status).toBe(401);
  });

  it('rejects a wrong current password and lets the user change password', async () => {
    const created = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');

    const wrong = await api
      .post('/api/auth/change-password')
      .set(authHeader(created.token))
      .send({ currentPassword: 'nope', newPassword: 'NewPass123' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('WRONG_PASSWORD');

    const ok = await api
      .post('/api/auth/change-password')
      .set(authHeader(created.token))
      .send({ currentPassword: 'Secret1234', newPassword: 'NewPass123' });
    expect(ok.status).toBe(200);

    const oldPw = await login('admin@acme.com', 'Secret1234', 'Acme Corp');
    expect(oldPw.res.status).toBe(401);
    const newPw = await login('admin@acme.com', 'NewPass123', 'Acme Corp');
    expect(newPw.res.status).toBe(200);
  });

  it('rejects all protected routes until the forced password change is done', async () => {
    const created = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    await prisma.user.create({
      data: {
        email: 'gated@acme.com',
        password: await bcrypt.hash('TempPass123', 4),
        name: 'Gated User',
        role: 'Employee',
        tenantId: created.user.tenantId,
        mustChangePassword: true,
      },
    });

    const gate = await login('gated@acme.com', 'TempPass123', 'Acme Corp');
    expect(gate.res.status).toBe(200);

    const blocked = await api.get('/api/employees').set(authHeader(gate.token));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const changed = await api
      .post('/api/auth/change-password')
      .set(authHeader(gate.token))
      .send({ currentPassword: 'TempPass123', newPassword: 'NowUnlocked1' });
    expect(changed.status).toBe(200);

    const allowed = await api.get('/api/employees').set(authHeader(gate.token));
    expect(allowed.status).toBe(200);
  });

  it('resets a forgotten password with a RESET token', async () => {
    const created = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');

    const forgot = await api
      .post('/api/auth/forgot-password')
      .send({ email: 'admin@acme.com', organizationName: 'Acme Corp' });
    expect(forgot.status).toBe(200);

    const token = await issueAuthToken(created.user.id, 'RESET');
    const reset = await api.post('/api/auth/reset-password').send({ token, password: 'BrandNew99' });
    expect(reset.status).toBe(200);

    const fresh = await login('admin@acme.com', 'BrandNew99', 'Acme Corp');
    expect(fresh.res.status).toBe(200);
    const stale = await login('admin@acme.com', 'Secret1234', 'Acme Corp');
    expect(stale.res.status).toBe(401);
  });

  it('activates an invited employee via the INVITE token and clears mustChangePassword', async () => {
    const admin = await registerOrg('Acme Corp', 'admin@acme.com', 'Secret1234');
    const dept = await createDepartment(admin.token, 'Engineering');
    const emp = await createEmployee(admin.token, {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@acme.com',
      departmentId: dept.id,
      salary: 60000,
    });

    expect(emp.employeeId).toBe('EMP-001');
    const user = await prisma.user.findFirst({ where: { email: 'jane@acme.com' } });
    expect(user?.mustChangePassword).toBe(true);
    expect(user?.role).toBe('Employee');

    const inviteToken = await issueAuthToken(user!.id, 'INVITE');
    const reset = await api.post('/api/auth/reset-password').send({ token: inviteToken, password: 'MyNewPass1' });
    expect(reset.status).toBe(200);

    const session = await login('jane@acme.com', 'MyNewPass1', 'Acme Corp');
    expect(session.res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: user!.id } });
    expect(after?.mustChangePassword).toBe(false);
  });

  it('rejects invalid or expired reset tokens', async () => {
    const bad = await api.post('/api/auth/reset-password').send({ token: 'a'.repeat(40), password: 'NewPass123' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_RESET_TOKEN');
  });
});