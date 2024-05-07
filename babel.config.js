/**
 * Babel Configuration
 *
 * Only used for storybook. Production builds use Rollup.
 */

module.exports = (api) => {
  api.cache(true);

  return {
    sourceMaps: false,
    presets: [
      '@babel/preset-env',
      '@babel/preset-typescript',
      '@babel/preset-react',
    ],
  };
};