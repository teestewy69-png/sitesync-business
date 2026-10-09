/** Public template routes future client sites also get (home is `/`). */
export const SITE_NAV = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/locations", label: "Cities" },
  { href: "/blog", label: "Blog" },
] as const;

/** Homepage sections, linked as real URLs so they work from every page. */
export const SITE_HASH_LINKS = [
  { href: "/#pricing", label: "Pricing" },
  { href: "/#designs", label: "Designs" },
  { href: "/#faq", label: "FAQ" },
] as const;
