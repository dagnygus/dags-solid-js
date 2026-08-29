import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [solid()],
  resolve: {
        alias: {
            'dags-solid-cdk': resolve(
                __dirname,
                '../../packages/dags-solid-cdk'
            ),
        },
    },
})
