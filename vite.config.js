import { defineConfig } from 'vite';

// Relative asset paths so the build works under GitHub Pages' /Pianochess/ subpath.
export default defineConfig({
  base: './',
});
