"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="shell" style={{ padding: "80px 28px" }}>
      <div className="notice">
        <div>
          <span className="label">Error</span>
          <h2>No se pudo cargar el aula</h2>
          <p>{error.message}</p>
          <p style={{ marginTop: 12 }}>
            Comprueba que exista <code>content/course.json</code> y que los vídeos estén en{" "}
            <code>media/</code>. Puedes regenerar el contenido con{" "}
            <code>bun run content:build</code>.
          </p>
          <p style={{ marginTop: 18, display: "flex", gap: 12 }}>
            <button className="button" type="button" onClick={reset}>
              Reintentar
            </button>
            <Link className="button button--ghost" href="/">
              Volver al inicio
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
