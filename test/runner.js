import Mocha from 'mocha';
import fs from 'fs';
import path from 'path';

var runner = new Mocha({ ui: 'bdd' });
runner.suite.emit('pre-require', global, 'global-mocha-context', runner);

var tests = fs.readdirSync('test').filter(function(testName) {
  return testName != 'runner.js' && testName.endsWith('.js');
});

Promise.all(tests.map((test) => loader.import(path.resolve('test/' + test))))
.then(function() {
  runner.run();
})
.catch(function(err) {
  setTimeout(function() {
    throw err;
  });
});
