import { resolve } from "node:path";
import { defineConfig } from "vite";

const APP_BASE = "/civilizations-poc/";

export default defineConfig({
  base: APP_BASE,
  build: {
    outDir: "dist-character-lab",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        characterLab: resolve(process.cwd(), "character-lab", "index.html"),
      },
    },
  },
  define: {
    "process.env.BUILD_TIME": JSON.stringify(new Date().toISOString()),
  },
});
