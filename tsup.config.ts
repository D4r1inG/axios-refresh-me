import { defineConfig } from 'tsup';

// noinspection JSUnusedGlobalSymbols
export default defineConfig({
  entry: ['src', '!src/**/*.spec.*', '!src/**/*.test.*', '!src/**/*.mock.*'],
  clean: true,
  platform: 'node',
  format: 'esm',
  target: 'esnext',
  dts: true,
  treeshake: true,
  sourcemap: true,
  bundle: false,
});
