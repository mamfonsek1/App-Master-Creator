/**
 * Servidor HTTP temporal para copiar los vídeos a otro equipo de la red local.
 * Solo lectura, sin credenciales, con listado de directorios.
 *
 *   bun run scripts/serve-media.ts
 *   PORT=9000 bun run scripts/serve-media.ts
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), "media");
const port = Number(process.env["PORT"] ?? 8080);

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function listing(entries: ReadonlyArray<{ name: string; dir: boolean }>, current: string): string {
  const rows = entries
    .sort((left, right) => left.name.localeCompare(right.name, "es"))
    .map((entry) => {
      const href = `${encodeURIComponent(entry.name)}${entry.dir ? "/" : ""}`;
      const label = `${escapeHtml(entry.name)}${entry.dir ? "/" : ""}`;
      return `<li><a href="${href}">${label}</a></li>`;
    })
    .join("\n");

  return `<!doctype html><meta charset="utf-8"><title>${escapeHtml(current)}</title>
<style>body{font-family:system-ui;margin:2rem}li{margin:.2rem 0}a{color:#0072ef;text-decoration:none}</style>
<h2>${escapeHtml(current)}</h2><ul>${rows}</ul>`;
}

const server = Bun.serve({
  port,
  hostname: "0.0.0.0",
  async fetch(request) {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const target = path.resolve(root, relative);

    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      return new Response("Prohibido", { status: 403 });
    }

    try {
      const info = await stat(target);

      if (info.isDirectory()) {
        const entries = await readdir(target, { withFileTypes: true });
        const items = entries.map((entry) => ({ name: entry.name, dir: entry.isDirectory() }));

        return new Response(listing(items, `/${relative}`), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      return new Response(Bun.file(target), {
        headers: { "content-length": String(info.size) },
      });
    } catch {
      return new Response("No encontrado", { status: 404 });
    }
  },
});

console.log(`Sirviendo ${root}`);
console.log(`http://0.0.0.0:${server.port}`);
