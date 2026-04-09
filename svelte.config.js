import adapter from '@sveltejs/adapter-static';

const basePath = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
  },
  kit: {
    adapter: adapter(
      basePath
        ? {
            pages: `build${basePath}`,
            assets: `build${basePath}`
          }
        : {}
    ),
    paths: { base: basePath, relative: false }
  }
};

export default config;
