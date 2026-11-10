/**
 * Smoke test de la capa de datos: cuentas, roles, sesiones y progreso.
 *
 * Se ejecuta contra una base temporal para no tocar la real:
 *   DATABASE_FILE=data/verify.db bun run scripts/smoke.ts
 */
import { Effect, Either } from "effect";

import {
  countUsers,
  deleteUser,
  destroySession,
  isAdmin,
  listUsers,
  login,
  register,
  setPassword,
  userForToken,
} from "@/server/auth";
import { ProgressStore } from "@/server/progress-store";
import { AppLayer } from "@/server/runtime";

function run<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> {
  // La capa cubre todos los servicios de la app; el cast evita que TS tenga que
  // reducir `Exclude<R, AppServices>` con un `R` genérico.
  return Effect.runPromise(Effect.provide(effect, AppLayer) as Effect.Effect<A, E, never>);
}

function check(label: string, condition: boolean): void {
  console.log(`${condition ? "✓" : "✗"} ${label}`);

  if (!condition) {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  check(`base vacía (${await run(countUsers())} usuarios)`, (await run(countUsers())) === 0);

  const maria = await run(
    register({ name: "Maria", username: "maria", password: "cursolans2026" }, "admin"),
  );
  const hylary = await run(
    register({ name: "Hylary", username: "hylary", password: "cursolans2026" }),
  );

  check("Maria es administradora", isAdmin(maria));
  check("Hylary es miembro", !isAdmin(hylary));

  const duplicate = await run(
    Effect.either(register({ name: "Otra", username: "MARIA", password: "cursolans2026" })),
  );
  check("usuario duplicado rechazado", Either.isLeft(duplicate));

  const shortPassword = await run(
    Effect.either(register({ name: "Corta", username: "corta", password: "123" })),
  );
  check("contraseña corta rechazada", Either.isLeft(shortPassword));

  const wrongPassword = await run(Effect.either(login("maria", "incorrecta")));
  check("contraseña incorrecta rechazada", Either.isLeft(wrongPassword));

  const session = await run(login("maria", "cursolans2026"));
  check("la sesión resuelve al usuario", (await run(userForToken(session.token)))?.id === maria.id);

  const store = await run(
    Effect.gen(function* () {
      return yield* ProgressStore;
    }),
  );

  const lessonId = "manicura/01-brocas-para-manicura";
  await run(store.record(maria.id, { lessonId, positionSeconds: 42.5, completed: false }));

  const mariaProgress = await run(store.read(maria.id));
  const hylaryProgress = await run(store.read(hylary.id));

  check("progreso guardado para Maria", mariaProgress.lessons[lessonId]?.positionSeconds === 42.5);
  check("progreso aislado por persona", hylaryProgress.lessons[lessonId] === undefined);

  await run(store.record(maria.id, { lessonId, positionSeconds: 300, completed: true }));
  await run(store.record(maria.id, { lessonId, positionSeconds: 10, completed: false }));
  const completed = await run(store.read(maria.id));
  check("reproducir no desmarca la lección", completed.lessons[lessonId]?.completed === true);

  await run(setPassword(hylary.id, "nuevaClave2026"));
  check(
    "cambio de contraseña aplicado",
    Either.isRight(await run(Effect.either(login("hylary", "nuevaClave2026")))),
  );

  await run(destroySession(session.token));
  check("sesión cerrada deja de resolver", (await run(userForToken(session.token))) === null);

  await run(deleteUser(hylary.id));
  const remaining = await run(listUsers());
  check(
    `eliminar cuenta borra su progreso (${remaining.length} cuentas)`,
    remaining.length === 1 && (await run(store.read(hylary.id))).lessons[lessonId] === undefined,
  );
}

await main();
