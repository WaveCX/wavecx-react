import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import postcss from 'rollup-plugin-postcss';

import packageInfo from './package.json' assert {type: 'json'};

export default [
  {
    input: 'src/index.tsx',
    output: [
      {
        file: packageInfo.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: packageInfo.module,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({tsconfig: './tsconfig.json'}),
      postcss({modules: true}),
    ],
    external: [...Object.keys(packageInfo.peerDependencies || {})],
  },
  {
    input: 'dist/esm/index.d.ts',
    output: [{file: 'dist/index.d.ts', format: 'esm'}],
    plugins: [dts()],
    external: [/\.css$/],
  },
];
