import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/.worktrees/**',
      '**/supabase/**',
      '**/e2e/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    extensions: [
      '.native.tsx',
      '.native.ts',
      '.native.js',
      '.tsx',
      '.ts',
      '.js',
      '.json',
    ],
  },
});
