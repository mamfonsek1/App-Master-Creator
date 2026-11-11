/**
 * Prepara el servidor que se empaqueta dentro de la app de escritorio.
 *
 *   bun run package:server
 *
 * - Compila Next en modo `standalone`.
 * - Copia `.next/static`, `public/` y `content/` dentro del standalone.
 * - Copia el resultado a `src-tauri/resources/server`.
 * - Copia el `node.exe` del sistema a `src-tauri/resources/node.exe`.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, copyFile, cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const STANDALONE = path.join(ROOT, ".next", "standalone");
const RESOURCES = path.join(ROOT, "src-tauri", "resources");
const SERVER_DEST = path.join(RESOURCES, "server");

function log(message: string): void {
  console.log(`· ${message}`);
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function buildNext(): void {
  log("compilando Next en modo standalone…");

  const result = spawnSync("bun", ["run", "build"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error(`next build falló con código ${String(result.status)}`);
  }
}

async function copyServer(): Promise<void> {
  if (!(await exists(STANDALONE))) {
    throw new Error("No existe .next/standalone; ejecuta el build primero.");
  }

  log("copiando estáticos y contenido…");
  await cp(path.join(ROOT, ".next", "static"), path.join(STANDALONE, ".next", "static"), {
    recursive: true,
  });
  await cp(path.join(ROOT, "public"), path.join(STANDALONE, "public"), { recursive: true });
  await cp(path.join(ROOT, "content"), path.join(STANDALONE, "content"), { recursive: true });

  log("copiando servidor a src-tauri/resources/server…");
  await rm(SERVER_DEST, { recursive: true, force: true });
  await mkdir(RESOURCES, { recursive: true });
  await cp(STANDALONE, SERVER_DEST, { recursive: true });
}

function findNode(): string {
  const configured = process.env["NODE_BINARY"];

  if (configured && existsSync(configured)) {
    return configured;
  }

  const locator = process.platform === "win32" ? "where" : "which";
  const located = spawnSync(locator, ["node"], { encoding: "utf8" });
  const candidate = located.stdout
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && existsSync(line));

  if (!candidate) {
    throw new Error("No se encontró node en el PATH; es necesario para el servidor.");
  }

  return candidate;
}

async function copyNode(): Promise<void> {
  const node = findNode();
  const destination = path.join(RESOURCES, process.platform === "win32" ? "node.exe" : "node");

  log(`copiando runtime: ${node}`);
  await mkdir(RESOURCES, { recursive: true });
  await copyFile(node, destination);

  if (process.platform !== "win32") {
    await chmod(destination, 0o755);
  }
}

async function main(): Promise<void> {
  buildNext();
  await copyServer();
  await copyNode();

  log("listo: src-tauri/resources/server y src-tauri/resources/node.exe");
}

await main();
