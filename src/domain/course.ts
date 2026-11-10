import { Schema } from "effect";

/**
 * Modelo de contenido del curso.
 *
 * El curso es estático: `content/course.json` se genera una sola vez con
 * `bun run content:build` a partir del manifest de la plataforma y de los
 * archivos presentes en `media/`. La aplicación nunca modifica este modelo.
 */

export const LessonSchema = Schema.Struct({
  /** Identificador estable: `<moduleId>/<NN>-<slug>`. */
  id: Schema.String,
  moduleId: Schema.String,
  title: Schema.String,
  /** Posición dentro del módulo, empezando en 1. */
  position: Schema.Int,
  durationSeconds: Schema.Int,
  bytes: Schema.Int,
  /** Ruta relativa dentro de `media/`, siempre con separadores `/`. */
  file: Schema.String,
});

export type Lesson = Schema.Schema.Type<typeof LessonSchema>;

export const ModuleSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  position: Schema.Int,
  lessons: Schema.Array(LessonSchema),
  durationSeconds: Schema.Int,
});

export type Module = Schema.Schema.Type<typeof ModuleSchema>;

export const CourseSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  subtitle: Schema.String,
  source: Schema.String,
  generatedAt: Schema.String,
  modules: Schema.Array(ModuleSchema),
  lessonCount: Schema.Int,
  durationSeconds: Schema.Int,
  bytes: Schema.Int,
});

export type Course = Schema.Schema.Type<typeof CourseSchema>;

export interface LessonLocation {
  readonly module: Module;
  readonly lesson: Lesson;
  readonly moduleIndex: number;
  readonly lessonIndex: number;
}

export interface CourseIndex {
  readonly byId: ReadonlyMap<string, LessonLocation>;
  readonly order: ReadonlyArray<Lesson>;
}

/** Índice plano para resolver lecciones por id y navegar secuencialmente. */
export function buildCourseIndex(course: Course): CourseIndex {
  const byId = new Map<string, LessonLocation>();
  const order: Lesson[] = [];

  course.modules.forEach((module, moduleIndex) => {
    module.lessons.forEach((lesson, lessonIndex) => {
      byId.set(lesson.id, { module, lesson, moduleIndex, lessonIndex });
      order.push(lesson);
    });
  });

  return { byId, order };
}

export function findLesson(index: CourseIndex, lessonId: string): LessonLocation | null {
  return index.byId.get(lessonId) ?? null;
}

export interface LessonNeighbours {
  readonly previous: Lesson | null;
  readonly next: Lesson | null;
}

export function neighboursOf(index: CourseIndex, lessonId: string): LessonNeighbours {
  const position = index.order.findIndex((lesson) => lesson.id === lessonId);

  if (position === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: index.order[position - 1] ?? null,
    next: index.order[position + 1] ?? null,
  };
}

/** Duración total reproducida, en segundos, de un conjunto de lecciones. */
export function totalDuration(lessons: ReadonlyArray<Pick<Lesson, "durationSeconds">>): number {
  return lessons.reduce((total, lesson) => total + lesson.durationSeconds, 0);
}
