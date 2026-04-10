import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: "./src",
  publicDir: false,
  server: {
    fs: {
      allow: [path.resolve(__dirname)],
    },
    port: 5173,
    strictPort: false,
  },
  preview: { port: 4173 },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    target: "es2022",
    cssMinify: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "src/index.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/gsap")) return "gsap";
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "three",
      "gsap",
      "gsap/CustomEase",
      "gsap/ScrollTrigger",
      "gsap/SplitText",
    ],
  },
});
