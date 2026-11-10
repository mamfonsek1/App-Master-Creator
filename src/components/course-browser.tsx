"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { Course, Lesson, Module } from "@/domain/course";
import type { Progress } from "@/domain/progress";
import { formatClock, formatDuration, normalizeText } from "@/lib/format";
import { CheckIcon, SearchIcon } from "@/components/icons";

interface CourseBrowserProps {
  readonly course: Course;
  readonly progress: Progress;
}

interface ModuleView {
  readonly module: Module;
  readonly lessons: ReadonlyArray<Lesson>;
}

function lessonHref(lesson: Lesson): string {
  return `/leccion/${lesson.id}`;
}

export function CourseBrowser({ course, progress }: CourseBrowserProps) {
  const [query, setQuery] = useState("");

  const modules = useMemo<ReadonlyArray<ModuleView>>(() => {
    const needle = normalizeText(query.trim());

    if (needle.length === 0) {
      return course.modules.map((module) => ({ module, lessons: module.lessons }));
    }

    return course.modules
      .map((module) => ({
        module,
        lessons: module.lessons.filter(
          (lesson) =>
            normalizeText(lesson.title).includes(needle) ||
            normalizeText(module.title).includes(needle),
        ),
      }))
      .filter((entry) => entry.lessons.length > 0);
  }, [course, query]);

  const totalMatches = modules.reduce((total, entry) => total + entry.lessons.length, 0);

  return (
    <section className="course" aria-labelledby="temario">
      <div className="shell">
        <div className="course__toolbar">
          <div>
            <span className="label">Temario</span>
            <h2 id="temario">Lección a lección</h2>
          </div>

          <div className="search">
            <span className="search__icon">
              <SearchIcon />
            </span>
            <label htmlFor="lesson-search" className="sr-only">
              Buscar lección
            </label>
            <input
              id="lesson-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por lección o módulo…"
              autoComplete="off"
            />
          </div>
        </div>

        {modules.length === 0 ? (
          <p className="empty-state">
            No hay lecciones que coincidan con «{query.trim()}».
          </p>
        ) : (
          modules.map(({ module, lessons }) => (
            <ModuleSection
              key={module.id}
              module={module}
              lessons={lessons}
              progress={progress}
            />
          ))
        )}

        {query.trim().length > 0 && modules.length > 0 ? (
          <p className="empty-state" aria-live="polite">
            {totalMatches} de {course.lessonCount} lecciones coinciden con «{query.trim()}».
          </p>
        ) : null}
      </div>
    </section>
  );
}

interface ModuleSectionProps {
  readonly module: Module;
  readonly lessons: ReadonlyArray<Lesson>;
  readonly progress: Progress;
}

function ModuleSection({ module, lessons, progress }: ModuleSectionProps) {
  const completed = module.lessons.filter(
    (lesson) => progress.lessons[lesson.id]?.completed === true,
  ).length;
  const ratio = module.lessons.length === 0 ? 0 : completed / module.lessons.length;
  const duration = lessons.reduce((total, lesson) => total + lesson.durationSeconds, 0);

  return (
    <article className="module">
      <header className="module__head">
        <span className="module__index">{String(module.position).padStart(2, "0")}</span>
        <h3 className="module__title">{module.title}</h3>
        <span className="module__meta">
          {lessons.length} lecciones · {formatDuration(duration)}
        </span>
        <div className="module__progress progress-bar progress-bar--light" aria-hidden="true">
          <span className="progress-bar__fill" style={{ width: `${ratio * 100}%` }} />
        </div>
      </header>

      <div role="list">
        {lessons.map((lesson) => {
          const entry = progress.lessons[lesson.id];
          const completedLesson = entry?.completed === true;
          const watchedRatio =
            entry && lesson.durationSeconds > 0
              ? Math.min(entry.positionSeconds / lesson.durationSeconds, 1)
              : 0;

          return (
            <Link
              key={lesson.id}
              href={lessonHref(lesson)}
              role="listitem"
              className={`lesson-row${completedLesson ? " lesson-row--completed" : ""}`}
            >
              <span className="lesson-row__index">
                {String(lesson.position).padStart(2, "0")}
              </span>
              <span className="lesson-row__title">{lesson.title}</span>
              <span className="lesson-row__duration">{formatClock(lesson.durationSeconds)}</span>
              <span className="lesson-row__status">
                {completedLesson ? (
                  <>
                    <CheckIcon size={12} />
                    Visto
                  </>
                ) : watchedRatio > 0 ? (
                  <>
                    <span className="lesson-row__bar">
                      <span style={{ width: `${watchedRatio * 100}%` }} />
                    </span>
                    {Math.round(watchedRatio * 100)} %
                  </>
                ) : (
                  <span aria-hidden="true">—</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </article>
  );
}
