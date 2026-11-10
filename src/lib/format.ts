const numberFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

/** Duración de un vídeo: `4:28`, o `1:04:12` si pasa de una hora. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/** Duración legible: `4 h 30 min`, `38 min`, `45 s`. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));

  if (seconds < 60) {
    return `${seconds} s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes} min`;
  }

  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

/** Tamaño legible con coma decimal: `4,81 GB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) {
    return `${numberFormat.format(bytes / 1024)} KB`;
  }

  if (bytes < 1024 ** 3) {
    return `${numberFormat.format(bytes / 1024 ** 2)} MB`;
  }

  return `${numberFormat.format(bytes / 1024 ** 3)} GB`;
}

/** Porcentaje entero, sin decimales: `73 %`. */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

/** Minúsculas sin diacríticos, para búsquedas tolerantes a tildes. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
