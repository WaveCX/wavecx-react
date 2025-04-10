const nodeResolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');
const postcss = require('rollup-plugin-postcss');

const packageInfo = require('./package.json');

module.exports = [
  {
    input: 'src/index.tsx',
    output: [
      {
        file: packageInfo.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: packageInfo.exports['.'].import,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({tsconfig: './tsconfig.json'}),
      postcss({extract: 'styles.css'}),
    ],
    external: [...Object.keys(packageInfo.peerDependencies || {})],
  },
];
