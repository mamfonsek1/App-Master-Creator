"use client";

import { useActionState } from "react";

import { setupAction } from "@/server/auth-actions";
import { emptyFormState } from "@/server/form-state";

export function SetupForm() {
  const [state, formAction, pending] = useActionState(setupAction, emptyFormState);

  return (
    <>
      <h2>Crear cuenta</h2>
      <p className="hint">
        Se guarda en la base de datos local. No se envía nada a ningún servidor.
      </p>

      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <form action={formAction}>
        <div className="field">
          <label htmlFor="name">Nombre</label>
          <input id="name" name="name" type="text" autoComplete="name" required autoFocus />
        </div>

        <div className="field">
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password_confirm">Repetir contraseña</label>
          <input
            id="password_confirm"
            name="password_confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <button className="button button--primary auth__submit" type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear cuenta y entrar"}
        </button>
      </form>
    </>
  );
}
