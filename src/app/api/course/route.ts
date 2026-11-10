import { Effect } from "effect";

import { CourseLoadError, CourseRepository } from "@/server/course-repository";
import { DatabaseError } from "@/server/db";
import { errorResponse, runRoute } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const program = Effect.gen(function* () {
    const repository = yield* CourseRepository;
    return yield* repository.course;
  });

  return runRoute(
    program,
    (error: CourseLoadError | DatabaseError) =>
      error._tag === "DatabaseError"
        ? errorResponse(500, "database_unavailable", error.message)
        : errorResponse(500, "course_unavailable", error.message),
    (course) =>
      Response.json(course, {
        headers: { "Cache-Control": "no-store" },
      }),
  );
}
