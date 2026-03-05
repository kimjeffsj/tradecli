import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/commands/**/*.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  noExternal: [],
  tsconfig: 'tsconfig.build.json',
});
