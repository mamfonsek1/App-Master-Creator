import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Context, Data, Effect, Layer, Schema } from "effect";

import { CourseSchema, buildCourseIndex, type Course, type CourseIndex } from "@/domain/course";
import { paths } from "@/server/config";

export class CourseLoadError extends Data.TaggedError("CourseLoadError")<{
  readonly file: string;
  readonly reason: string;
}> {
  override get message(): string {
    return `No se pudo cargar el curso desde ${this.file}: ${this.reason}`;
  }
}

export interface CourseRepositoryShape {
  /** Curso completo, ya validado contra el esquema. */
  readonly course: Effect.Effect<Course, CourseLoadError>;
  /** Índice plano para resolver lecciones por id. */
  readonly index: Effect.Effect<CourseIndex, CourseLoadError>;
}

export class CourseRepository extends Context.Tag("CourseRepository")<
  CourseRepository,
  CourseRepositoryShape
>() {}

/**
 * Lee `content/course.json` una sola vez por proceso y lo mantiene en memoria.
 * La capa no hace E/S al construirse: el primer acceso dispara la lectura, así
 * que un contenido ausente se ve como error de la petición y no del arranque.
 */
const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;

  const load: Effect.Effect<Course, CourseLoadError> = Effect.gen(function* () {
    const raw = yield* fileSystem.readFileString(paths.courseFile).pipe(
      Effect.mapError(
        (cause) =>
          new CourseLoadError({
            file: paths.courseFile,
            reason: cause.message,
          }),
      ),
    );

    const parsed = yield* Effect.try({
      try: () => JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown,
      catch: (cause) =>
        new CourseLoadError({
          file: paths.courseFile,
          reason: `JSON inválido (${String(cause)})`,
        }),
    });

    return yield* Schema.decodeUnknown(CourseSchema)(parsed).pipe(
      Effect.mapError(
        (cause) =>
          new CourseLoadError({
            file: paths.courseFile,
            reason: `El contenido no cumple el esquema (${cause.message})`,
          }),
      ),
    );
  });

  const cached = yield* Effect.cached(load);

  return {
    course: cached,
    index: cached.pipe(Effect.map(buildCourseIndex)),
  } satisfies CourseRepositoryShape;
});

export const CourseRepositoryLive: Layer.Layer<CourseRepository, never, never> = Layer.effect(
  CourseRepository,
  make,
).pipe(Layer.provide(NodeFileSystem.layer));
