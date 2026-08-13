export type Design = {
  id: string;
  name: string;
  label: string;
  accentColor: string;
  description: string;
};

export const designs: Design[] = [
  {
    id: "neon-glass",
    name: "Neon Glass",
    label: "01",
    accentColor: "#22d3ee",
    description:
      "High-contrast neon with glassmorphism and strong CTA focus.",
  },
  {
    id: "purple-gradient",
    name: "Purple Gradient",
    label: "02",
    accentColor: "#a855f7",
    description:
      "Smooth gradients and pill-shaped buttons for a premium feel.",
  },
  {
    id: "minimal-dark",
    name: "Minimal Dark",
    label: "03",
    accentColor: "#f97316",
    description:
      "Clean, sharp layout for service businesses and professionals.",
  },
  {
    id: "split-hero",
    name: "Split Hero",
    label: "04",
    accentColor: "#22c55e",
    description:
      "Image + copy split layout, great for local trades and shops.",
  },
  {
    id: "card-grid",
    name: "Card Grid",
    label: "05",
    accentColor: "#eab308",
    description:
      "Modern card grid for showcasing multiple services or offers.",
  },
  {
    id: "bold-type",
    name: "Bold Type",
    label: "06",
    accentColor: "#3b82f6",
    description:
      "Big typography and strong calls to action for coaches & creators.",
  },
  {
    id: "photo-focus",
    name: "Photo Focus",
    label: "07",
    accentColor: "#ec4899",
    description:
      "Hero imagery front and center, perfect for visual brands.",
  },
  {
    id: "funnel-ready",
    name: "Funnel Ready",
    label: "08",
    accentColor: "#f43f5e",
    description:
      "Page structure built around a simple, clear sales funnel.",
  },
];
