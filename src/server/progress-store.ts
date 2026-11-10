import { Context, Effect, Layer } from "effect";

import type { LessonProgress, Progress } from "@/domain/progress";
import { Database, DatabaseError, attempt } from "@/server/db";

export interface RecordInput {
  readonly lessonId: string;
  readonly positionSeconds: number;
  readonly completed: boolean;
}

export interface ProgressStoreShape {
  readonly read: (userId: string) => Effect.Effect<Progress, DatabaseError>;
  readonly record: (
    userId: string,
    input: RecordInput,
  ) => Effect.Effect<LessonProgress, DatabaseError>;
}

export class ProgressStore extends Context.Tag("ProgressStore")<
  ProgressStore,
  ProgressStoreShape
>() {}

interface ProgressRow {
  readonly lesson_id: string;
  readonly position_seconds: number;
  readonly completed: number;
  readonly updated_at: string;
}

/**
 * Progreso por persona, guardado en SQLite.
 *
 * `record` es un upsert que nunca retrocede el estado: si una lección ya estaba
 * marcada como vista, sigue estándolo aunque se vuelva a reproducir.
 */
const make = Effect.gen(function* () {
  const { connection } = yield* Database;

  const read = (userId: string): Effect.Effect<Progress, DatabaseError> =>
    attempt("select progress", () =>
      connection
        .prepare(
          "SELECT lesson_id, position_seconds, completed, updated_at FROM progress WHERE user_id = ?",
        )
        .all(userId),
    ).pipe(
      Effect.map((rows) => {
        const lessons: Record<string, LessonProgress> = {};

        for (const row of rows as unknown as ReadonlyArray<ProgressRow>) {
          lessons[row.lesson_id] = {
            lessonId: row.lesson_id,
            positionSeconds: row.position_seconds,
            completed: row.completed === 1,
            updatedAt: row.updated_at,
          };
        }

        return { version: 1 as const, lessons };
      }),
    );

  const record = (
    userId: string,
    input: RecordInput,
  ): Effect.Effect<LessonProgress, DatabaseError> =>
    attempt("upsert progress", () => {
      const updatedAt = new Date().toISOString();
      const position = Math.max(0, Math.round(input.positionSeconds * 100) / 100);

      connection
        .prepare(
          `INSERT INTO progress (user_id, lesson_id, position_seconds, completed, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id, lesson_id) DO UPDATE SET
             position_seconds = excluded.position_seconds,
             completed = MAX(progress.completed, excluded.completed),
             updated_at = excluded.updated_at`,
        )
        .run(userId, input.lessonId, position, input.completed ? 1 : 0, updatedAt);

      const row = connection
        .prepare("SELECT completed FROM progress WHERE user_id = ? AND lesson_id = ?")
        .get(userId, input.lessonId) as { completed: number } | undefined;

      return {
        lessonId: input.lessonId,
        positionSeconds: position,
        completed: row?.completed === 1,
        updatedAt,
      } satisfies LessonProgress;
    });

  return { read, record } satisfies ProgressStoreShape;
});

export const ProgressStoreLive: Layer.Layer<ProgressStore, never, Database> = Layer.effect(
  ProgressStore,
  make,
);
