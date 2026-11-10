import { Effect } from "effect";

import { ChangePasswordForm } from "@/app/cuenta/change-password-form";
import { MemberActions } from "@/app/cuenta/member-actions";
import { RegisterMemberForm } from "@/app/cuenta/register-form";
import { SiteHeader } from "@/components/site-header";
import { formatDuration } from "@/lib/format";
import { isAdmin, listUsers } from "@/server/auth";
import { logoutAction } from "@/server/auth-actions";
import { requireUser } from "@/server/guards";
import { loadCourse } from "@/server/queries";
import { AppLayer } from "@/server/runtime";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const admin = isAdmin(user);

  const [course, users] = await Promise.all([
    loadCourse(),
    Effect.runPromise(
      listUsers().pipe(Effect.provide(AppLayer), Effect.orElseSucceed(() => [])),
    ),
  ]);

  return (
    <>
      <SiteHeader
        user={user}
        lessonCount={course.lessonCount}
        durationLabel={formatDuration(course.durationSeconds)}
      />

      <main className="shell account">
        <span className="label">Ajustes</span>
        <h1>Tu cuenta</h1>
        <p className="lede">
          El aula vive en este equipo. Cada persona tiene su propio progreso y su propia
          contraseña; nada se sincroniza fuera.
        </p>

        <section className="panel">
          <h2>
            {user.name}
            {admin ? <span className="badge badge--admin">Administradora</span> : null}
          </h2>
          <p className="muted">@{user.username}</p>

          <div className="panel__row">
            <div className="who">
              <span>Progreso guardado en</span>
              <strong>data/aula.db</strong>
            </div>
            <form action={logoutAction}>
              <button className="button button--ghost" type="submit">
                Cerrar sesión
              </button>
            </form>
          </div>
        </section>

        <section className="panel">
          <h2>Cambiar contraseña</h2>
          <p className="muted">Se guarda cifrada con scrypt; nadie puede leerla.</p>
          <ChangePasswordForm />
        </section>

        <section className="panel">
          <h2>Personas con acceso</h2>
          <p className="muted">
            {users.length} {users.length === 1 ? "cuenta" : "cuentas"} en este equipo.
          </p>

          {users.map((member) => (
            <div className="member" key={member.id}>
              <div className="who">
                <strong>{member.name}</strong>
                <span>@{member.username}</span>
              </div>

              <div className="member__meta">
                {isAdmin(member) ? <span className="badge badge--admin">Admin</span> : null}
                {member.id === user.id ? <span className="badge">Sesión actual</span> : null}
              </div>

              {admin ? <MemberActions userId={member.id} isSelf={member.id === user.id} /> : null}
            </div>
          ))}
        </section>

        {admin ? (
          <section className="panel">
            <h2>Añadir cuenta</h2>
            <p className="muted">
              Tendrá su propio progreso, independiente del resto. Podrá cambiar la contraseña
              al entrar.
            </p>
            <RegisterMemberForm />
          </section>
        ) : null}
      </main>
    </>
  );
}
