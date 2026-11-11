/**
 * Servidor HTTP temporal para copiar los vídeos a otro equipo de la red local.
 * Solo lectura, sin credenciales, con listado de directorios.
 *
 *   bun run scripts/serve-media.ts
 *   PORT=9000 SERVE_ROOT=./media bun run scripts/serve-media.ts
 */
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import path from "node:path";

const root = path.resolve(process.env["SERVE_ROOT"] ?? path.join(process.cwd(), "media"));
const port = Number(process.env["PORT"] ?? 8080);

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function listing(entries: ReadonlyArray<{ name: string; dir: boolean }>, current: string): string {
  const rows = [...entries]
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

function notFound(response: ServerResponse): void {
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("No encontrado");
}

const server = createServer((request, response) => {
  void (async () => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" });
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const target = path.resolve(root, relative);

    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403);
      response.end("Prohibido");
      return;
    }

    try {
      const info = await stat(target);

      if (info.isDirectory()) {
        const entries = await readdir(target, { withFileTypes: true });
        const items = entries.map((entry) => ({ name: entry.name, dir: entry.isDirectory() }));
        const body = listing(items, `/${relative}`);

        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "content-length": Buffer.byteLength(body),
        });
        response.end(request.method === "HEAD" ? undefined : body);
        return;
      }

      response.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-length": info.size,
      });

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      createReadStream(target).pipe(response);
    } catch {
      notFound(response);
    }
  })();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Sirviendo ${root}`);
  console.log(`http://0.0.0.0:${port}`);
});
