"use client";

import { useActionState } from "react";

import { loginAction } from "@/server/auth-actions";
import { emptyFormState } from "@/server/form-state";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, emptyFormState);

  return (
    <>
      <h2>Entrar</h2>
      <p className="hint">Usa tu cuenta para ver el curso y continuar donde lo dejaste.</p>

      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <form action={formAction}>
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
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <button className="button button--primary auth__submit" type="submit" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </>
  );
}
