import Link from "next/link";

import { UserMenu } from "@/components/user-menu";
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
          <Link className="header-link" href="/indice">
            Índice
          </Link>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
