import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import { Data, Effect } from "effect";

import { Database, DatabaseError, query } from "@/server/db";

export type Role = "admin" | "member";

export interface User {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly role: Role;
  readonly createdAt: string;
}

export function isAdmin(user: User): boolean {
  return user.role === "admin";
}

export class InvalidCredentialsError extends Data.TaggedError("InvalidCredentialsError")<{
  readonly detail: string;
}> {
  override get message(): string {
    return this.detail;
  }
}

export class UsernameTakenError extends Data.TaggedError("UsernameTakenError")<{
  readonly username: string;
}> {
  override get message(): string {
    return `El usuario "${this.username}" ya existe.`;
  }
}

export class AccountValidationError extends Data.TaggedError("AccountValidationError")<{
  readonly detail: string;
}> {
  override get message(): string {
    return this.detail;
  }
}

export interface Credentials {
  readonly name: string;
  readonly username: string;
  readonly password: string;
}

const SESSION_DAYS = 30;
const PASSWORD_MIN_LENGTH = 8;
const SCRYPT_KEY_LENGTH = 64;

interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly password_hash: string;
  readonly role: string;
  readonly created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role === "admin" ? "admin" : "member",
    createdAt: row.created_at,
  };
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltPart, hashPart] = stored.split("$");

  if (scheme !== "scrypt" || !saltPart || !hashPart) {
    return false;
  }

  const expected = Buffer.from(hashPart, "base64");
  const actual = scryptSync(password, Buffer.from(saltPart, "base64"), expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function tokenId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function validate(credentials: Credentials): Effect.Effect<void, AccountValidationError> {
  const name = credentials.name.trim();
  const username = credentials.username.trim().toLowerCase();
  const password = credentials.password;

  if (name.length < 2) {
    return Effect.fail(new AccountValidationError({ detail: "El nombre es demasiado corto." }));
  }

  if (!/^[a-z0-9._-]{3,24}$/.test(username)) {
    return Effect.fail(
      new AccountValidationError({
        detail:
          "El usuario debe tener entre 3 y 24 caracteres: letras, números, punto, guion o guion bajo.",
      }),
    );
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return Effect.fail(
      new AccountValidationError({
        detail: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
      }),
    );
  }

  return Effect.void;
}

export function countUsers(): Effect.Effect<number, never, Database> {
  return query("count users", (connection) =>
    connection.prepare("SELECT COUNT(*) AS total FROM users").get(),
  ).pipe(
    Effect.map((row) => Number((row as { total: number }).total)),
    Effect.orElseSucceed(() => 0),
  );
}

export function register(
  credentials: Credentials,
  role: Role = "member",
): Effect.Effect<
  User,
  AccountValidationError | UsernameTakenError | DatabaseError,
  Database
> {
  return Effect.gen(function* () {
    yield* validate(credentials);

    const name = credentials.name.trim();
    const username = credentials.username.trim().toLowerCase();

    const existing = yield* query("select user by username", (connection) =>
      connection.prepare("SELECT id FROM users WHERE username = ?").get(username),
    );

    if (existing) {
      return yield* Effect.fail(new UsernameTakenError({ username }));
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();

    yield* query("insert user", (connection) =>
      connection
        .prepare(
          "INSERT INTO users (id, name, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(id, name, username, hashPassword(credentials.password), role, createdAt),
    );

    return { id, name, username, role, createdAt };
  });
}

/** Cambia la contraseña de una cuenta. */
export function setPassword(
  userId: string,
  password: string,
): Effect.Effect<void, AccountValidationError | DatabaseError, Database> {
  return Effect.gen(function* () {
    if (password.length < PASSWORD_MIN_LENGTH) {
      return yield* Effect.fail(
        new AccountValidationError({
          detail: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
        }),
      );
    }

    yield* query("update password", (connection) =>
      connection
        .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
        .run(hashPassword(password), userId),
    );
  });
}

/** Elimina una cuenta y todo lo suyo (sesiones y progreso, por FK en cascada). */
export function deleteUser(userId: string): Effect.Effect<void, DatabaseError, Database> {
  return query("delete user", (connection) =>
    connection.prepare("DELETE FROM users WHERE id = ?").run(userId),
  ).pipe(Effect.asVoid);
}

export function login(
  username: string,
  password: string,
): Effect.Effect<
  { readonly user: User; readonly token: string },
  InvalidCredentialsError | DatabaseError,
  Database
> {
  return Effect.gen(function* () {
    const normalized = username.trim().toLowerCase();

    const row = yield* query("select user", (connection) =>
      connection.prepare("SELECT * FROM users WHERE username = ?").get(normalized),
    );

    if (!row) {
      return yield* Effect.fail(
        new InvalidCredentialsError({ detail: "Usuario o contraseña incorrectos." }),
      );
    }

    const record = row as unknown as UserRow;

    if (!verifyPassword(password, record.password_hash)) {
      return yield* Effect.fail(
        new InvalidCredentialsError({ detail: "Usuario o contraseña incorrectos." }),
      );
    }

    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    yield* query("insert session", (connection) =>
      connection
        .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
        .run(tokenId(token), record.id, now.toISOString(), expires.toISOString()),
    );

    return { user: toUser(record), token };
  });
}

export function userForToken(token: string): Effect.Effect<User | null, never, Database> {
  return query("select session", (connection) =>
    connection
      .prepare(
        `SELECT u.* FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.id = ? AND s.expires_at > ?`,
      )
      .get(tokenId(token), new Date().toISOString()),
  ).pipe(
    Effect.map((row) => (row ? toUser(row as unknown as UserRow) : null)),
    Effect.orElseSucceed(() => null),
  );
}

export function destroySession(token: string): Effect.Effect<void, never, Database> {
  return query("delete session", (connection) =>
    connection.prepare("DELETE FROM sessions WHERE id = ?").run(tokenId(token)),
  ).pipe(
    Effect.asVoid,
    Effect.orElseSucceed(() => undefined),
  );
}

export function listUsers(): Effect.Effect<ReadonlyArray<User>, never, Database> {
  return query("list users", (connection) =>
    connection.prepare("SELECT * FROM users ORDER BY created_at ASC").all(),
  ).pipe(
    Effect.map((rows) => (rows as unknown as ReadonlyArray<UserRow>).map(toUser)),
    Effect.orElseSucceed(() => []),
  );
}
