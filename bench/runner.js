import fs from 'fs';
import path from 'path';
import Benchmark from 'benchmark';

var benchmarks = fs.readdirSync('bench').filter(function(testName) {
  return testName != 'runner.js' && testName.endsWith('.js')
});

process.on('unhandledRejection', function (e) {
  setTimeout(function () {
    throw e;
  });
});

function runNextBenchmark() {
  var nextBenchmark = benchmarks.shift();

  if (!nextBenchmark)
    return Promise.resolve();

  global.suite = new Benchmark.Suite;

  console.log('--- ' + nextBenchmark.substr(0, nextBenchmark.length - 3) + ' ---');

  return loader.import(path.resolve('bench/' + nextBenchmark))
  .then(function() {
    return new Promise(function(resolve, reject) {
      suite.on('cycle', function(event) {
        console.log(event.target.error ? event.target.error : String(event.target));
      });

      suite.on('complete', function(event) {
        console.log('Fastest is ' + this.filter('fastest').map('name') + '\n');
        resolve();
      });

      suite.on('error', reject);

      suite.run({ defer: true });
    });
  })
  .then(function() {
    return runNextBenchmark();
  });
}

runNextBenchmark();
