import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { formatClock, formatDuration } from "@/lib/format";
import { requireUser } from "@/server/guards";
import { loadCourse } from "@/server/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Índice del curso · Aula Lans",
};

export default async function IndexPage() {
  const user = await requireUser();
  const course = await loadCourse();

  return (
    <>
      <SiteHeader
        user={user}
        lessonCount={course.lessonCount}
        durationLabel={formatDuration(course.durationSeconds)}
      />

      <main className="shell index-page">
        <header className="index-head">
          <span className="label">Índice</span>
          <h1>Refuerzo Master Creador Lans</h1>
          <p className="lede">
            {course.lessonCount} lecciones · {course.modules.length} módulos ·{" "}
            {formatDuration(course.durationSeconds)} de contenido. Pulsa cualquier lección para
            abrirla.
          </p>
        </header>

        {course.modules.map((module) => (
          <section className="index-module" key={module.id}>
            <div className="index-module__head">
              <span className="index-module__no">
                {String(module.position).padStart(2, "0")}
              </span>
              <h2>{module.title}</h2>
              <span className="index-module__meta">
                {module.lessons.length} lecciones · {formatDuration(module.durationSeconds)}
              </span>
            </div>

            <ul className="index-list">
              {module.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link href={`/leccion/${lesson.id}`}>
                    <span className="idx">{String(lesson.position).padStart(2, "0")}</span>
                    <span className="name">{lesson.title}</span>
                    <span className="dur">{formatClock(lesson.durationSeconds)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
