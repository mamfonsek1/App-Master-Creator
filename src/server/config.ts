import path from "node:path";

/**
 * Rutas del proyecto. Todo se resuelve desde el directorio de trabajo, que es
 * la raíz del repositorio. Se pueden sobreescribir por entorno para probar con
 * otro contenido sin tocar la configuración.
 */

function resolveFromRoot(value: string | undefined, fallback: string): string {
  // Las rutas se resuelven en tiempo de ejecución: el contenido vive fuera del
  // bundle (media/ son ~5 GB), así que se le pide a Turbopack que no rastree.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), value ?? fallback);
}

export const paths = {
  root: process.cwd(),
  media: resolveFromRoot(process.env["MEDIA_DIR"], "media"),
  courseFile: resolveFromRoot(process.env["CONTENT_FILE"], "content/course.json"),
  progressFile: resolveFromRoot(process.env["PROGRESS_FILE"], "data/progress.json"),
} as const;
