/**
 * Prepara las tres cuentas del aula:
 *   - Maria  → administradora (puede gestionar cuentas)
 *   - Hylary → miembro
 *   - Yeisy  → miembro
 *
 * Es idempotente: no toca cuentas que ya existan.
 *
 *   bun run scripts/create-accounts.ts
 *
 * La contraseña temporal se puede cambiar desde Ajustes → Cambiar contraseña.
 */
import { Effect } from "effect";

import { login, register } from "@/server/auth";
import { query } from "@/server/db";
import { AppLayer } from "@/server/runtime";

const TEMPORARY_PASSWORD = process.env["TEMP_PASSWORD"] ?? "Lans2026!";

const people = [
  { name: "Maria", username: "maria", role: "admin" as const },
  { name: "Hylary", username: "hylary", role: "member" as const },
  { name: "Yeisy", username: "yeisy", role: "member" as const },
];

function run<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> {
  return Effect.runPromise(Effect.provide(effect, AppLayer) as Effect.Effect<A, E, never>);
}

async function ensure(person: (typeof people)[number]): Promise<void> {
  const existing = await run(
    query("select user", (connection) =>
      connection
        .prepare("SELECT id, role FROM users WHERE username = ?")
        .get(person.username),
    ),
  );

  if (existing) {
    if (person.role === "admin" && (existing as { role: string }).role !== "admin") {
      await run(
        query("promote", (connection) =>
          connection
            .prepare("UPDATE users SET role = 'admin' WHERE username = ?")
            .run(person.username),
        ),
      );
      console.log(`↑ ${person.name} promocionada a administradora`);
    } else {
      console.log(`= ${person.name} ya existe`);
    }
    return;
  }

  await run(
    register(
      { name: person.name, username: person.username, password: TEMPORARY_PASSWORD },
      person.role,
    ),
  );

  console.log(`+ ${person.name} (${person.username}) creada`);
}

async function main(): Promise<void> {
  for (const person of people) {
    await ensure(person);
  }

  const session = await run(login("maria", TEMPORARY_PASSWORD)).catch(() => null);

  console.log("");
  console.log("Cuentas listas. Contraseña temporal:", TEMPORARY_PASSWORD);
  console.log("Cambiadla en Ajustes → Cambiar contraseña.");
  console.log(
    session
      ? "La contraseña de Maria coincide con la temporal."
      : "Maria ya tenía otra contraseña; se conserva la suya.",
  );
}

await main();
