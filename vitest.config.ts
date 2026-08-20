import { defineConfig } from "vitest/config";
import babel from "@rollup/plugin-babel";
//@ts-expect-error
import solid from "babel-preset-solid";
import solidPlugin from "vite-plugin-solid"; 

export default defineConfig({
  plugins: [
    babel({
      babelHelpers: "bundled",
      presets: [solid],
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    }),
  ],
  // plugins: [
  //   solidPlugin({ extensions:  [".ts", ".tsx", ".js", ".jsx"] })
  // ],
  resolve: {
    conditions: [ "development", "browser" ]
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ['**/*.spec.ts', '**/*.spec.tsx' ],
  }
});