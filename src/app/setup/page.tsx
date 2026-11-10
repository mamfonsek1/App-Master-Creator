import { Effect } from "effect";
import { redirect } from "next/navigation";

import { SetupForm } from "@/app/setup/setup-form";
import { countUsers } from "@/server/auth";
import { AppLayer } from "@/server/runtime";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const total = await Effect.runPromise(
    countUsers().pipe(Effect.provide(AppLayer), Effect.orElseSucceed(() => 0)),
  );

  if (total > 0) {
    redirect("/login");
  }

  return (
    <div className="auth">
      <aside className="auth__brand">
        <div className="wordmark">Lans Studios</div>

        <div>
          <div className="hero__rule" />
          <h1>
            Primera
            <br />
            <em>cuenta</em>
          </h1>
          <p className="lede">
            Esta es la primera vez que se abre el aula. Crea una cuenta para empezar; después
            podrás añadir la segunda desde Ajustes.
          </p>
        </div>

        <div className="meta">
          <span>Datos en este equipo</span>
          <span>Sin conexión</span>
        </div>
      </aside>

      <div className="auth__panel">
        <div className="auth__card">
          <SetupForm />
        </div>
      </div>
    </div>
  );
}
