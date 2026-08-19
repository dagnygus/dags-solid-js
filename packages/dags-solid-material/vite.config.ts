import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [solid()],

  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"]
    },

    rollupOptions: {
      external: [
        "solid-js",
        "dags-solid-cdk"
      ]
    }
  }
});