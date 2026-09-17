import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculatePayroll } from '../src/services/payrollService';

const prisma = new PrismaClient();async function main() {
  console.log('🌱 Seeding database...');

  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.performance.deleteMany();
  await prisma.payroll.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.authToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.role.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employeeCounter.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({ data: { name: 'Default Company', domain: 'default.company' } });

  const adminHash = await bcrypt.hash('admin123', 10);
  const managerHash = await bcrypt.hash('manager123', 10);
  const hrHash = await bcrypt.hash('hr123', 10);

  await prisma.user.createMany({
    data: [
      { email: 'admin@ems.com', password: adminHash, name: 'Admin User', role: 'Admin', tenantId: tenant.id },
      { email: 'manager@ems.com', password: managerHash, name: 'Sarah Jenkins', role: 'Manager', tenantId: tenant.id },
      { email: 'hr@ems.com', password: hrHash, name: 'HR Specialist', role: 'HR', tenantId: tenant.id },
    ],
  });

  const [eng, design, hr, marketing, finance, operations] = await Promise.all([
    prisma.department.create({ data: { tenantId: tenant.id, name: 'Engineering', budget: 1200000 } }),
    prisma.department.create({ data: { tenantId: tenant.id, name: 'Design', budget: 600000 } }),
    prisma.department.create({ data: { tenantId: tenant.id, name: 'Human Resources', budget: 400000 } }),
    prisma.department.create({ data: { tenantId: tenant.id, name: 'Marketing', budget: 500000 } }),
    prisma.department.create({ data: { tenantId: tenant.id, name: 'Finance', budget: 700000 } }),
    prisma.department.create({ data: { tenantId: tenant.id, name: 'Operations', budget: 450000 } }),
  ]);

  const [adminRole, managerRole, employeeRole] = await Promise.all([
    prisma.role.create({ data: { tenantId: tenant.id, name: 'Admin' } }),
    prisma.role.create({ data: { tenantId: tenant.id, name: 'Manager' } }),
    prisma.role.create({ data: { tenantId: tenant.id, name: 'Employee' } }),
  ]);

  const employeeData = [
    { employeeId: 'EMP-001', firstName: 'Alice', lastName: 'Johnson', email: 'alice.johnson@ems.com', phone: '+91-9876543210', departmentId: eng.id, roleId: managerRole.id, salary: 95000, joinDate: new Date('2021-03-15'), status: 'Active' },
    { employeeId: 'EMP-002', firstName: 'Bob', lastName: 'Smith', email: 'bob.smith@ems.com', phone: '+91-9876543211', departmentId: design.id, roleId: employeeRole.id, salary: 65000, joinDate: new Date('2022-07-01'), status: 'Active' },
    { employeeId: 'EMP-003', firstName: 'Charlie', lastName: 'Davis', email: 'charlie.davis@ems.com', phone: '+91-9876543212', departmentId: hr.id, roleId: managerRole.id, salary: 75000, joinDate: new Date('2020-11-20'), status: 'Active' },
    { employeeId: 'EMP-004', firstName: 'Diana', lastName: 'Prince', email: 'diana.prince@ems.com', phone: '+91-9876543213', departmentId: marketing.id, roleId: employeeRole.id, salary: 60000, joinDate: new Date('2023-01-10'), status: 'Active' },
    { employeeId: 'EMP-005', firstName: 'Ethan', lastName: 'Hunt', email: 'ethan.hunt@ems.com', phone: '+91-9876543214', departmentId: eng.id, roleId: employeeRole.id, salary: 85000, joinDate: new Date('2021-08-22'), status: 'OnLeave' },
    { employeeId: 'EMP-006', firstName: 'Fiona', lastName: 'Green', email: 'fiona.green@ems.com', phone: '+91-9876543215', departmentId: finance.id, roleId: managerRole.id, salary: 90000, joinDate: new Date('2020-05-05'), status: 'Active' },
    { employeeId: 'EMP-007', firstName: 'George', lastName: 'Martin', email: 'george.martin@ems.com', phone: '+91-9876543216', departmentId: eng.id, roleId: employeeRole.id, salary: 70000, joinDate: new Date('2022-03-17'), status: 'Active' },
    { employeeId: 'EMP-008', firstName: 'Hannah', lastName: 'Baker', email: 'hannah.baker@ems.com', phone: '+91-9876543217', departmentId: operations.id, roleId: employeeRole.id, salary: 55000, joinDate: new Date('2023-06-01'), status: 'Active' },
    { employeeId: 'EMP-009', firstName: 'Ivan', lastName: 'Drago', email: 'ivan.drago@ems.com', phone: '+91-9876543218', departmentId: design.id, roleId: employeeRole.id, salary: 62000, joinDate: new Date('2022-12-12'), status: 'Inactive' },
    { employeeId: 'EMP-010', firstName: 'Julia', lastName: 'Roberts', email: 'julia.roberts@ems.com', phone: '+91-9876543219', departmentId: marketing.id, roleId: managerRole.id, salary: 88000, joinDate: new Date('2019-09-30'), status: 'Active' },
  ];

  const employees = await Promise.all(
    employeeData.map((e) => prisma.employee.create({ data: { ...e, tenantId: tenant.id } }))
  );

  await prisma.employeeCounter.create({
    data: { tenantId: tenant.id, value: employeeData.length },
  });

  const statuses = ['Present', 'Present', 'Present', 'Late', 'Present', 'Present', 'Absent'];
  const now = new Date();

  for (const emp of employees.filter((e) => e.status === 'Active')) {
    for (let d = 6; d >= 0; d -= 1) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      date.setHours(0, 0, 0, 0);

      const st = statuses[d] || 'Present';
      const checkIn = new Date(date);
      checkIn.setHours(st === 'Late' ? 10 : 9, 15, 0);
      const checkOut = new Date(date);
      checkOut.setHours(18, 30, 0);

      await prisma.attendance.create({
        data: {
          tenantId: tenant.id,
          employeeId: emp.id,
          date,
          checkIn: st !== 'Absent' ? checkIn : null,
          checkOut: st !== 'Absent' ? checkOut : null,
          status: st,
        },
      });
    }
  }

  const leaveTypes = ['Annual', 'Sick', 'Emergency'];
  const leaveStatuses = ['Approved', 'Pending', 'Rejected'];

  for (let i = 0; i < employees.length; i += 1) {
    const emp = employees[i];
    const from = new Date();
    from.setDate(from.getDate() + (i % 3 === 0 ? -10 : 5));
    const to = new Date(from);
    to.setDate(from.getDate() + 2);

    await prisma.leave.create({
      data: {
        tenantId: tenant.id,
        employeeId: emp.id,
        type: leaveTypes[i % 3],
        fromDate: from,
        toDate: to,
        reason: `${leaveTypes[i % 3]} leave request`,
        status: leaveStatuses[i % 3],
      },
    });
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const emp of employees) {
    const calc = calculatePayroll(emp.salary);

    await prisma.payroll.create({
      data: {
        tenantId: tenant.id,
        employeeId: emp.id,
        month: monthStart,
        basicSalary: calc.basicSalary,
        allowances: calc.allowances,
        deductions: calc.deductions,
        netPay: calc.netPay,
        status: emp.status === 'Active' ? 'Processed' : 'Pending',
      },
    });
  }

  const categories = ['Technical', 'Leadership', 'Communication', 'Teamwork'];

  for (let i = 0; i < employees.length; i += 1) {
    const emp = employees[i];
    await prisma.performance.create({
      data: {
        tenantId: tenant.id,
        employeeId: emp.id,
        reviewDate: new Date(now.getFullYear(), now.getMonth() - 1, 15),
        score: 3.5 + (i % 3) * 0.5,
        category: categories[i % 4],
        comments: `Excellent performance in ${categories[i % 4].toLowerCase()} this quarter.`,
        reviewedBy: 'Sarah Jenkins',
      },
    });
  }

  console.log('✅ Seed complete!');
  console.log('👤 Admin: admin@ems.com / admin123');
  console.log('👤 Manager: manager@ems.com / manager123');
  console.log('👤 HR: hr@ems.com / hr123');
}

main()
  .catch((e) => { console.error(e); })
  .finally(() => prisma.$disconnect());
