/** Neutral 404 for client domains (no Sitesinc branding). */
import Link from "next/link";
export default function ClientDomainNotFound() {
  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "4rem 1.5rem", textAlign: "center" }}>
      <span data-client-site="" hidden />
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Page not found</h1>
        <p style={{ marginTop: "0.5rem", opacity: 0.75 }}>
          <Link href="/">Go to the home page</Link>
        </p>
      </div>
    </main>
  );
}
