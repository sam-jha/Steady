/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// `base` must match the GitHub repository name so the site works at
// https://<your-username>.github.io/<repo-name>/. The deploy workflow sets VITE_BASE from the
// real repository name, so renaming the repo needs no code change. The fallback is for local use.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/steady/',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
