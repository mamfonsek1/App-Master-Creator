"use server";

import { Effect, Either } from "effect";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  countUsers,
  deleteUser,
  destroySession,
  login,
  register,
  setPassword,
  type Credentials,
} from "@/server/auth";
import { requireAdmin, requireUser } from "@/server/guards";
import { AppLayer } from "@/server/runtime";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "@/server/session";
import type { FormState } from "@/server/form-state";

function readCredentials(formData: FormData): Credentials {
  return {
    name: String(formData.get("name") ?? ""),
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return "Algo ha fallado. Inténtalo de nuevo.";
}

export async function loginAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await Effect.runPromise(
    Effect.either(login(username, password).pipe(Effect.provide(AppLayer))),
  );

  if (Either.isLeft(result)) {
    return { error: messageOf(result.left), success: null };
  }

  await setSessionCookie(result.right.token);
  redirect("/");
}

export async function setupAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await Effect.runPromise(
    countUsers().pipe(Effect.provide(AppLayer), Effect.orElseSucceed(() => 0)),
  );

  if (existing > 0) {
    redirect("/login");
  }

  const credentials = readCredentials(formData);
  const confirmation = String(formData.get("password_confirm") ?? "");

  if (credentials.password !== confirmation) {
    return { error: "Las contraseñas no coinciden.", success: null };
  }

  const created = await Effect.runPromise(
    Effect.either(register(credentials).pipe(Effect.provide(AppLayer))),
  );

  if (Either.isLeft(created)) {
    return { error: messageOf(created.left), success: null };
  }

  const session = await Effect.runPromise(
    Effect.either(
      login(credentials.username, credentials.password).pipe(Effect.provide(AppLayer)),
    ),
  );

  if (Either.isLeft(session)) {
    return { error: "La cuenta se creó, pero no se pudo iniciar sesión.", success: null };
  }

  await setSessionCookie(session.right.token);
  redirect("/");
}

export async function registerAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const credentials = readCredentials(formData);

  const created = await Effect.runPromise(
    Effect.either(register(credentials).pipe(Effect.provide(AppLayer))),
  );

  if (Either.isLeft(created)) {
    return { error: messageOf(created.left), success: null };
  }

  revalidatePath("/cuenta");

  return {
    error: null,
    success: `Cuenta creada para ${created.right.name}. Ya puede iniciar sesión.`,
  };
}

export async function changePasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirm") ?? "");

  if (password !== confirmation) {
    return { error: "Las contraseñas no coinciden.", success: null };
  }

  const result = await Effect.runPromise(
    Effect.either(setPassword(user.id, password).pipe(Effect.provide(AppLayer))),
  );

  if (Either.isLeft(result)) {
    return { error: messageOf(result.left), success: null };
  }

  return { error: null, success: "Contraseña actualizada." };
}

export async function resetPasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const userId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (userId.length === 0) {
    return { error: "Falta la cuenta.", success: null };
  }

  const result = await Effect.runPromise(
    Effect.either(setPassword(userId, password).pipe(Effect.provide(AppLayer))),
  );

  if (Either.isLeft(result)) {
    return { error: messageOf(result.left), success: null };
  }

  return { error: null, success: "Contraseña restablecida." };
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");

  if (userId === admin.id) {
    redirect("/cuenta?error=self");
  }

  await Effect.runPromise(
    deleteUser(userId).pipe(Effect.provide(AppLayer), Effect.orElseSucceed(() => undefined)),
  );

  revalidatePath("/cuenta");
  redirect("/cuenta");
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionToken();

  if (token) {
    await Effect.runPromise(
      destroySession(token).pipe(Effect.provide(AppLayer), Effect.orElseSucceed(() => undefined)),
    );
  }

  await clearSessionCookie();
  redirect("/login");
}
