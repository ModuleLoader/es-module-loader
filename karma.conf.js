'use strict';

var util = require('util');
var pkg = require('./package.json');
var extend = util._extend;
var geSaLaKaCuLa = require('gesalakacula');

// No Karma options are passed after the double dash option (`--`)
// Example : karma start --single-run -- --polyfill
//        >> { _: [], polyfill: true }

var _argv = process.argv;
var argv = require('minimist')(_argv.slice(_argv.indexOf('--') + 1));

var options = extend({
  travis: process.env.TRAVIS,
  polyfill: false,
  saucelabs: false,
  coverage: false,
  'native-iterator': false
}, argv);

if (options.saucelabs) {
  options.polyfill = true;
}

////

module.exports = function(config) {

  var files = [
    'test/_helper.js',
    [options.babel ? 'node_modules/regenerator-runtime/runtime.js' : ''],

    [!options['babel'] ? 'node_modules/traceur/bin/traceur.js' : 'node_modules/babel-core/browser.js'],

    [options.polyfill ? 'node_modules/when/es6-shim/Promise.js' : ''],

    [options['native-iterator'] ? '': 'node_modules/core-js/client/core.js'],

    [options['force-map-polyfill'] ? 'test/force-map-polyfill.js' : ''],

    ['dist/es6-module-loader-declarative.src.js'],

    'test/_browser.js',
    'test/browser-script-type-module.js',
    'test/custom-loader.js',

    ['test/*.spec.js'],

    [options['native-iterator'] ? 'test/*.native-iterator-spec.js' : ''],

    {pattern: 'test/{loader,loads,syntax,worker}/**/*', included: false},
    {pattern: 'node_modules/traceur/bin/traceur.js', included: false},
    {pattern: 'node_modules/babel-core/browser.js', included: false},
    {pattern: 'node_modules/when/es6-shim/Promise.js', included: false},
    {pattern: 'dist/es6-module-loader*.js', included: false}
  ];

  // Default Config
  config.set({
    basePath: '',
    frameworks: ['mocha', 'expect'],
    files: flatten(files),
    reporters: ['mocha'],
    browsers: ['Firefox'], // 'Chrome' disabled for the moment
    client: {
      mocha: {
        reporter: 'html',
        timeout: 8000
      },
      system: {
        transpiler: options.babel ? 'babel' : 'traceur'
      }
    }
  });

  if (options.coverage) {
    config.set({
      reporters: ['mocha', 'coverage'],
      preprocessors: {
        'dist/es6-module-loader*.src.js': ['coverage']
      },
      coverageReporter: {
        type : 'html',
        dir : 'coverage/'
      },
      browsers: ['Firefox']
    });
  }

  if (options.travis) {
    // TRAVIS config overwrite
    config.set({
      singleRun: true,
      reporters: ['dots'],
      // customLaunchers: {
      //   'TR_Chrome': {
      //     base: 'Chrome',
      //     flags: ['--no-sandbox']
      //   }
      // },
      browsers: ['Firefox'] // 'TR_Chrome', disabled for the moment
    });
  }

  if (options.saucelabs) {

    var customLaunchers = geSaLaKaCuLa({
      'Windows 7': {
        'internet explorer': '9..11'
      }
    });
    

    // IE tests disabled for now (https://github.com/ModuleLoader/es6-module-loader/issues/295)
    customLaunchers = undefined;

    if (options['native-iterator']) {
      customLaunchers = geSaLaKaCuLa({
        'Windows 7': {
          'firefox': '41'
        }
      })
    }

    var now = new Date();
    var buildData = options.travis ?
    {
      location: 'TRAVIS',
      name: process.env.TRAVIS_JOB_NUMBER,
      id: process.env.TRAVIS_BUILD_ID
    }
      :
    {
      location: 'LOCAL',
      name: now.toString(),
      id: +now
    };
    var build = util.format('%s #%s (%s)',
      buildData.location, buildData.name, buildData.id);

    console.log('SauceLabs Run\n- Build : ' + build + '\n');

    config.set({
      reporters: ['dots', 'saucelabs'],

      browserDisconnectTimeout: 10000,
      browserDisconnectTolerance: 2,
      browserNoActivityTimeout: 30000,
      captureTimeout: 120000,

      sauceLabs: {
        testName: pkg.name,
        recordScreenshots: false,
        build: build,
        tunnelIdentifier: options.travis ?
          process.env.TRAVIS_JOB_NUMBER : Math.floor(Math.random() * 1000)
      }
    });

    if (customLaunchers)
      config.set({
        browsers: Object.keys(customLaunchers),
        customLaunchers: customLaunchers
      });
  }
};

function flatten(arr) {
  return arr.reduce(function(memo, val) {
    return memo.concat(util.isArray(val) ? flatten(val) : val ? [val] : []);
  }, []);
}
