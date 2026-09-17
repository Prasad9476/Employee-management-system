const PF_RATE = 0.12;
const ESI_RATE = 0.0175;
const ALLOWANCE_RATE = 0.3;
const TAX_SLABS = [
  { limit: 300000, rate: 0 },
  { limit: 600000, rate: 0.05 },
  { limit: 900000, rate: 0.10 },
  { limit: 1200000, rate: 0.15 },
  { limit: 1500000, rate: 0.20 },
  { limit: Infinity, rate: 0.30 },
];

export type PayrollBreakdown = {
  basicSalary: number;
  allowances: number;
  gross: number;
  pf: number;
  esi: number;
  tax: number;
  deductions: number;
  netPay: number;
};

export function calculatePayroll(basicSalary: number): PayrollBreakdown {
  if (basicSalary <= 0) {
    throw new Error('basicSalary must be greater than 0');
  }

  const allowances = round(basicSalary * ALLOWANCE_RATE);
  const gross = round(basicSalary + allowances);
  const pf = round(basicSalary * PF_RATE);
  const esi = gross <= 21000 ? round(gross * ESI_RATE) : 0;

  const annual = gross * 12;
  let tax = 0;
  let prev = 0;
  for (const { limit, rate } of TAX_SLABS) {
    if (annual <= limit) {
      tax += (annual - prev) * rate;
      break;
    }
    tax += (limit - prev) * rate;
    prev = limit;
  }
  const monthlyTax = round(tax / 12);
  const deductions = round(pf + esi + monthlyTax);
  const netPay = round(gross - deductions);

  return { basicSalary, allowances, gross, pf, esi, tax: monthlyTax, deductions, netPay };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
