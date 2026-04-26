import { defineConfig } from 'astro/config';

// GitHub Pages base path. Repo: lidge-jun/ima2-gen → /ima2-gen/
// If a custom domain (CNAME) is added, switch base to '/'.
export default defineConfig({
  site: 'https://lidge-jun.github.io',
  base: '/ima2-gen/',
  trailingSlash: 'never',
  build: {
    inlineStylesheets: 'auto',
  },
});
