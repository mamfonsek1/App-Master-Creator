"use client";

import { useActionState } from "react";

import { deleteUserAction, resetPasswordAction } from "@/server/auth-actions";
import { emptyFormState } from "@/server/form-state";

interface MemberActionsProps {
  readonly userId: string;
  readonly isSelf: boolean;
}

export function MemberActions({ userId, isSelf }: MemberActionsProps) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, emptyFormState);
  const fieldId = `password-${userId}`;

  return (
    <details className="member__actions">
      <summary>Gestionar</summary>

      <div className="member__panel">
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
          <input type="hidden" name="user_id" value={userId} />
          <div className="field">
            <label htmlFor={fieldId}>Nueva contraseña</label>
            <input
              id={fieldId}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <button className="button" type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Restablecer"}
          </button>
        </form>

        {isSelf ? null : (
          <form action={deleteUserAction} className="inline-form">
            <input type="hidden" name="user_id" value={userId} />
            <button className="button button--danger" type="submit">
              Eliminar cuenta
            </button>
          </form>
        )}
      </div>
    </details>
  );
}
