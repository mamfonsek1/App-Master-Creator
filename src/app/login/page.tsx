import { Effect } from "effect";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { countUsers } from "@/server/auth";
import { currentUser } from "@/server/guards";
import { loadCourse } from "@/server/queries";
import { AppLayer } from "@/server/runtime";
import { formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await currentUser();

  if (user) {
    redirect("/");
  }

  const total = await Effect.runPromise(
    countUsers().pipe(Effect.provide(AppLayer), Effect.orElseSucceed(() => 0)),
  );

  if (total === 0) {
    redirect("/setup");
  }

  const course = await loadCourse().catch(() => null);

  return (
    <div className="auth">
      <aside className="auth__brand">
        <div className="wordmark">Lans Studios</div>

        <div>
          <div className="hero__rule" />
          <h1>
            Refuerzo Master
            <br />
            Creador <em>Lans</em>
          </h1>
          <p className="lede">
            El curso completo, guardado en este equipo. Sin conexión, sin caducidad y sin
            depender de la plataforma.
          </p>
        </div>

        <div className="meta">
          <span>{course ? `${course.lessonCount} lecciones` : "Curso completo"}</span>
          <span>{course ? formatDuration(course.durationSeconds) : "1080p"}</span>
          <span>Aula local</span>
        </div>
      </aside>

      <div className="auth__panel">
        <div className="auth__card">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
