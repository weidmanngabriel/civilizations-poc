import { defineConfig } from "vite";

export default defineConfig({
  base: "/civilizations-poc/",
  define: {
    "process.env.BUILD_TIME": JSON.stringify(new Date().toISOString()),
  },
});
