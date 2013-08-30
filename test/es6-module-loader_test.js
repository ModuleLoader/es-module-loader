var System = require('../lib/es6-module-loader.js').System;

System.import('test-file', function(m) {
  if (m.hello == 'world')
    console.log('Basic load passed');
});

console.log('Normalize test 1: ' + (System.normalize('./a/b', { name: 'c' }) == 'a/b'));
console.log('Normalize test 2: ' + (System.normalize('./a/b', { name: 'c/d' }) == 'c/a/b'));
console.log('Normalize test 3: ' + (System.normalize('./a/b', { name: '../c/d' }) == '../c/a/b'));
console.log('Normalize test 4: ' + (System.normalize('./a/b', { name: '../c/d' }) == '../c/a/b'));
console.log('Normalize test 5: ' + (System.normalize('../a/b', { name: '../../c/d' }) == '../../a/b'));
console.log('Normalize test 6: ' + (System.normalize('../../a/b', { name: 'c/d' }) == '../a/b'));
console.log('Normalize test 7: ' + (System.normalize('../core', { name: 'core/ready' }) == 'core'));

