import { Effect } from "effect";
import { redirect } from "next/navigation";

import { isAdmin, userForToken, type User } from "@/server/auth";
import { AppLayer } from "@/server/runtime";
import { readSessionToken } from "@/server/session";

/** Usuario de la sesión actual, o `null` si no hay cookie válida. */
export async function currentUser(): Promise<User | null> {
  const token = await readSessionToken();

  if (!token) {
    return null;
  }

  return Effect.runPromise(
    userForToken(token).pipe(
      Effect.provide(AppLayer),
      Effect.orElseSucceed(() => null),
    ),
  );
}

/** Exige sesión: redirige a /login cuando no la hay. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/** Exige sesión de administrador: el resto vuelve a su cuenta. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();

  if (!isAdmin(user)) {
    redirect("/cuenta");
  }

  return user;
}
