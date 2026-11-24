import { getNotifyEmail, isMailConfigured, sendMail } from "@/lib/mail";
import { findLeadById, storeInfo, updateLead } from "@/lib/store";

const CHECKLIST_TEXT = `Hey!

Thanks for requesting a Sitesinc website. This is a request, not a purchase. If we accept the project, we send a $997.50 start invoice by email. The remaining $997.50 is due at launch. Optional monitoring is $129/month and can be added later.

Here is the same checklist we run through on every build:

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

Website builds are $1,995. $997.50 to start. $997.50 at launch. Optional monitoring $129/month. Cancel anytime. No long-term contract. https://sitesinc.co

Questions? Just reply to this email.

save@sitesinc.co`;

/**
 * Send the subscribe confirmation + notification emails for a saved lead and
 * record the outcome on the lead's notificationState. Shared by the
 * background notify route (the normal path) and the subscribe route's
 * in-request fallback. Idempotent: a lead already marked "sent" is skipped,
 * which also makes Netlify's background-invocation retries safe.
 */
export async function sendSubscribeEmails(leadId: string): Promise<void> {
  const lead = await findLeadById(leadId);
  if (!lead) {
    console.error("Subscribe email: lead not found:", leadId);
    return;
  }
  if (lead.notificationState === "sent" || lead.notificationState === "sending") return;

  // Claim the lead before sending: if a second trigger fires while this
  // send is in flight (double submit, platform retry, two paths racing),
  // it sees "sending" and skips instead of duplicating the email.
  await updateLead(lead.id, { notificationState: "sending" });

  const notifyEmail = getNotifyEmail();
  const mailConfigured = isMailConfigured();
  const storeBackend = storeInfo().backend;

  let mailed = { sent: false };
  try {
    mailed = await sendMail({
      to: lead.email,
      subject: "Your Sitesinc website request",
      text: CHECKLIST_TEXT,
    });
    await sendMail({
      to: notifyEmail,
      subject: `New website request: ${lead.id}`,
      text: `New website request\n\nName: ${lead.name}\nEmail: ${lead.email}\nLead ID: ${lead.id}\nProject ID: ${lead.projectId || "not linked"}\nMonitoring interest: ${lead.monitoringInterest ? "yes" : "no"}\nStore: ${storeBackend}\nSent ${lead.createdAt}\nSMTP configured: ${mailConfigured ? "yes" : "no"}`,
    });
  } catch (err) {
    console.error("Subscribe email error:", err);
  }
  try {
    await updateLead(lead.id, {
      notificationState: mailed.sent
        ? "sent"
        : mailConfigured
          ? "failed"
          : "not_configured",
    });
  } catch (err) {
    console.error(
      "Subscribe notification-state update failed:",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
    );
  }
}
