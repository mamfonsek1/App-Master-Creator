import { Schema } from "effect";

/**
 * Progreso de reproducción.
 *
 * Se guarda en `data/progress.json` y es el único estado mutable de la
 * aplicación. No hay usuarios ni sesiones: es un entorno local de una persona.
 */

export const LessonProgressSchema = Schema.Struct({
  lessonId: Schema.String,
  /** Segundo en el que se quedó la última reproducción. */
  positionSeconds: Schema.Number.pipe(Schema.nonNegative()),
  completed: Schema.Boolean,
  /** ISO-8601 del último cambio. */
  updatedAt: Schema.String,
});

export type LessonProgress = Schema.Schema.Type<typeof LessonProgressSchema>;

export const ProgressSchema = Schema.Struct({
  version: Schema.Literal(1),
  lessons: Schema.Record({ key: Schema.String, value: LessonProgressSchema }),
});

export type Progress = Schema.Schema.Type<typeof ProgressSchema>;

export const emptyProgress = (): Progress => ({ version: 1, lessons: {} });

export interface CourseProgressSummary {
  readonly totalLessons: number;
  readonly completedLessons: number;
  readonly startedLessons: number;
  readonly completedRatio: number;
  readonly remainingSeconds: number;
}

/**
 * Resumen agregado del progreso. `remainingSeconds` descuenta lo ya visto de
 * cada lección, de modo que sirve para estimar cuánto queda de curso.
 */
export function summarize(
  lessons: ReadonlyArray<{ readonly id: string; readonly durationSeconds: number }>,
  progress: Progress,
): CourseProgressSummary {
  let completedLessons = 0;
  let startedLessons = 0;
  let remainingSeconds = 0;

  for (const lesson of lessons) {
    const entry = progress.lessons[lesson.id];

    if (!entry) {
      remainingSeconds += lesson.durationSeconds;
      continue;
    }

    if (entry.completed) {
      completedLessons += 1;
      continue;
    }

    startedLessons += 1;
    const watched = Math.min(entry.positionSeconds, lesson.durationSeconds);
    remainingSeconds += Math.max(lesson.durationSeconds - watched, 0);
  }

  const totalLessons = lessons.length;

  return {
    totalLessons,
    completedLessons,
    startedLessons,
    completedRatio: totalLessons === 0 ? 0 : completedLessons / totalLessons,
    remainingSeconds: Math.round(remainingSeconds),
  };
}
