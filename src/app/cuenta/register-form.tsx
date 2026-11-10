"use client";

import { useActionState } from "react";

import { registerAction } from "@/server/auth-actions";
import { emptyFormState } from "@/server/form-state";

export function RegisterMemberForm() {
  const [state, formAction, pending] = useActionState(registerAction, emptyFormState);

  return (
    <>
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="form-success" role="status">
          {state.success}
        </p>
      ) : null}

      <form action={formAction}>
        <div className="field">
          <label htmlFor="member-name">Nombre</label>
          <input id="member-name" name="name" type="text" autoComplete="off" required />
        </div>

        <div className="field">
          <label htmlFor="member-username">Usuario</label>
          <input
            id="member-username"
            name="username"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="member-password">Contraseña</label>
          <input
            id="member-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <button className="button button--primary" type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear cuenta"}
        </button>
      </form>
    </>
  );
}
