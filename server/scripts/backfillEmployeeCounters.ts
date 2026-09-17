import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();

  for (const tenant of tenants) {
    const employees = await prisma.employee.findMany({
      where: { tenantId: tenant.id },
      select: { employeeId: true },
    });

    let maxNum = 0;
    for (const emp of employees) {
      const parsed = parseInt(emp.employeeId.split('-')[1] || '0', 10);
      if (Number.isFinite(parsed) && parsed > maxNum) maxNum = parsed;
    }

    await prisma.employeeCounter.upsert({
      where: { tenantId: tenant.id },
      create: { tenantId: tenant.id, value: maxNum },
      update: { value: { set: maxNum > 0 ? maxNum : 1 } },
    });
  }

  console.log(`✅ Backfilled counters for ${tenants.length} tenant(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());