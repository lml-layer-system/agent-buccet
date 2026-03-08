import Link from "next/link";

export default function ClientPortalIndexPage() {
  return (
    <main>
      <header className="hero">
        <div className="watermark">Product - Client GPS Portal</div>
        <h1>Client Case Access</h1>
        <p>Use your case link/token to open your timeline.</p>
      </header>

      <section className="card">
        <strong>Demo Access</strong>
        <p className="meta">For local testing, open a known case route directly.</p>
        <Link href="/product/client/example-case-id">Open example case route</Link>
      </section>
    </main>
  );
}
