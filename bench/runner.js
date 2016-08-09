var LoaderNodeBabel = require('../dist/loader-node-babel.js');
var loader = new LoaderNodeBabel(process.cwd());

var fs = require('fs');
var benchmarks = fs.readdirSync('bench').filter(function(testName) {
  return testName != 'runner.js' && testName.endsWith('.js')
});

var path = require('path');

function runNextBenchmark() {
  var Benchmark = require('benchmark');

  var nextBenchmark = benchmarks.shift();

  if (!nextBenchmark)
    return Promise.resolve();

  global.suite = new Benchmark.Suite;

  console.log('--- ' + nextBenchmark.substr(0, nextBenchmark.length - 3) + ' ---');

  return loader.import(path.resolve('bench/' + nextBenchmark))
  .then(function() {
    return new Promise(function(resolve, reject) {
      suite.on('cycle', function(event) {
        console.log(String(event.target));
      });

      suite.on('complete', function(event) {
        console.log('Fastest is ' + this.filter('fastest').map('name') + '\n');
        resolve();
      });

      suite.on('error', reject);

      suite.run({ async: true });
    });
  })
  .then(function() {
    return runNextBenchmark();
  });
}

runNextBenchmark();