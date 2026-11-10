import { Effect, Either } from "effect";

import { CourseRepository } from "@/server/course-repository";
import { ProgressStore } from "@/server/progress-store";
import { AppLayer } from "@/server/runtime";

export type AppServices = CourseRepository | ProgressStore;

/**
 * Ejecuta un efecto de la aplicación y traduce el resultado a una respuesta
 * HTTP. El mapeo de errores es explícito en cada ruta para no perder detalle.
 */
export async function runRoute<A, E>(
  effect: Effect.Effect<A, E, AppServices>,
  onError: (error: E) => Response,
  onSuccess: (value: A) => Response = (value) => Response.json(value),
): Promise<Response> {
  const result = await Effect.runPromise(Effect.either(effect.pipe(Effect.provide(AppLayer))));

  return Either.isLeft(result) ? onError(result.left) : onSuccess(result.right);
}

/** Respuesta JSON de error con un código estable para el cliente. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return Response.json({ error: { code, message, details } }, { status });
}
