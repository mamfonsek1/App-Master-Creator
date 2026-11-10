import { Effect, Either } from "effect";

import { AppLayer, type AppServices } from "@/server/runtime";

/**
 * Ejecuta un efecto de la aplicación y traduce el resultado a una respuesta
 * HTTP. El mapeo de errores es explícito en cada ruta para no perder detalle.
 */
export async function runRoute<A, E, R extends AppServices>(
  effect: Effect.Effect<A, E, R>,
  onError: (error: E) => Response,
  onSuccess: (value: A) => Response = (value) => Response.json(value),
): Promise<Response> {
  // `Effect.provide` no puede reducir `Exclude<R, AppServices>` cuando `R` es
  // genérico, aunque la capa cubre todos los servicios posibles.
  const provided = Effect.provide(effect, AppLayer) as Effect.Effect<A, E, never>;
  const result = await Effect.runPromise(Effect.either(provided));

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
