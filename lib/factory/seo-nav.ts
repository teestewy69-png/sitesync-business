export const SEO_TABS = [
  { href: "/app/seo", label: "Overview" },
  { href: "/app/seo/pages", label: "Pages" },
  { href: "/app/seo/issues", label: "Issues" },
  { href: "/app/seo/refresh", label: "Content refresh" },
  { href: "/app/seo/ops", label: "Ops tools" },
] as const;

export type SeoSiteOption = {
  id: string;
  name: string;
  origin: string;
};
