module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['mocha', 'chai'],
    files: [
      'node_modules/traceur/bin/traceur.js',
      'dist/es6-module-loader.src.js',
      'test/custom-loader.js',
      'test/*.spec.js',
      { pattern: 'test/{loader,loads,syntax,worker}/**/*', included: false },
      { pattern: 'node_modules/when/es6-shim/Promise.js', included: false },
      { pattern: 'dist/es6-module-loader.js', included: false }
    ],
    reporters: ['dots'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome', 'Firefox'],
    singleRun: false
  });
};
