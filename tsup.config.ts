import { defineConfig, Options } from 'tsup';

const commonConfig: Options = {
  minify: true,
  /* emit types */
  dts: true,
  format: ['esm', 'cjs'],
  sourcemap: false,
  clean: true,
  injectStyle: false,
};

export default defineConfig([
  {
    ...commonConfig,
    entry: ['./src/index.ts'],
    outDir: 'dist',
  }
]);
