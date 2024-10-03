import { defineConfig } from 'tsup';

// noinspection JSUnusedGlobalSymbols
export default defineConfig({
  entry: ['src'],
  clean: true,
  platform: 'node',
  format: 'esm',
  target: 'esnext',
  treeshake: true,
  bundle: true,
  minify: true,
});
