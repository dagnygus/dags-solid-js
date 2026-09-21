import { defineConfig, defaultExclude } from "vitest/config";
import babel from "@rollup/plugin-babel";
//@ts-expect-error
import solid from "babel-preset-solid";
import { join } from 'node:path';
import { playwright } from "@vitest/browser-playwright"

export default defineConfig({
  plugins: [
    babel({
      babelHelpers: "bundled",
      presets: [solid],
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    conditions: ['development', 'browser']
  },
  ssr: {
    resolve: {
      conditions: ['development', 'browser']
    }
  },
  test: {
    projects: [
      {
        test: {
          globals: true,
          environment: "jsdom",
          include: [
            '**/*.spec.ts',
            '**/*.spec.tsx',
          ],
          exclude: [
            ...defaultExclude,
            '**/*.browser.spec.ts',
            '**/*.browser.spec.tsx',
          ],
          setupFiles: join(__dirname, 'test-setup.ts')
        }
      },
      {
        test: {
          // an example of file based convention,
          // you don't have to follow it
          globals: true,
          include: [
            '**/*.browser.spec.ts',
            '**/*.browser.spec.tsx',
          ],
          name: 'browser',
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [
              { browser: 'chromium' },
            ],
          },
        },
      }
    ]
  }
});