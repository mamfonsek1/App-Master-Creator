import Link from "next/link";

interface SiteHeaderProps {
  readonly lessonCount: number;
  readonly durationLabel: string;
}

export function SiteHeader({ lessonCount, durationLabel }: SiteHeaderProps) {
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
          <span className="label">Aula local</span>
        </div>
      </div>
    </header>
  );
}
