var ML = require('../lib/es6-module-loader.js');

ML.System.import('test-file', function(m) {
  if (m.hello == 'world')
    console.log('1 test passed');
});
