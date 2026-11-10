/** Estado compartido por los formularios de autenticación. */
export interface FormState {
  readonly error: string | null;
  readonly success: string | null;
}

export const emptyFormState: FormState = { error: null, success: null };
