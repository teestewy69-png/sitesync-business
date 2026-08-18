import type { Product } from "@/data/products";

const PAGE_STYLES = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    background: #0c0b09;
    color: #e2e8f0;
  }
  a { color: inherit; text-decoration: none; }
  header, main, footer { max-width: 1100px; margin: 0 auto; padding: 24px 20px; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid rgba(255,255,255,.1); }
  header p { margin: 0; color: #ecd06a; font-size: 12px; letter-spacing: .16em; text-transform: uppercase; }
  h1 { font-family: ui-sans-serif, system-ui, sans-serif; margin: 8px 0 0; font-size: 28px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
  article, .detail {
    background: #161412;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 18px;
    overflow: hidden;
  }
  img { width: 100%; height: 220px; object-fit: cover; display: block; background: #100e0c; }
  .copy { padding: 16px 18px 20px; }
  .cat { color: #ecd06a; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; margin: 0 0 6px; font-family: ui-sans-serif, system-ui, sans-serif; }
  h2, h3 { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0 0 8px; }
  .price { font-size: 20px; margin: 10px 0 0; }
  .was { color: #64748b; text-decoration: line-through; font-size: 14px; margin-left: 8px; }
  .detail { display: grid; grid-template-columns: 1.1fr .9fr; }
  .detail img { height: 100%; min-height: 320px; }
  @media (max-width: 800px) { .detail { grid-template-columns: 1fr; } }
  footer { color: #64748b; font-size: 13px; }
`;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function priceLabel(product: Product): string {
  if (product.contactOnly) return "Contact for pricing";
  const regular = product.regularPrice
    ? `<span class="was">${escapeHtml(product.regularPrice)}</span>`
    : "";
  return `${escapeHtml(product.price ?? "")}${regular}`;
}

export function shopListingHtml(products: Product[]): string {
  const cards = products
    .map(
      (product) => `
      <article>
        <a href="product-${escapeHtml(product.slug)}.html">
          <img src="images/${escapeHtml(product.imageFile)}" alt="${escapeHtml(product.name)}" />
          <div class="copy">
            <p class="cat">${escapeHtml(product.category)}</p>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.description)}</p>
            <p class="price">${priceLabel(product)}</p>
          </div>
        </a>
      </article>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sitesync Shop</title>
  <style>${PAGE_STYLES}</style>
</head>
<body>
  <header>
    <div>
      <p>Sitesync Business</p>
      <h1>Shop</h1>
    </div>
    <p>Offline catalog with product images</p>
  </header>
  <main>
    <div class="grid">${cards}</div>
  </main>
  <footer>Saved from the Sitesync shop. Images are in the images/ folder.</footer>
</body>
</html>`;
}

export function productPageHtml(product: Product): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(product.name)} | Sitesync Shop</title>
  <style>${PAGE_STYLES}</style>
</head>
<body>
  <header>
    <div>
      <p>Sitesync Business</p>
      <h1>${escapeHtml(product.name)}</h1>
    </div>
    <p><a href="shop.html">← Back to shop</a></p>
  </header>
  <main>
    <div class="detail">
      <img src="images/${escapeHtml(product.imageFile)}" alt="${escapeHtml(product.name)}" />
      <div class="copy">
        <p class="cat">${escapeHtml(product.category)}</p>
        <h2>${escapeHtml(product.name)}</h2>
        <p>${escapeHtml(product.description)}</p>
        <p class="price">${priceLabel(product)}</p>
      </div>
    </div>
  </main>
</body>
</html>`;
}
