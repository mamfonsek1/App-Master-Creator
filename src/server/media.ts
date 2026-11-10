import path from "node:path";

import { paths } from "@/server/config";

/** Cabecera `Range` ya normalizada, o `null` si se pide el archivo completo. */
export interface ByteRange {
  readonly start: number;
  readonly end: number;
}

export type RangeResult =
  | { readonly kind: "full" }
  | { readonly kind: "partial"; readonly range: ByteRange }
  | { readonly kind: "unsatisfiable" };

/**
 * Interpreta una cabecera `Range` con la forma `bytes=a-b`, `bytes=a-` o
 * `bytes=-n`. Cualquier otra cosa se considera insatisfacible (416), que es lo
 * que indica RFC 9110 para rangos no soportados.
 */
export function parseRange(header: string | null, size: number): RangeResult {
  if (!header) {
    return { kind: "full" };
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());

  if (!match) {
    return { kind: "unsatisfiable" };
  }

  const [, rawStart = "", rawEnd = ""] = match;

  if (rawStart === "" && rawEnd === "") {
    return { kind: "unsatisfiable" };
  }

  if (rawStart === "") {
    const suffixLength = Number(rawEnd);

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return { kind: "unsatisfiable" };
    }

    const start = Math.max(size - suffixLength, 0);
    return { kind: "partial", range: { start, end: size - 1 } };
  }

  const start = Number(rawStart);

  if (!Number.isFinite(start) || start >= size) {
    return { kind: "unsatisfiable" };
  }

  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);

  if (!Number.isFinite(end) || end < start) {
    return { kind: "unsatisfiable" };
  }

  return { kind: "partial", range: { start, end } };
}

/** Cabecera `Content-Range` para una respuesta 206. */
export function contentRange(range: ByteRange, size: number): string {
  return `bytes ${range.start}-${range.end}/${size}`;
}

/**
 * Resuelve la ruta absoluta de un archivo de `media/`, comprobando que no se
 * sale del directorio raíz. El contenido lo genera nuestro propio build, pero
 * la comprobación evita cualquier sorpresa si el JSON se edita a mano.
 */
export function resolveMediaPath(relativeFile: string): string | null {
  const root = path.resolve(paths.media);
  const candidate = path.resolve(root, relativeFile);
  const withSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  return candidate.startsWith(withSeparator) ? candidate : null;
}
