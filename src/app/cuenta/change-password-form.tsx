"use client";

import { useActionState } from "react";

import { changePasswordAction } from "@/server/auth-actions";
import { emptyFormState } from "@/server/form-state";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, emptyFormState);

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

      <form action={formAction} className="inline-form">
        <div className="field">
          <label htmlFor="new-password">Nueva contraseña</label>
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="new-password-confirm">Repetir contraseña</label>
          <input
            id="new-password-confirm"
            name="password_confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <button className="button" type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </>
  );
}
