
var System, test, tests;

var testCnt = 0, passed = 0, failed = 0;
var test = function(name, initialize) {
  var testId = testCnt++;
  tests.addTest(testId, name);
  initialize(function() {
    var failed = false;
    var failedAssertion;
    for (var i = 0; i < arguments.length; i++)
      if (!arguments[i]) {
        failed = true;
        failedAssertion = i + 1;
      }
    if (!failed)
      passed++;
    else
      failed++;
    tests.completeTest(testId, name, {
      passed: !failed, 
      failedAssertion: failedAssertion
    }, {
      passed: passed, 
      failed: failed, 
      total: testCnt
    });
  });
}

if (typeof window != 'undefined') {
  // browser
  document.body.innerHTML = "<table class='test'><tbody></tbody><td>Summary</td><td class='summary'></td></table>";
  tests = {
    addTest: function(id, name) {
      var p = document.createElement('tr');
      p.innerHTML = '<td>' + name + '</td><td class="result-' + id + '"></td>'
      document.querySelector('.test tbody').appendChild(p);
    },
    completeTest: function(id, name, result, summary) {
      document.querySelector('.test .result-' + id).innerHTML = result.passed ? 'Passed' : 'Failed Assertion ' + result.failedAssertion;
      document.querySelector('.summary').innerHTML = summary.passed + '/' + summary.total + ' tests passed';
    }
  }
}
else {
  // nodejs
  System = require('../lib/es6-module-loader.js').System;
  require('traceur') = require('../lib/traceur');

  tests = {
    addTest: function(id, name) {},
    completeTest: function(id, name, result, summary) {
      console.log(name + ': ' + (result.passed ? 'Passed' : 'Failed Assertion ' + result.failedAssertion));
      console.log(summary.passed + '/' + summary.total + ' passed. ');
    },
  };
}

test('Normalize test 1', function(assert) {
  assert(System.normalize('./a/b', { name: 'c' }) == 'a/b');
});
test('Normalize test 2', function(assert) {
  assert(System.normalize('./a/b', { name: 'c/d' }) == 'c/a/b');
});
test('Normalize test 3', function(assert) {
  assert(System.normalize('./a/b', { name: '../c/d' }) == '../c/a/b');
});
test('Normalize test 4', function(assert) {
  assert(System.normalize('./a/b', { name: '../c/d' }) == '../c/a/b');
});
test('Normalize test 5', function(assert) {
  assert(System.normalize('../a/b', { name: '../../c/d' }) == '../../a/b');
});
test('Normalize test 6', function(assert) {
  assert(System.normalize('../../a/b', { name: 'c/d' }) == '../a/b');
});
test('Normalize test 7', function(assert) {
  assert(System.normalize('../core', { name: 'core/ready' }) == 'core');
});

test('Export Syntax', function(assert) {
  System.import('syntax/export', function(m) {
    assert(
      m.p === 5,
      typeof m.foo == 'function',
      typeof m.q == 'object',
      m.default.name == 'bar',
      m.s == 4,
      m.t == 4,
      typeof m.m == 'object'
    );
  });
});

test('Re-export', function(assert) {
  System.import('syntax/reexport1', function(m) {
    assert(m.p === 5);
  });
});

test('Re-export with new name', function(assert) {
  System.import('syntax/reexport2', function(m) {
    assert(m.q == 4, m.z == 5);
  })
});

test('Import Syntax', function(assert) {
  System.import('syntax/import', function(m) {
    assert(
      m.a.name == 'bar',
      m.b == 4,
      m.c == 5,
      m.d == 4,
      m.q == System.get('syntax/export')
    );
  });
});

test('ES6 Syntax', function(assert) {
  System.import('syntax/es6-file', function(m) {
    assert(m);
  });
});





