import content from "@/content.json";
import { posts } from "@/data/posts";

export default function ArticleJsonLd({ slug }: { slug: string }) {
  const post = posts.find((p) => p.slug === slug);
  if (!post) return null;
  const origin = content.seo.url;
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    image: content.seo.image,
    mainEntityOfPage: `${origin}/blog/${post.slug}`,
    author: { "@type": "Organization", name: content.site.name, url: origin },
    publisher: { "@id": `${origin}/#organization`, "@type": "Organization", name: content.site.name, logo: { "@type": "ImageObject", url: `${origin}/logo.png` } },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
