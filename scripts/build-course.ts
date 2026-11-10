import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Schema } from "effect";

import { CourseSchema, type Course, type Lesson, type Module } from "@/domain/course";
import { ordinal, slugify } from "@/lib/slug";

/**
 * Genera `content/course.json` a partir de `content/source-manifest.json`
 * (export de la plataforma) y de los archivos reales en `media/`.
 *
 * Reglas:
 * - Un módulo por carpeta de `media/`, en el orden del manifest.
 * - Una lección por archivo, emparejada por el prefijo `NN - `.
 * - Los tamaños se leen del disco, no del manifest: el dato manda el archivo.
 */

interface SourceLesson {
  readonly n: number;
  readonly section: string;
  readonly title: string;
  readonly pid: string;
  readonly duration_s: number;
  readonly bytes: number;
}

interface SourceManifest {
  readonly course: string;
  readonly source: string;
  readonly lessons: ReadonlyArray<SourceLesson>;
}

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "content", "source-manifest.json");
const OUTPUT_PATH = path.join(ROOT, "content", "course.json");
const MEDIA_DIR = path.join(ROOT, "media");

const VIDEO_EXTENSION = ".mp4";

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function loadManifest(): Promise<SourceManifest> {
  try {
    const raw = await readFile(SOURCE_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw.replace(/^\uFEFF/, ""));

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as SourceManifest).lessons)
    ) {
      fail("content/source-manifest.json no tiene la forma esperada.");
    }

    return parsed as SourceManifest;
  } catch (error) {
    fail(`No se pudo leer ${SOURCE_PATH}: ${String(error)}`);
  }
}

/** Agrupa las lecciones por sección conservando el orden de aparición. */
function groupBySection(
  lessons: ReadonlyArray<SourceLesson>,
): ReadonlyArray<{ readonly section: string; readonly lessons: ReadonlyArray<SourceLesson> }> {
  const groups = new Map<string, SourceLesson[]>();

  for (const lesson of lessons) {
    const bucket = groups.get(lesson.section);
    if (bucket) {
      bucket.push(lesson);
    } else {
      groups.set(lesson.section, [lesson]);
    }
  }

  return [...groups.entries()].map(([section, items]) => ({
    section,
    lessons: [...items].sort((left, right) => left.n - right.n),
  }));
}

async function listVideos(directory: string): Promise<ReadonlyArray<string>> {
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(VIDEO_EXTENSION))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "es"));
}

async function resolveVideo(
  directory: string,
  files: ReadonlyArray<string>,
  lesson: SourceLesson,
  position: number,
): Promise<string> {
  const prefix = `${ordinal(position)} - `;
  const matches = files.filter((file) => file.startsWith(prefix));

  if (matches.length === 1) {
    return matches[0]!;
  }

  if (matches.length === 0) {
    fail(
      `No hay vídeo para "${lesson.title}" en ${path.relative(ROOT, directory)} (esperaba un archivo que empiece por "${prefix}").`,
    );
  }

  fail(
    `Hay ${matches.length} vídeos que empiezan por "${prefix}" en ${path.relative(ROOT, directory)}: ${matches.join(", ")}.`,
  );
}

async function buildModule(
  group: { readonly section: string; readonly lessons: ReadonlyArray<SourceLesson> },
  modulePosition: number,
): Promise<Module> {
  const folderName = `${modulePosition}. ${group.section}`;
  const directory = path.join(MEDIA_DIR, folderName);
  const files = await listVideos(directory);
  const moduleId = slugify(group.section);

  const lessons: Lesson[] = [];

  for (const [offset, source] of group.lessons.entries()) {
    const position = offset + 1;
    const file = await resolveVideo(directory, files, source, position);
    const absolutePath = path.join(directory, file);

    lessons.push({
      id: `${moduleId}/${ordinal(position)}-${slugify(source.title)}`,
      moduleId,
      title: source.title,
      position,
      durationSeconds: Math.max(1, Math.round(source.duration_s)),
      bytes: await fileSize(absolutePath),
      file: `${folderName}/${file}`,
    });
  }

  return {
    id: moduleId,
    title: group.section,
    position: modulePosition,
    lessons,
    durationSeconds: lessons.reduce((total, lesson) => total + lesson.durationSeconds, 0),
  };
}

async function fileSize(filePath: string): Promise<number> {
  const { stat } = await import("node:fs/promises");
  const stats = await stat(filePath);
  return stats.size;
}

async function main(): Promise<void> {
  const manifest = await loadManifest();
  const groups = groupBySection(manifest.lessons);

  const modules: Module[] = [];
  for (const [offset, group] of groups.entries()) {
    modules.push(await buildModule(group, offset + 1));
  }

  const course: Course = {
    id: slugify(manifest.course),
    title: manifest.course,
    subtitle: "Índice del curso · Temario completo y duración de cada lección",
    source: manifest.source,
    generatedAt: new Date().toISOString(),
    modules,
    lessonCount: modules.reduce((total, module) => total + module.lessons.length, 0),
    durationSeconds: modules.reduce((total, module) => total + module.durationSeconds, 0),
    bytes: modules.reduce(
      (total, module) => total + module.lessons.reduce((sum, lesson) => sum + lesson.bytes, 0),
      0,
    ),
  };

  Schema.decodeUnknownSync(CourseSchema)(course);

  await writeFile(OUTPUT_PATH, `${JSON.stringify(course, null, 2)}\n`, "utf8");

  const minutes = Math.round(course.durationSeconds / 60);
  const gigabytes = (course.bytes / 1024 ** 3).toFixed(2);

  console.log(`✓ ${path.relative(ROOT, OUTPUT_PATH)}`);
  console.log(`  ${course.modules.length} módulos · ${course.lessonCount} lecciones`);
  console.log(`  ${minutes} min · ${gigabytes} GB`);
}

await main();
