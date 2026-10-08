import nodemailer from "nodemailer";
import { stagingMailBody, stagingMailSubject } from "@/lib/site-env";

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

function smtpHost(): string {
  return process.env.TITAN_SMTP_HOST || "smtp.titan.email";
}

function createTransporter(mode: "ssl465" | "starttls587") {
  const user = process.env.TITAN_SMTP_USER!;
  const pass = process.env.TITAN_SMTP_PASS!;
  const host = smtpHost();

  if (mode === "starttls587") {
    return nodemailer.createTransport({
      host,
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
    });
  }

  return nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });
}

function authFailureCode(err: unknown): string | null {
  const msg =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err ?? "");
  const responseCode =
    err && typeof err === "object" && "responseCode" in err
      ? Number((err as { responseCode: unknown }).responseCode)
      : null;
  if (responseCode === 535 || /\b535\b/.test(msg) || /Invalid login/i.test(msg)) {
    return "535";
  }
  return null;
}

function stagingMailHtml(html: string): string {
  const note = stagingMailBody("");
  if (!note.trim()) return html;
  const escaped = note.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `${html}<p style="color:#666;font-size:12px">${escaped}</p>`;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body; `text` stays as the plain-text alternative. */
  html?: string;
  replyTo?: string;
}): Promise<{ sent: boolean }> {
  const user = process.env.TITAN_SMTP_USER;
  const pass = process.env.TITAN_SMTP_PASS;
  if (!user || !pass) {
    console.warn("SMTP not configured; skipped email:", opts.subject);
    return { sent: false };
  }

  const mail = {
    from: `"Sitesinc" <${user}>`,
    to: opts.to,
    subject: stagingMailSubject(opts.subject),
    text: stagingMailBody(opts.text),
    ...(opts.html ? { html: stagingMailHtml(opts.html) } : {}),
    replyTo: opts.replyTo,
  };

  const modes: Array<"ssl465" | "starttls587"> = ["ssl465", "starttls587"];
  let lastAuthFail = false;

  for (const mode of modes) {
    try {
      const transporter = createTransporter(mode);
      await transporter.sendMail(mail);
      return { sent: true };
    } catch (err) {
      const code = authFailureCode(err);
      if (code === "535") {
        lastAuthFail = true;
        console.error(
          `SMTP auth failed (535) via ${mode}. Check Titan mailbox password / app password for the configured user. No secret logged.`
        );
        // Auth will fail the same on the other port; stop early.
        break;
      }
      console.error(
        `SMTP send failed via ${mode}:`,
        err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
      );
    }
  }

  if (lastAuthFail) {
    console.error(
      "SMTP remains blocked by Titan authentication. Storage/inbox is still the source of truth; email failure must not roll back leads."
    );
  }

  return { sent: false };
}
