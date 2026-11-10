/**
 * Genera el icono base de la app (1024×1024) a partir de un SVG.
 * Luego `tauri icon` deriva el resto de tamaños e `.ico`.
 *
 *   bun run scripts/make-icon.ts && bunx tauri icon src-tauri/icon-source.png -o src-tauri/icons
 */
import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="200" fill="#0B0B0B"/>
  <rect x="330" y="250" width="86" height="470" fill="#FFFFFF"/>
  <rect x="330" y="634" width="330" height="86" fill="#FFFFFF"/>
  <rect x="330" y="780" width="150" height="14" fill="#0072EF"/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("src-tauri/icon-source.png");
console.log("✓ src-tauri/icon-source.png");
