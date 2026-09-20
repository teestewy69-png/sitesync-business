export type ProcessStep = {
  step: string;
  title: string;
  text: string;
};

export const processSteps: ProcessStep[] = [
  {
    step: "01",
    title: "Pick your design & request a build",
    text: "Browse our 8 ultra-modern layouts and choose the one that feels right for your business. Submit a request — that is not a purchase. If we accept the project, you pay $997.50 to start and $997.50 at launch.",
  },
  {
    step: "02",
    title: "Tell us about your business",
    text: "Fill out a quick onboarding form with your logo, services, main offers, photos, and domain info. No tech knowledge needed—just talk about what you do.",
  },
  {
    step: "03",
    title: "We build, optimize & connect everything",
    text: "We design and develop your site on Next.js + Tailwind, set up SEO basics, funnels, Stripe payments, and monetization placeholders, then connect your domain and Netlify hosting.",
  },
  {
    step: "04",
    title: "Review, refine & launch in 5–7 days",
    text: "You get a preview, request one round of tweaks, and we go live. You receive the full codebase and a short walkthrough video so you fully own your new website.",
  },
];
