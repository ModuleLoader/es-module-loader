module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['benchmark'],
    files: [
      'dist/es6-module-loader.src.js',
      'test/perf.js'
    ],
    reporters: ['benchmark'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome', 'Firefox'],
    singleRun: false,

    browserDisconnectTimeout: 10000,
    browserDisconnectTolerance: 2,
    browserNoActivityTimeout: 30000,
    captureTimeout: 120000
  });
};
