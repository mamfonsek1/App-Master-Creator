import path from "node:path";

import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Context, Data, Effect, Either, Layer, Option, Ref, Schema } from "effect";

import {
  ProgressSchema,
  emptyProgress,
  type LessonProgress,
  type Progress,
} from "@/domain/progress";
import { paths } from "@/server/config";

export class ProgressStoreError extends Data.TaggedError("ProgressStoreError")<{
  readonly operation: "write";
  readonly file: string;
  readonly reason: string;
}> {
  override get message(): string {
    return `No se pudo guardar el progreso en ${this.file}: ${this.reason}`;
  }
}

export interface RecordInput {
  readonly lessonId: string;
  readonly positionSeconds: number;
  readonly completed: boolean;
}

export interface ProgressStoreShape {
  readonly read: Effect.Effect<Progress>;
  readonly record: (input: RecordInput) => Effect.Effect<LessonProgress, ProgressStoreError>;
}

export class ProgressStore extends Context.Tag("ProgressStore")<
  ProgressStore,
  ProgressStoreShape
>() {}

/**
 * Estado de progreso persistido en `data/progress.json`.
 *
 * - La primera lectura carga el archivo; si estÃ¡ corrupto se archiva y se
 *   empieza de cero, dejando constancia en el log.
 * - Cada escritura es atÃ³mica (temporal + rename) y se serializa con un
 *   semÃ¡foro, de modo que dos peticiones simultÃ¡neas no dejan el JSON a medias.
 */
const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const mutex = yield* Effect.makeSemaphore(1);
  const cache = yield* Ref.make<Option.Option<Progress>>(Option.none());

  const load = Effect.gen(function* () {
    const exists = yield* fileSystem
      .exists(paths.progressFile)
      .pipe(Effect.orElseSucceed(() => false));

    if (!exists) {
      return emptyProgress();
    }

    const raw = yield* fileSystem.readFileString(paths.progressFile).pipe(Effect.option);

    if (Option.isNone(raw)) {
      yield* Effect.logWarning(`No se pudo leer ${paths.progressFile}; se empieza de cero.`);
      return emptyProgress();
    }

    const decoded = yield* Effect.try({
      try: () => JSON.parse(raw.value) as unknown,
      catch: (cause) => cause,
    }).pipe(
      Effect.flatMap((json) => Schema.decodeUnknown(ProgressSchema)(json)),
      Effect.either,
    );

    if (Either.isLeft(decoded)) {
      const backup = `${paths.progressFile}.corrupt-${Date.now()}`;
      yield* fileSystem.rename(paths.progressFile, backup).pipe(Effect.ignore);
      yield* Effect.logWarning(
        `Progreso ilegible; se archivÃ³ en ${backup} y se empieza de cero.`,
      );
      return emptyProgress();
    }

    return decoded.right;
  });

  const current = Effect.gen(function* () {
    const cached = yield* Ref.get(cache);

    if (Option.isSome(cached)) {
      return cached.value;
    }

    const loaded = yield* load;
    yield* Ref.set(cache, Option.some(loaded));
    return loaded;
  });

  const persist = (snapshot: Progress): Effect.Effect<void, ProgressStoreError> =>
    Effect.gen(function* () {
      const temporary = `${paths.progressFile}.tmp`;
      const payload = `${JSON.stringify(snapshot, null, 2)}\n`;

      // En un clon limpio la carpeta `data/` no existe todavÃ­a.
      yield* fileSystem.makeDirectory(path.dirname(paths.progressFile), { recursive: true }).pipe(
        Effect.mapError(
          (cause) =>
            new ProgressStoreError({
              operation: "write",
              file: path.dirname(paths.progressFile),
              reason: cause.message,
            }),
        ),
      );

      yield* fileSystem.writeFileString(temporary, payload).pipe(
        Effect.mapError(
          (cause) =>
            new ProgressStoreError({
              operation: "write",
              file: temporary,
              reason: cause.message,
            }),
        ),
      );

      yield* fileSystem.rename(temporary, paths.progressFile).pipe(
        Effect.mapError(
          (cause) =>
            new ProgressStoreError({
              operation: "write",
              file: paths.progressFile,
              reason: cause.message,
            }),
        ),
      );
    });

  return {
    read: current,
    record: (input: RecordInput) =>
      mutex.withPermits(1)(
        Effect.gen(function* () {
          const snapshot = yield* current;
          const previous = snapshot.lessons[input.lessonId];

          const entry: LessonProgress = {
            lessonId: input.lessonId,
            positionSeconds: Math.max(0, Math.round(input.positionSeconds * 100) / 100),
            completed: input.completed || (previous?.completed ?? false),
            updatedAt: new Date().toISOString(),
          };

          const next: Progress = {
            version: 1,
            lessons: { ...snapshot.lessons, [input.lessonId]: entry },
          };

          yield* persist(next);
          yield* Ref.set(cache, Option.some(next));

          return entry;
        }),
      ),
  } satisfies ProgressStoreShape;
});

export const ProgressStoreLive: Layer.Layer<ProgressStore, never, never> = Layer.effect(
  ProgressStore,
  make,
).pipe(Layer.provide(NodeFileSystem.layer));
