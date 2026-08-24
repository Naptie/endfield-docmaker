import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { compression, defineAlgorithm } from 'vite-plugin-compression2';
import { constants } from 'zlib';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
const basePath = process.env.BASE_PATH ?? '';

// Compute a hash of the fonts directory for cache invalidation.
const fontsDir = join('src', 'lib', 'assets', 'fonts');
const fontFiles = readdirSync(fontsDir).sort();
const fontsHash = createHash('sha256');
for (const file of fontFiles) {
  fontsHash.update(file);
  fontsHash.update(readFileSync(join(fontsDir, file)));
}
const fontsVersion = fontsHash.digest('hex').slice(0, 12);

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
      exclude: /typst_ts_web_compiler_bg[.-][^.]+\.wasm$/,
      algorithms: [
        defineAlgorithm('gzip', {
          level: constants.Z_BEST_COMPRESSION
        })
      ]
    }),
    compression({
      deleteOriginalAssets: true,
      include: /typst_ts_web_compiler_bg[.-][^.]+\.wasm$/,
      algorithms: [
        defineAlgorithm('gzip', {
          level: constants.Z_BEST_COMPRESSION
        })
      ]
    })
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __FONTS_VERSION__: JSON.stringify(fontsVersion)
  }
});
