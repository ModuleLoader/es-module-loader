var customLaunchers = require('./.sauceLabsBrowsers');

module.exports = function(config) {
  var opts = {
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
    reporters: ['mocha', 'saucelabs'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,

    singleRun: true,
    browserDisconnectTimeout: 10000,
    browserDisconnectTolerance: 2,
    browserNoActivityTimeout: 30000,
    captureTimeout: 120000,

    browsers: Object.keys(customLaunchers),
    sauceLabs: {
      testName:'es6-module-loader',
      recordScreenshots: false
    },
    customLaunchers: customLaunchers

  };

  if(process.env.TRAVIS){
    var buildLabel = 'TRAVIS #' + process.env.TRAVIS_BUILD_NUMBER + ' (' + process.env.TRAVIS_BUILD_ID + ')';

    opts.sauceLabs.build = buildLabel;
    opts.sauceLabs.tunnelIdentifier = process.env.TRAVIS_JOB_NUMBER;
  }

  config.set(opts);
};
