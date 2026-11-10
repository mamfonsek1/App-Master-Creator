/**
 * Normaliza un texto a un slug estable para usarlo en identificadores y URLs.
 * Quita diacríticos, pasa a minúsculas y sustituye cualquier secuencia no
 * alfanumérica por un guion simple.
 */
export function slugify(input: string): string {
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "sin-titulo";
}

/** Prefija un índice con dos dígitos para conservar el orden alfabético. */
export function ordinal(position: number): string {
  return String(position).padStart(2, "0");
}
