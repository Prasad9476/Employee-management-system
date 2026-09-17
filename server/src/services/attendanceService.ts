const WORK_START_HOUR = 10;
const WORK_END_HOUR = 18;
const STANDARD_MINUTES = 8 * 60;

export function deriveAttendanceMetrics(checkIn: Date, checkOut: Date | null, now = new Date()) {
  const late = checkIn.getHours() >= WORK_START_HOUR;
  if (!checkOut) {
    return {
      status: late ? 'Late' : 'Present',
      workMinutes: null as number | null,
      overtimeMinutes: 0,
      earlyCheckout: false,
    };
  }

  const workMinutes = Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60000));
  const earlyCheckout = checkOut.getHours() < WORK_END_HOUR;
  const overtimeMinutes = Math.max(0, workMinutes - STANDARD_MINUTES);

  return {
    status: late ? 'Late' : 'Present',
    workMinutes,
    overtimeMinutes,
    earlyCheckout,
  };
}

export { WORK_START_HOUR, WORK_END_HOUR, STANDARD_MINUTES };
