import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { compression, defineAlgorithm } from 'vite-plugin-compression2';
import { constants } from 'zlib';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
const basePath = process.env.BASE_PATH ?? '';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['url', 'cookie', 'baseLocale'],
      urlPatterns: [
        {
          pattern: `:protocol://:domain(.*)::port?${basePath}/:path(.*)?`,
          localized: [
            ['en', `:protocol://:domain(.*)::port?${basePath}/en/:path(.*)?`],
            ['zh', `:protocol://:domain(.*)::port?${basePath}/:path(.*)?`]
          ]
        }
      ]
    }),
    compression({
      threshold: 1024 * 1024,
      include: /\.(html|xml|css|js|mjs|wasm|json|svg|otf|ttf|otc|ttc)$/,
      exclude: /typst_ts_web_compiler_bg\.[^.]+\.wasm$/,
      algorithms: [
        defineAlgorithm('gzip', {
          level: constants.Z_BEST_COMPRESSION
        })
      ]
    }),
    compression({
      deleteOriginalAssets: true,
      include: /typst_ts_web_compiler_bg\.[^.]+\.wasm$/,
      algorithms: [
        defineAlgorithm('gzip', {
          level: constants.Z_BEST_COMPRESSION
        })
      ]
    })
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT_HASH__: JSON.stringify(commitHash)
  }
});
