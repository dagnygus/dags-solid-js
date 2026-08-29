import { defineConfig, Plugin } from "vite";
import solid from "vite-plugin-solid";
import { resolve } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { parse } from '@babel/parser';
import MagicString from 'magic-string';

export default defineConfig(({ mode }) => {
  assertCorrectMode(mode);

  const isServer = mode === 'server';

  const entries = {
    signals: resolve(__dirname, 'src/signals/signals.ts'),
    platform: resolve(__dirname, 'src/platform/platform.ts'),
    observers: resolve(__dirname, 'src/observers/observers.ts'),
    eventDelegation: resolve(__dirname, 'src/event-delegation/event-delegation.ts'),
    a11y: resolve(__dirname, 'src/a11y/a11y.ts')
  }

  return {
    plugins: [ stripInternalExports(Object.values(entries)), solid(), packageExportsPlugin(Object.keys(entries).sort()) ],
    assetsInclude: ['**/*.d.ts'],
    define: {
      __IS_SERVER__: isServer
    },
    build: {
      minify: false,
      lib: {
        entry: entries,
        formats: ['es', 'cjs'],
        fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
      },
      outDir: `dist/${mode}`,
      rolldownOptions: {
        external: ['solid-js', 'solid-js/web', 'solid-js/store'],
        output: { 
          preserveModules: true,
          preserveModulesRoot: 'src',
          comments: {
            jsdoc: false
          }
        }
      },
    },
  };
});

function assertCorrectMode(mode: string): asserts mode is 'browser' | 'server' {
  if (mode === 'browser' || mode === 'server') { return; }
  throw new Error('Invalid "vite build --mode" value! Mode must be defined and it must be "server" or "browser"');
}


function packageExportsPlugin(entries: string[]): Plugin {
  return {
    name: "package-exports-generator",

    closeBundle() {

      const pkgPath = resolve(__dirname, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

      const createExport = (name: string) => ({
        types: `./dist/types/${name}/${name}.d.ts`,
        browser: {
          import: `./dist/browser/${name}/${name}.mjs`,
          require: `./dist/browser/${name}/${name}.cjs`
        },
        node: {
          import: `./dist/server/${name}/${name}.mjs`,
          require: `./dist/server/${name}/${name}.cjs`
        },
        deno: {
          import: `./dist/server/${name}/${name}.mjs`,
          require: `./dist/server/${name}/${name}.cjs`
        },
        default: `./dist/server/${name}/${name}.mjs`
      });
      
      pkg.exports = {
        ...pkg.exports,
        ...Object.fromEntries(
          entries.map((e) => [`./${e}`, createExport(camelToKebabCase(e))])
        )
      };

      writeFileSync(
        pkgPath,
        JSON.stringify(pkg, null, 2) // 👈 pretty print
      );
    }
  };
}

function camelToKebabCase(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase();
}

function stripInternalExports(entrypoints: string[]): Plugin {
    const normalized = new Set(
        entrypoints.map(p => resolve(p))
    );

    return {
        name: 'strip-internal-exports',

        transform(code, id) {
            const file = id.split('?')[0];

            if (!normalized.has(resolve(file))) {
                return null;
            }

            const ast = parse(code, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx'],
                attachComment: true,
            });

            const s = new MagicString(code);

            for (const node of ast.program.body) {
                if (node.type !== 'ExportNamedDeclaration') {
                    continue;
                }

                const comments = node.leadingComments ?? [];

                if (!comments.some(c => c.value.includes('@internal'))) {
                    continue;
                }

                s.remove(node.start!, node.declaration!.start!);
            }

            return {
                code: s.toString(),
                map: s.generateMap({ hires: true }),
            };
        },
    };
  }