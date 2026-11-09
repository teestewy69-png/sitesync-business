/** Tony-approved two-audience pitch. Feature comparison, not a client result. */
export const PITCH_NEW_BUSINESS =
  "Starting a new business? Get a fully working $1,995 website with the features you'd expect from a $10,000–$15,000 build.";

export const PITCH_EXISTING = "Already have a website? Get a free diagnostic first.";

export const PITCH_CTA = "Call (909) 323-1575, you'll be glad you made the call.";

export const PITCH_PHONE = "(909) 323-1575";
export const PITCH_PHONE_HREF = "tel:+19093231575";
export const PITCH_DIAGNOSTIC_HREF = "/free-website-audit";

/** Factory hub slugs that render the pitch block (home and indexed city pages include it directly). */
export const TWO_AUDIENCE_PITCH_SLUGS = [
  "packages",
  "inland-empire-small-business-website-design",
  "affordable-small-business-website-1995",
  "rancho-cucamonga-small-business-web-design",
] as const;

export function showsTwoAudiencePitch(slug: string): boolean {
  return (TWO_AUDIENCE_PITCH_SLUGS as readonly string[]).includes(slug);
}
