import { Layer } from "effect";

import { CourseRepository, CourseRepositoryLive } from "@/server/course-repository";
import { Database, DatabaseLive, DatabaseError } from "@/server/db";
import { ProgressStore, ProgressStoreLive } from "@/server/progress-store";

/**
 * Capa única de la aplicación. El curso se cachea en memoria, el progreso vive
 * en SQLite y la conexión se abre una sola vez por proceso.
 *
 * Si SQLite no puede abrirse el proceso no puede servir nada útil, así que el
 * fallo se trata como defecto en lugar de como error recuperable por petición.
 */
export type AppServices = Database | CourseRepository | ProgressStore;

const services = Layer.mergeAll(CourseRepositoryLive, ProgressStoreLive);

export const AppLayer: Layer.Layer<AppServices, never, never> = services.pipe(
  Layer.provideMerge(DatabaseLive),
  Layer.orDie,
);

/** Tipo del fallo de la capa, expuesto para diagnóstico. */
export type AppLayerError = DatabaseError;
