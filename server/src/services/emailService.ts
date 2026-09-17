import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'EMS Pro <onboarding@resend.dev>';

export async function sendEmail(to: string, subject: string, body: string) {
  if (resend) {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, text: body });
    return;
  }
  console.log(`[email:dev] To=${to} | Subject=${subject}\n${body}`);
}

export function makeResetLink(token: string, kind: 'reset' | 'invite' = 'reset') {
  const base = process.env.CLIENT_URL || 'http://localhost:5173';
  return `${base}/reset-password?token=${token}${kind === 'invite' ? '&invite=1' : ''}`;
}
