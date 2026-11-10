import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell" style={{ padding: "96px 28px" }}>
      <span className="label">404</span>
      <h1 style={{ fontSize: 40, margin: "10px 0 12px" }}>Esa lección no existe</h1>
      <p style={{ color: "var(--ink-soft)", maxWidth: "52ch" }}>
        El enlace no corresponde a ninguna lección del temario. Vuelve al inicio para
        elegir una.
      </p>
      <p style={{ marginTop: 24 }}>
        <Link className="button button--primary" href="/">
          Ver el temario
        </Link>
      </p>
    </main>
  );
}
