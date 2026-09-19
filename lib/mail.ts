import nodemailer from "nodemailer";

export function isMailConfigured(): boolean {
  return Boolean(process.env.TITAN_SMTP_USER && process.env.TITAN_SMTP_PASS);
}

export function getNotifyEmail(): string {
  return (
    process.env.SITE_NOTIFY_EMAIL ||
    process.env.TITAN_SMTP_USER ||
    "save@sitesinc.co"
  );
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<{ sent: boolean }> {
  const user = process.env.TITAN_SMTP_USER;
  const pass = process.env.TITAN_SMTP_PASS;
  if (!user || !pass) {
    console.warn("SMTP not configured; skipped email:", opts.subject);
    return { sent: false };
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.titan.email",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });

  await transporter.sendMail({
    from: `"Sitesinc" <${user}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    replyTo: opts.replyTo,
  });

  return { sent: true };
}
