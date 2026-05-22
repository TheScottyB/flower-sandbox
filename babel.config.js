module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Keep the module-resolver for path aliasing which is useful even in native-only apps
      ['module-resolver', {
        root: ['.'],
        alias: {
          '@': './',
        },
      }],
    ],
  };
};
