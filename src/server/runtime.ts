import { Layer } from "effect";

import { CourseRepository, CourseRepositoryLive } from "@/server/course-repository";
import { ProgressStore, ProgressStoreLive } from "@/server/progress-store";

/**
 * Capa única de la aplicación. Se compone una vez por módulo y se reutiliza en
 * todas las peticiones: el curso se cachea en memoria y el progreso vive en un
 * `Ref` respaldado por disco.
 */
export const AppLayer: Layer.Layer<CourseRepository | ProgressStore, never, never> =
  Layer.mergeAll(CourseRepositoryLive, ProgressStoreLive);
