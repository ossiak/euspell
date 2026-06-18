import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'src/content/content.js',
  output: {
    file: 'dist/content-bundle.js',
    format: 'iife',
    name: 'Euspell',
    sourcemap: true,
  },
  plugins: [nodeResolve()],
};
