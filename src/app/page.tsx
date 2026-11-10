import Link from "next/link";

import { CourseBrowser } from "@/components/course-browser";
import { ArrowIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { summarize } from "@/domain/progress";
import { formatBytes, formatDuration, formatPercent } from "@/lib/format";
import { requireUser } from "@/server/guards";
import { loadCourse, loadProgress } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const [course, progress] = await Promise.all([loadCourse(), loadProgress(user.id)]);

  const lessons = course.modules.flatMap((module) => module.lessons);
  const summary = summarize(lessons, progress);

  const pending = Object.values(progress.lessons)
    .filter((entry) => !entry.completed)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const lastWatchedId = pending[0]?.lessonId;
  const resume =
    lessons.find((lesson) => lesson.id === lastWatchedId) ??
    lessons.find((lesson) => progress.lessons[lesson.id]?.completed !== true) ??
    lessons[0];

  const hasProgress = summary.completedLessons > 0 || summary.startedLessons > 0;

  return (
    <>
      <SiteHeader
        user={user}
        lessonCount={course.lessonCount}
        durationLabel={formatDuration(course.durationSeconds)}
      />

      <main>
        <section className="hero">
          <div className="shell hero__inner">
            <div>
              <div className="hero__rule" />
              <h1>
                Refuerzo Master
                <br />
                Creador <em>Lans</em>
              </h1>
              <p className="hero__subtitle">
                {course.subtitle}. Todo el contenido vive en tu equipo, sin conexión ni
                plataforma de por medio.
              </p>

              <div className="hero__stats">
                <div className="hero__stat">
                  <div className="value">{course.lessonCount}</div>
                  <div className="caption">Lecciones</div>
                </div>
                <div className="hero__stat">
                  <div className="value">{course.modules.length}</div>
                  <div className="caption">Módulos</div>
                </div>
                <div className="hero__stat">
                  <div className="value">{formatDuration(course.durationSeconds)}</div>
                  <div className="caption">De contenido</div>
                </div>
                <div className="hero__stat">
                  <div className="value">{formatBytes(course.bytes)}</div>
                  <div className="caption">En local · 1080p</div>
                </div>
              </div>
            </div>

            <aside className="hero__panel">
              <span className="label">
                {hasProgress ? "Tu progreso" : "Empieza cuando quieras"}
              </span>

              <div className="hero__progress">
                <strong>{formatPercent(summary.completedRatio)}</strong>
                <span>
                  {summary.completedLessons} de {summary.totalLessons} vistas
                </span>
              </div>

              <div className="progress-bar" aria-hidden="true" style={{ marginTop: 12 }}>
                <span
                  className="progress-bar__fill"
                  style={{ width: `${summary.completedRatio * 100}%` }}
                />
              </div>

              {resume ? (
                <Link className="hero__cta" href={`/leccion/${resume.id}`}>
                  {hasProgress ? "Continuar donde lo dejaste" : "Empezar el curso"}
                  <ArrowIcon />
                </Link>
              ) : null}

              <a className="hero__index" href="/indice">
                Ver índice del curso
              </a>
            </aside>
          </div>
        </section>

        <CourseBrowser course={course} progress={progress} />
      </main>

      <footer className="shell footer">
        <span>Lans Studios · Aula local</span>
        <span>
          {course.lessonCount} lecciones · {formatDuration(course.durationSeconds)}
        </span>
      </footer>
    </>
  );
}
