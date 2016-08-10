var LoaderNodeBabel = require('../dist/loader-node.js');

var loader = new LoaderNodeBabel(process.cwd());

var Mocha = require('mocha');
var runner = new Mocha({ ui: 'bdd' });
runner.suite.emit('pre-require', global, 'global-mocha-context', runner);

var fs = require('fs');
var tests = fs.readdirSync('test').filter(function(testName) {
  return testName != 'runner.js' && testName.endsWith('.js')
});

var path = require('path');

Promise.all(tests.map((test) => loader.import(path.resolve('test/' + test))))
.then(function() {
  runner.run();
})
.catch(function(err) {
  setTimeout(function() {
    throw err;
  });
});