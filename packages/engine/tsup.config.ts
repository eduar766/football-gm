import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  // Don't wipe dist in watch mode: clearing it leaves a window where the
  // emitted .d.ts files are missing, which makes dependents (e.g. the backend's
  // nest --watch) fail to resolve types and get stuck on stale errors.
  clean: !options.watch,
  sourcemap: true,
  target: 'es2022',
}));
