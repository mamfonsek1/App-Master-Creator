import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Context, Data, Effect, Layer } from "effect";

import { paths } from "@/server/config";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: string;
  readonly reason: string;
}> {
  override get message(): string {
    return `Base de datos (${this.operation}): ${this.reason}`;
  }
}

export interface DatabaseShape {
  readonly connection: DatabaseSync;
}

export class Database extends Context.Tag("Database")<Database, DatabaseShape>() {}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS progress (
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id        TEXT NOT NULL,
  position_seconds REAL NOT NULL DEFAULT 0,
  completed        INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (user_id, lesson_id)
);
`;

/**
 * Migraciones incrementales. SQLite no tiene `ADD COLUMN IF NOT EXISTS`, así
 * que se comprueba el esquema antes de tocar nada.
 */
function migrate(connection: DatabaseSync): void {
  const columns = connection.prepare("PRAGMA table_info(users)").all() as unknown as ReadonlyArray<{
    name: string;
  }>;

  if (!columns.some((column) => column.name === "role")) {
    connection.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
  }

  const admins = connection
    .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")
    .get() as { total: number };

  if (admins.total === 0) {
    connection.exec(
      `UPDATE users SET role = 'admin'
        WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1)`,
    );
  }
}

function openDatabase(file: string): DatabaseSync {
  mkdirSync(path.dirname(file), { recursive: true });

  const connection = new DatabaseSync(file);
  connection.exec("PRAGMA journal_mode = WAL;");
  connection.exec("PRAGMA foreign_keys = ON;");
  connection.exec("PRAGMA busy_timeout = 5000;");
  connection.exec(SCHEMA);
  migrate(connection);

  return connection;
}

/**
 * SQLite local con WAL. El archivo vive en `data/aula.db` y no se versiona.
 * La capa abre la conexión y aplica el esquema una sola vez por proceso.
 */
export const DatabaseLive: Layer.Layer<Database, DatabaseError, never> = Layer.effect(
  Database,
  Effect.try({
    try: () => ({ connection: openDatabase(paths.databaseFile) }),
    catch: (cause) =>
      new DatabaseError({
        operation: "open",
        reason: cause instanceof Error ? cause.message : String(cause),
      }),
  }),
);

/** Ejecuta trabajo síncrono contra SQLite y normaliza el error. */
export function attempt<A>(operation: string, run: () => A): Effect.Effect<A, DatabaseError> {
  return Effect.try({
    try: run,
    catch: (cause) =>
      new DatabaseError({
        operation,
        reason: cause instanceof Error ? cause.message : String(cause),
      }),
  });
}

/** Igual que `attempt`, resolviendo la conexión desde el contexto. */
export function query<A>(
  operation: string,
  run: (connection: DatabaseSync) => A,
): Effect.Effect<A, DatabaseError, Database> {
  return Effect.gen(function* () {
    const { connection } = yield* Database;
    return yield* attempt(operation, () => run(connection));
  });
}
