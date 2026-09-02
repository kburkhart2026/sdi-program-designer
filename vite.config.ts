import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * A GitHub Pages *project* site serves from /<repo>/, so the build needs a
 * matching `base` or every asset and the catalog.json fetch 404s. The dev
 * server has no such prefix, and inheriting one there just makes localhost
 * URLs confusing, so base is applied to builds only.
 *
 * CI passes BASE_PATH=/<repo-name>/ so renaming the repo cannot break the deploy.
 */
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.BASE_PATH ?? '/sdi-program-designer/') : '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    // The nine SME body-of-knowledge PDFs are linked by URL, never imported, so
    // a bundler that only follows imports would drop them. They live in public/,
    // which Vite copies wholesale -- that is deliberate, do not "optimise" it.
    assetsInlineLimit: 0,
  },
  server: { port: 5173 },
}))
