import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { WatchExperience } from "@/components/watch/watch-experience";
import { buildCourseIndex, findLesson, neighboursOf } from "@/domain/course";
import { formatDuration } from "@/lib/format";
import { requireUser } from "@/server/guards";
import { loadCourse, loadProgress } from "@/server/queries";

export const dynamic = "force-dynamic";

interface LessonPageProps {
  readonly params: Promise<{ readonly slug: ReadonlyArray<string> }>;
}

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  const { slug } = await params;
  const lessonId = slug.join("/");

  try {
    const course = await loadCourse();
    const location = findLesson(buildCourseIndex(course), lessonId);

    if (!location) {
      return { title: "Lección no encontrada · Aula Lans" };
    }

    return {
      title: `${location.lesson.title} · Aula Lans`,
      description: `${location.module.title} · ${formatDuration(location.lesson.durationSeconds)}`,
    };
  } catch {
    return { title: "Aula · Refuerzo Master Creador Lans" };
  }
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { slug } = await params;
  const lessonId = slug.join("/");

  const user = await requireUser();
  const [course, progress] = await Promise.all([loadCourse(), loadProgress(user.id)]);
  const index = buildCourseIndex(course);
  const location = findLesson(index, lessonId);

  if (!location) {
    notFound();
  }

  const neighbours = neighboursOf(index, lessonId);

  return (
    <>
      <SiteHeader
        user={user}
        lessonCount={course.lessonCount}
        durationLabel={formatDuration(course.durationSeconds)}
      />

      <WatchExperience
        course={course}
        lesson={location.lesson}
        moduleTitle={location.module.title}
        modulePosition={location.module.position}
        progress={progress}
        previous={neighbours.previous}
        next={neighbours.next}
      />
    </>
  );
}
