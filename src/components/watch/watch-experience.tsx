"use client";

import { useCallback, useMemo, useState } from "react";

import type { Course, Lesson } from "@/domain/course";
import type { LessonProgress, Progress } from "@/domain/progress";
import { LessonSidebar } from "@/components/watch/lesson-sidebar";
import { Player } from "@/components/watch/player";

interface WatchExperienceProps {
  readonly course: Course;
  readonly lesson: Lesson;
  readonly moduleTitle: string;
  readonly modulePosition: number;
  readonly progress: Progress;
  readonly previous: Lesson | null;
  readonly next: Lesson | null;
}

/**
 * Une reproductor y temario en un único estado de progreso: cuando el vídeo
 * guarda una posición, la barra lateral se actualiza sin recargar.
 */
export function WatchExperience({
  course,
  lesson,
  moduleTitle,
  modulePosition,
  progress,
  previous,
  next,
}: WatchExperienceProps) {
  const [entries, setEntries] = useState<Progress["lessons"]>(progress.lessons);

  const onSaved = useCallback((entry: LessonProgress) => {
    setEntries((current) => ({ ...current, [entry.lessonId]: entry }));
  }, []);

  const currentProgress = useMemo<Progress>(
    () => ({ version: 1, lessons: entries }),
    [entries],
  );

  return (
    <main className="shell watch">
      <div className="watch__main">
        <Player
          lesson={lesson}
          moduleTitle={moduleTitle}
          modulePosition={modulePosition}
          initialEntry={progress.lessons[lesson.id] ?? null}
          previous={previous}
          next={next}
          onSaved={onSaved}
        />
      </div>

      <LessonSidebar course={course} activeLessonId={lesson.id} progress={currentProgress} />
    </main>
  );
}
