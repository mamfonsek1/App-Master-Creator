import Link from "next/link";

import { logoutAction } from "@/server/auth-actions";
import type { User } from "@/server/auth";

interface SiteHeaderProps {
  readonly user: User;
  readonly lessonCount: number;
  readonly durationLabel: string;
}

export function SiteHeader({ user, lessonCount, durationLabel }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link href="/" className="wordmark" aria-label="Ir al inicio del curso">
          Lans Studios
        </Link>

        <div className="site-header__meta">
          <span>
            <strong>{lessonCount}</strong> lecciones
          </span>
          <span>{durationLabel}</span>
          <a className="header-link" href="/indice.pdf" target="_blank" rel="noreferrer">
            Índice
          </a>
          <span className="header-user">{user.name}</span>
          <form action={logoutAction}>
            <button className="header-exit" type="submit">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
