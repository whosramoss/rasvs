import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "src");
const assetsDir = path.resolve(__dirname, "assets");

/** Copia scripts/ para o dist (HTML usa <script> clássico, sem type="module"). */
function copyLegacyStaticDirs() {
  return {
    name: "copy-legacy-static-dirs",
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      const rel = "scripts";
      const src = path.join(srcDir, rel);
      const dest = path.join(outDir, rel);
      if (!fs.existsSync(src)) return;
      fs.cpSync(src, dest, {
        recursive: true,
        filter: (srcPath) => {
          const base = path.basename(srcPath);
          return base !== "rasvs-animation.js" && base !== "rasvs-background.js";
        },
      });
    },
  };
}

export default defineConfig({
  root: srcDir,
  publicDir: assetsDir,
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  plugins: [copyLegacyStaticDirs()],
  server: {
    port: 5173,
    strictPort: false,
    fs: {
      allow: [__dirname, srcDir, assetsDir],
    },
  },
  preview: { port: 4173 },
});
