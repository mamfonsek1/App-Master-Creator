"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowIcon, CheckIcon } from "@/components/icons";
import type { Lesson } from "@/domain/course";
import type { LessonProgress } from "@/domain/progress";
import { formatClock } from "@/lib/format";

interface PlayerProps {
  readonly lesson: Lesson;
  readonly moduleTitle: string;
  readonly modulePosition: number;
  readonly initialEntry: LessonProgress | null;
  readonly previous: Lesson | null;
  readonly next: Lesson | null;
  readonly onSaved: (entry: LessonProgress) => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_INTERVAL_SECONDS = 5;
const COMPLETE_RATIO = 0.9;

export function Player({
  lesson,
  moduleTitle,
  modulePosition,
  initialEntry,
  previous,
  next,
  onSaved,
}: PlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSavedRef = useRef<number>(initialEntry?.positionSeconds ?? 0);
  const savingRef = useRef<boolean>(false);
  const completedRef = useRef<boolean>(initialEntry?.completed ?? false);

  const [completed, setCompleted] = useState<boolean>(initialEntry?.completed ?? false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [position, setPosition] = useState<number>(initialEntry?.positionSeconds ?? 0);

  const persist = useCallback(
    async (positionSeconds: number, markCompleted: boolean) => {
      if (savingRef.current) {
        return;
      }

      savingRef.current = true;
      setSaveState("saving");

      try {
        const response = await fetch("/api/progress", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lessonId: lesson.id,
            positionSeconds,
            completed: markCompleted,
          }),
        });

        if (!response.ok) {
          setSaveState("error");
          return;
        }

        const entry = (await response.json()) as LessonProgress;
        lastSavedRef.current = entry.positionSeconds;
        completedRef.current = entry.completed;
        setCompleted(entry.completed);
        setSaveState("saved");
        onSaved(entry);
      } catch {
        setSaveState("error");
      } finally {
        savingRef.current = false;
      }
    },
    [lesson.id, onSaved],
  );

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setPosition(video.currentTime);

    const ratio = video.duration > 0 ? video.currentTime / video.duration : 0;

    if (!completedRef.current && ratio >= COMPLETE_RATIO) {
      completedRef.current = true;
      void persist(video.currentTime, true);
      return;
    }

    if (Math.abs(video.currentTime - lastSavedRef.current) >= SAVE_INTERVAL_SECONDS) {
      void persist(video.currentTime, false);
    }
  }, [persist]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    const resumeAt = initialEntry?.positionSeconds ?? 0;

    if (!video || resumeAt <= 0) {
      return;
    }

    if (resumeAt < video.duration - 3) {
      video.currentTime = resumeAt;
    }
  }, [initialEntry]);

  const handleEnded = useCallback(() => {
    const video = videoRef.current;
    void persist(video?.duration ?? lesson.durationSeconds, true);
  }, [lesson.durationSeconds, persist]);

  const markCompleted = useCallback(() => {
    const video = videoRef.current;
    void persist(video?.currentTime ?? position, true);
  }, [persist, position]);

  const goNext = useCallback(() => {
    if (next) {
      router.push(`/leccion/${next.id}`);
    }
  }, [next, router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      const video = videoRef.current;

      if (!video) {
        return;
      }

      switch (event.code) {
        case "Space": {
          event.preventDefault();
          if (video.paused) {
            void video.play();
          } else {
            video.pause();
          }
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
          break;
        }
        case "KeyM": {
          video.muted = !video.muted;
          break;
        }
        case "KeyN": {
          goNext();
          break;
        }
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext]);

  const watchedRatio =
    lesson.durationSeconds > 0 ? Math.min(position / lesson.durationSeconds, 1) : 0;

  return (
    <>
      <div className="watch__stage">
        <div className="player">
          <video
            ref={videoRef}
            src={`/api/media/${lesson.id}`}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPause={() => void persist(videoRef.current?.currentTime ?? position, false)}
            onEnded={handleEnded}
          />
        </div>
      </div>

      <div className="watch__info">
        <div className="watch__heading">
          <div>
            <div className="watch__breadcrumb">
              Módulo {String(modulePosition).padStart(2, "0")} · {moduleTitle}
            </div>
            <h1 className="watch__title">{lesson.title}</h1>
          </div>
        </div>

      <div className="watch__actions">
        {previous ? (
          <Link className="button button--ghost" href={`/leccion/${previous.id}`}>
            ← Anterior
          </Link>
        ) : (
          <button className="button button--ghost" type="button" disabled>
            ← Anterior
          </button>
        )}

        {next ? (
          <Link className="button button--primary" href={`/leccion/${next.id}`}>
            Siguiente <ArrowIcon />
          </Link>
        ) : (
          <Link className="button button--ghost" href="/">
            Volver al temario <ArrowIcon />
          </Link>
        )}

        <button
          className="button"
          type="button"
          onClick={markCompleted}
          disabled={completed}
          aria-pressed={completed}
        >
          <CheckIcon size={13} />
          {completed ? "Lección completada" : "Marcar como vista"}
        </button>
      </div>

      <div className="watch__notes">
        <div>
          <span className="label">Duración</span>
          <span>{formatClock(lesson.durationSeconds)}</span>
        </div>
        <div>
          <span className="label">Progreso de esta lección</span>
          <span>{Math.round(watchedRatio * 100)} %</span>
        </div>
        <div>
          <span className="label">Guardado</span>
          <span aria-live="polite">
            {saveState === "saving"
              ? "Guardando…"
              : saveState === "error"
                ? "No se pudo guardar"
                : saveState === "saved"
                  ? "Al día"
                  : "—"}
          </span>
        </div>
        <div>
          <span className="label">Atajos</span>
          <span>espacio · ← → · M · N</span>
        </div>
      </div>
      </div>
    </>
  );
}
