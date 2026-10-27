/** Public template routes future client sites also get (home is `/`). */
export const SITE_NAV = [
  { href: "/services", label: "Services" },
  { href: "/website-design", label: "Website Design" },
  { href: "/packages", label: "Packages" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/blog", label: "Blog" },
  { href: "/free-website-audit", label: "Free Audit" },
] as const;

/** Factory hub pages that must be linked from nav, footer, and the homepage. */
export const SITE_HUB_LINKS = [
  { href: "/website-design", label: "Website design" },
  { href: "/packages", label: "Packages" },
  { href: "/website-redesign", label: "Website redesign" },
  { href: "/seo-ready-websites", label: "SEO-ready websites" },
  { href: "/website-monitoring", label: "Website monitoring" },
  { href: "/for-local-service-businesses", label: "Local service businesses" },
] as const;

/** Homepage sections, linked as real URLs so they work from every page. */
export const SITE_HASH_LINKS = [
  { href: "/#pricing", label: "Pricing" },
  { href: "/#designs", label: "Designs" },
  { href: "/#faq", label: "FAQ" },
] as const;

/** Fact-only competitor comparison pages, linked from the footer for crawlers and owners comparing providers. */
export const SITE_COMPARE_LINKS = [
  { href: "/compare/hibu-alternative", label: "Hibu alternative" },
  { href: "/compare/thryv-alternative", label: "Thryv alternative" },
  { href: "/compare/web-com-alternative", label: "Web.com alternative" },
] as const;
