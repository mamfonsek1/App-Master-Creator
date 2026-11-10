import { Effect, Schema } from "effect";

import { CourseLoadError, CourseRepository } from "@/server/course-repository";
import { InvalidRequestError, LessonNotFoundError } from "@/server/errors";
import { errorResponse, runRoute } from "@/server/http";
import { ProgressStore, ProgressStoreError } from "@/server/progress-store";

export const dynamic = "force-dynamic";

const RecordBodySchema = Schema.Struct({
  lessonId: Schema.String.pipe(Schema.minLength(1)),
  positionSeconds: Schema.Number.pipe(Schema.nonNegative()),
  completed: Schema.Boolean,
});

type RecordBody = Schema.Schema.Type<typeof RecordBodySchema>;

type RouteError =
  | CourseLoadError
  | ProgressStoreError
  | LessonNotFoundError
  | InvalidRequestError;

function mapError(error: RouteError): Response {
  if (error._tag === "LessonNotFoundError") {
    return errorResponse(404, "lesson_not_found", error.message);
  }

  if (error._tag === "InvalidRequestError") {
    return errorResponse(400, "invalid_request", error.message);
  }

  if (error._tag === "CourseLoadError") {
    return errorResponse(500, "course_unavailable", error.message);
  }

  return errorResponse(500, "progress_unavailable", error.message);
}

export async function GET(): Promise<Response> {
  const program = Effect.gen(function* () {
    const store = yield* ProgressStore;
    return yield* store.read;
  });

  return runRoute(program, mapError, (progress) =>
    Response.json(progress, { headers: { "Cache-Control": "no-store" } }),
  );
}

export async function PUT(request: Request): Promise<Response> {
  const program = Effect.gen(function* () {
    const payload = yield* Effect.tryPromise({
      try: () => request.json() as Promise<unknown>,
      catch: () => new InvalidRequestError({ detail: "El cuerpo no es JSON válido." }),
    });

    const body: RecordBody = yield* Schema.decodeUnknown(RecordBodySchema)(payload).pipe(
      Effect.mapError(
        (cause) => new InvalidRequestError({ detail: `Cuerpo inválido: ${cause.message}` }),
      ),
    );

    const repository = yield* CourseRepository;
    const index = yield* repository.index;

    if (!index.byId.has(body.lessonId)) {
      return yield* Effect.fail(new LessonNotFoundError({ lessonId: body.lessonId }));
    }

    const store = yield* ProgressStore;
    return yield* store.record(body);
  });

  return runRoute(program, mapError, (entry) =>
    Response.json(entry, { headers: { "Cache-Control": "no-store" } }),
  );
}
