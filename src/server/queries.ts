import { Effect } from "effect";

import type { Course } from "@/domain/course";
import type { Progress } from "@/domain/progress";
import { CourseRepository } from "@/server/course-repository";
import { ProgressStore } from "@/server/progress-store";
import { AppLayer } from "@/server/runtime";

/**
 * Acceso a datos desde componentes de servidor. Los errores se propagan: si el
 * contenido falta o está corrupto, la aplicación debe fallar de forma visible,
 * no mostrar una página vacía.
 */

export async function loadCourse(): Promise<Course> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const repository = yield* CourseRepository;
      return yield* repository.course;
    }).pipe(Effect.provide(AppLayer)),
  );
}

export async function loadProgress(): Promise<Progress> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* ProgressStore;
      return yield* store.read;
    }).pipe(Effect.provide(AppLayer)),
  );
}
