module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Path aliases (@/*) are resolved by Metro via tsconfigPaths
    // (default in Expo SDK 50+). No babel-plugin-module-resolver needed.
  };
};
