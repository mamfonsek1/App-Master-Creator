"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { CheckIcon, CircleIcon, PlayIcon } from "@/components/icons";
import type { Course } from "@/domain/course";
import type { Progress } from "@/domain/progress";
import { formatClock, formatPercent } from "@/lib/format";

interface LessonSidebarProps {
  readonly course: Course;
  readonly activeLessonId: string;
  readonly progress: Progress;
}

export function LessonSidebar({ course, activeLessonId, progress }: LessonSidebarProps) {
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLessonId]);

  const completed = Object.values(progress.lessons).filter((entry) => entry.completed).length;
  const ratio = course.lessonCount === 0 ? 0 : completed / course.lessonCount;

  return (
    <aside className="sidebar" aria-label="Contenido del curso">
      <div className="sidebar__head">
        <h3>Contenido del curso</h3>
        <div className="progress-bar progress-bar--light" style={{ marginTop: 12 }}>
          <span className="progress-bar__fill" style={{ width: `${ratio * 100}%` }} />
        </div>
        <p style={{ marginTop: 10, fontSize: 12, color: "var(--grey)" }}>
          {completed} de {course.lessonCount} vistas · {formatPercent(ratio)}
        </p>
      </div>

      <div className="sidebar__scroll">
        {course.modules.map((module) => {
          const done = module.lessons.filter(
            (lesson) => progress.lessons[lesson.id]?.completed === true,
          ).length;

          return (
            <section key={module.id}>
              <div className="sidebar__module">
                <span>{module.title}</span>
                <span>
                  {done}/{module.lessons.length}
                </span>
              </div>

              {module.lessons.map((lesson) => {
                const isActive = lesson.id === activeLessonId;
                const isDone = progress.lessons[lesson.id]?.completed === true;

                return (
                  <Link
                    key={lesson.id}
                    ref={isActive ? activeRef : null}
                    href={`/leccion/${lesson.id}`}
                    className={[
                      "sidebar__lesson",
                      isActive ? "sidebar__lesson--active" : "",
                      isDone ? "sidebar__lesson--done" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="sidebar__check">
                      {isDone ? <CheckIcon size={12} /> : isActive ? <PlayIcon size={11} /> : <CircleIcon size={12} />}
                    </span>
                    <span className="sidebar__lesson-title">{lesson.title}</span>
                    <span className="sidebar__lesson-time">
                      {formatClock(lesson.durationSeconds)}
                    </span>
                  </Link>
                );
              })}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
