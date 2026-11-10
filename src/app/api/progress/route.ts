import { Effect, Schema } from "effect";

import { CourseRepository } from "@/server/course-repository";
import { CourseLoadError } from "@/server/course-repository";
import { DatabaseError } from "@/server/db";
import { InvalidRequestError, LessonNotFoundError } from "@/server/errors";
import { currentUser } from "@/server/guards";
import { errorResponse, runRoute } from "@/server/http";
import { ProgressStore } from "@/server/progress-store";

export const dynamic = "force-dynamic";

const RecordBodySchema = Schema.Struct({
  lessonId: Schema.String.pipe(Schema.minLength(1)),
  positionSeconds: Schema.Number.pipe(Schema.nonNegative()),
  completed: Schema.Boolean,
});

type RecordBody = Schema.Schema.Type<typeof RecordBodySchema>;

type RouteError =
  | DatabaseError
  | CourseLoadError
  | LessonNotFoundError
  | InvalidRequestError;

function mapError(error: RouteError): Response {
  switch (error._tag) {
    case "LessonNotFoundError":
      return errorResponse(404, "lesson_not_found", error.message);
    case "InvalidRequestError":
      return errorResponse(400, "invalid_request", error.message);
    case "CourseLoadError":
      return errorResponse(500, "course_unavailable", error.message);
    case "DatabaseError":
      return errorResponse(500, "database_unavailable", error.message);
  }
}

export async function GET(): Promise<Response> {
  const user = await currentUser();

  if (!user) {
    return errorResponse(401, "unauthorized", "Inicia sesión para ver tu progreso.");
  }

  const program = Effect.gen(function* () {
    const store = yield* ProgressStore;
    return yield* store.read(user.id);
  });

  return runRoute(program, mapError, (progress) =>
    Response.json(progress, { headers: { "Cache-Control": "no-store" } }),
  );
}

export async function PUT(request: Request): Promise<Response> {
  const user = await currentUser();

  if (!user) {
    return errorResponse(401, "unauthorized", "Inicia sesión para guardar tu progreso.");
  }

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
    return yield* store.record(user.id, body);
  });

  return runRoute(program, mapError, (entry) =>
    Response.json(entry, { headers: { "Cache-Control": "no-store" } }),
  );
}
