# Sitesinc Website Factory

Sitesinc (`sitesinc.co`) is a done-for-you website build service. Public brand: **Sitesinc**. Product descriptor: **Website Factory**. Contact: `save@sitesinc.co`.

Do not use SiteSync, Sitesync, or Sitesync Business in public or operator copy.

Website builds start at $1,995 ($997.50 to start, $997.50 at launch). Optional monitoring is $129/month, cancel anytime, no long-term contract. Submitting the homepage form is a request, not a purchase.

## Persistence

Local development writes leads and client projects to `data/store/*.json`.

On Netlify (`NETLIFY=true`), the CRM adapter uses Netlify Blobs (`sitesinc-crm`). That is required for durable lead storage. Do not treat the local JSON files as production storage.

Force a backend with `SITESINC_STORE=local` or `SITESINC_STORE=blobs`.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
