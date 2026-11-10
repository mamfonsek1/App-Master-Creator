import { cookies } from "next/headers";

export const SESSION_COOKIE = "aula_session";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/** Token de sesión de la petición actual, si lo hay. */
export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Solo se puede llamar desde una Server Action o un Route Handler. */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    // La app es local sobre http; marcar `secure` rompería el login en localhost.
    secure: false,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
