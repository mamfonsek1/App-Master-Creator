import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { Effect } from "effect";

import { findLesson } from "@/domain/course";
import { CourseLoadError, CourseRepository } from "@/server/course-repository";
import { DatabaseError } from "@/server/db";
import { InvalidRequestError, LessonNotFoundError } from "@/server/errors";
import { currentUser } from "@/server/guards";
import { errorResponse, runRoute } from "@/server/http";
import { contentRange, parseRange, resolveMediaPath } from "@/server/media";

export const dynamic = "force-dynamic";

interface RouteContext {
  readonly params: Promise<{ readonly path: ReadonlyArray<string> }>;
}

type RouteError = DatabaseError | CourseLoadError | LessonNotFoundError | InvalidRequestError;

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

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const user = await currentUser();

  if (!user) {
    return errorResponse(401, "unauthorized", "Inicia sesión para ver el curso.");
  }

  const { path: segments } = await context.params;
  const lessonId = segments.join("/");

  const program = Effect.gen(function* () {
    const repository = yield* CourseRepository;
    const index = yield* repository.index;
    const location = findLesson(index, lessonId);

    if (!location) {
      return yield* Effect.fail(new LessonNotFoundError({ lessonId }));
    }

    const filePath = resolveMediaPath(location.lesson.file);

    if (!filePath) {
      return yield* Effect.fail(
        new InvalidRequestError({ detail: "La ruta del archivo no es válida." }),
      );
    }

    const size = yield* Effect.tryPromise({
      try: () => stat(filePath).then((stats) => stats.size),
      catch: () => new LessonNotFoundError({ lessonId }),
    });

    const range = parseRange(request.headers.get("range"), size);

    if (range.kind === "unsatisfiable") {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }

    const start = range.kind === "partial" ? range.range.start : 0;
    const end = range.kind === "partial" ? range.range.end : size - 1;

    const body = Readable.toWeb(
      createReadStream(filePath, { start, end }),
    ) as unknown as ReadableStream<Uint8Array>;

    const headers = new Headers({
      "Content-Type": "video/mp4",
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=0, must-revalidate",
    });

    if (range.kind === "partial") {
      headers.set("Content-Range", contentRange({ start, end }, size));
    }

    return new Response(body, {
      status: range.kind === "partial" ? 206 : 200,
      headers,
    });
  });

  return runRoute(program, mapError, (response) => response);
}
