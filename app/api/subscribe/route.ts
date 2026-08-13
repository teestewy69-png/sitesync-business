import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CHECKLIST_TEXT = `Hey!

Thanks for grabbing the Sitesync website checklist. Here it is - the same list we run through on every build:

DESIGN
[ ] Dark or light theme picked deliberately (not the builder default)
[ ] One clear headline that says what you do and who it's for
[ ] Your phone number / main CTA visible without scrolling
[ ] Real photos of your work, not just stock images

COPY
[ ] Every page answers "what's in it for me?" for the visitor
[ ] Services listed with plain-language descriptions and prices (or "from" prices)
[ ] At least one testimonial with a real name
[ ] A clear next step on every page (call, book, buy)

SEO BASICS
[ ] Unique title + meta description on every page
[ ] Your city/service area in the homepage title
[ ] Google Business Profile claimed and linked
[ ] Fast hosting + SSL (https)

MONEY PIECES (the ones most sites forget)
[ ] Lead capture form that goes somewhere you actually check
[ ] A way to take payment online (Stripe link is enough to start)
[ ] Email list signup so you own your audience
[ ] Tracking (even simple analytics) so you know what's working

Want us to handle all of this for you? The first 10 businesses get 50% off a complete build - https://sitesinc.co

Questions? Just reply to this email.

- Sitesync Business
save@sitesinc.co`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email =
      typeof body?.email === "string" ? body.email.trim() : "";

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const user = process.env.TITAN_SMTP_USER;
    const pass = process.env.TITAN_SMTP_PASS;
    if (!user || !pass) {
      console.error("TITAN_SMTP_USER / TITAN_SMTP_PASS are not configured.");
      return NextResponse.json(
        {
          ok: false,
          error:
            "Signup is not available right now. Please email us directly.",
        },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.titan.email",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Sitesync Business" <${user}>`,
      to: email,
      subject: "Your free website checklist from Sitesync",
      text: CHECKLIST_TEXT,
    });

    await transporter.sendMail({
      from: `"Sitesync Website" <${user}>`,
      to: user,
      subject: `New checklist signup: ${email}`,
      text: `New newsletter/checklist signup from the landing page:\n\n${email}\n\nSent ${new Date().toISOString()}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't send the email. Please try again in a minute.",
      },
      { status: 502 }
    );
  }
}
