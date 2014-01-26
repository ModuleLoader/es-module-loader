
var System, Loader, Module, tests, test;

var testCnt = 0, passed = 0, failed = 0;
var test = function(name, initialize) {
  if (typeof initialize != 'function') {
    var val = initialize;
    var exp = arguments[2];
    initialize = function(assert) {
      assert(val, exp);
    }
  }
  var testId = testCnt++;
  tests.addTest(testId, name);
  function assert(value, expected) {
    if (value != expected)
      return 'Got "' + value + '" instead of "' + expected + '"';
  }
  initialize(function(value, expected) {
    var failure;
    if (value instanceof Array) {
      for (var i = 0; i < arguments.length; i++)
        failure = failure || assert(arguments[i][0], arguments[i][1]);
    }
    else
      failure = assert(value, expected);
    if (failure)
      failed++;
    else
      passed++;
    tests.completeTest(testId, name, failure, { passed: passed, failed: failed, total: testCnt });
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
    completeTest: function(id, name, failure, summary) {
      document.querySelector('.test .result-' + id).innerHTML = !failure ? 'Passed' : 'Failed: ' + failure;
      document.querySelector('.summary').innerHTML = summary.passed + '/' + summary.total + ' tests passed';
    }
  }
  window.test = test;
  window.runTests = runTests;
}
else {
  // nodejs
  var ml = require('../lib/es6-module-loader');

  System = ml.System;
  Loader = ml.Loader;
  Module = ml.Module;

  tests = {
    addTest: function(id, name) {},
    completeTest: function(id, name, failure, summary) {
      console.log(name + ': ' + (!failure ? 'Passed' : 'Failed: ' + result.failedAssertion));
      console.log(summary.passed + '/' + summary.total + ' passed. ');
    },
  };

  runTests();
}

function runTests() {
  // Normalize tests - identical to https://github.com/google/traceur-compiler/blob/master/test/unit/runtime/System.js

  var oldBaseURL = System.baseURL;
  System.baseURL = 'http://example.org/a/b.html';

  test('Normalize - No Referer', System.normalize('d/e/f'), 'd/e/f');
  // test('Normalize - Below baseURL', System.normalize('../e/f'), '../e/f');

  var refererName = 'dir/file';
  test('Normalize - Relative paths', System.normalize('./d/e/f', refererName), 'dir/d/e/f');
  test('Normalize - Relative paths', System.normalize('../e/f', refererName), 'e/f');

  test('Normalize - name undefined', function(assert) {
    try {
      System.normalize(undefined, refererName);
    }
    catch(e) {
      assert(e.message, 'Module name must be a string');
    }
  });

  test('Normalize - embedded ..', function(assert) {
    try {
      System.normalize('a/b/../c');
    }
    catch(e) {
      assert(e.message, 'Illegal module name"a/b/../c"');
    }
  });
  test('Normalize - embedded ..', function(assert) {
    try {
      System.normalize('a/../b', refererName);
    }
    catch(e) {
      assert(e.message, 'Illegal module name"a/../b"');
    }
  });
  test('Normalize - embedded ..', function(assert) {
    try {
      System.normalize('a/b/../c', refererName);
    }
    catch(e) {
      assert(e.message, 'Illegal module name"a/b/../c"');
    }
  });

  // test('Normalize - below referer', System.normalize('../../e/f', refererName), '../e/f');

  test('Normalize - backwards compat', System.normalize('./a.js'), 'a.js');

  test('Normalize - URL', function(assert) {
    try {
      System.normalize('http://example.org/a/b.html');
    }
    catch(e) {
      assert();
    }
  });

  System.baseURL = 'http://example.org/a/';

  test('Locate', System.locate({ name: '@abc/def' }), 'http://example.org/a/@abc/def.js');
  test('Locate', System.locate({ name: 'abc/def' }), 'http://example.org/a/abc/def.js');

  // paths
  System.paths['path/*'] = '/test/*.js';
  test('Locate paths', System.locate({ name: 'path/test' }), 'http://example.org/test/test.js');


  System.baseURL = oldBaseURL;



  // More Normalize tests

  test('Normalize test 1', function(assert) {
    assert(System.normalize('./a/b', 'c'), 'a/b');
  });
  test('Normalize test 2', function(assert) {
    assert(System.normalize('./a/b', 'c/d'), 'c/a/b');
  });
  test('Normalize test 3', function(assert) {
    assert(System.normalize('./a/b', '../c/d'), '../c/a/b');
  });
  test('Normalize test 4', function(assert) {
    assert(System.normalize('./a/b', '../c/d'), '../c/a/b');
  });
  test('Normalize test 5', function(assert) {
    assert(System.normalize('../a/b', '../../c/d'), '../../a/b');
  });


  test('Import a script', function(assert) {
    System.import('syntax/script').then(function(m) {
      assert(!!m, true);
    });
  });

  test('Import ES6', function(assert) {
    System.import('syntax/es6').then(function(m) {
      assert(m.p, 'p');
    });
  });



  test('Import ES6 with dep', function(assert) {
    System.import('syntax/es6-withdep').then(function(m) {
      assert(m.p, 'p');
    }, function(e) {
      console.log(e);
    });
  });

  test('Direct import without bindings', function(assert) {
    System.import('syntax/direct').then(function(m) {
      console.log('got direct');
      assert(!!m, true);
    });
  });


  test('Load order test: A', function(assert) {
    System.import('loads/a').then(function(m) {
      assert(
        [m.a, 'a'],
        [m.b, 'b']
      );
    });
  });

  test('Load order test: C', function(assert) {
    System.import('loads/c').then(function(m) {
      assert(
        [m.c, 'c'],
        [m.a, 'a'],
        [m.b, 'b']
      );
    });
  });

  test('Load order test: S', function(assert) {
    System.import('loads/s').then(function(m) {
      assert(
        [m.s, 's'],
        [m.c, 'c'],
        [m.a, 'a'],
        [m.b, 'b']
      );
    });
  });

  test('Load order test: _a', function(assert) {
    System.import('loads/_a').then(function(m) {
      assert(
        [m.b, 'b'],
        [m.d, 'd'],
        [m.g, 'g'],
        [m.a, 'a']
      );
    })
  });
  test('Load order test: _e', function(assert) {
    System.import('loads/_e').then(function(m) {
      assert(
        [m.c, 'c'],
        [m.e, 'e']
      );
    })
  });
  test('Load order test: _f', function(assert) {
    System.import('loads/_f').then(function(m) {
      assert(
        [m.g, 'g'],
        [m.f, 'f']
      );
    })
  });
  test('Load order test: _h', function(assert) {
    System.import('loads/_h').then(function(m) {
      assert(
        [m.i, 'i'],
        [m.a, 'a'],
        [m.h, 'h']
      );
    })
  });

  test('Export Syntax', function(assert) {
    System.import('syntax/export').then(function(m) {
      assert(
        [m.p, 5],
        [typeof m.foo, 'function'],
        [typeof m.q, 'object'],
        [m.default.name, 'bar'],
        [m.s, 4],
        [m.t, 4],
        [typeof m.m, 'object']
      );
    });
  });

  test('Re-export', function(assert) {
    System.import('syntax/reexport1').then(function(m) {
      assert(m.p, 5);
    });
  });

  test('Re-export with new name', function(assert) {
    System.import('syntax/reexport2').then(function(m) {
      assert(
        [m.q, 4],
        [m.z, 5]
      );
    }).catch(function(err) {
      console.log('error');
      console.log(err);
    });
  });

  test('Import Syntax', function(assert) {
    System.import('syntax/import').then(function(m) {
      assert(
        [m.a.name, 'bar'],
        [m.b, 4],
        [m.c, 5],
        [m.d, 4],
        [typeof m.q.foo, 'function']
      );
    });
  });


  test('ES6 Syntax', function(assert) {
    System.import('syntax/es6-file').then(function(m) {
      assert(
        [typeof m.q, 'function']
      );
    });
  });

  test('Module Name meta', function(assert) {
    System.import('loader/moduleName').then(function(m) {
      assert(
        [m.name, 'loader/moduleName']
      );
    })
  });

  test('Custom path', function(assert) {
    System.paths['bar'] = 'loader/custom-path.js';
    System.import('bar').then(function(m) {
      assert(m.bar, 'bar');
    })
  });

  test('Custom path wildcard', function(assert) {
    System.paths['bar/*'] = 'loader/custom-folder/*.js';
    System.import('bar/path').then(function(m) {
      assert(m.bar, 'baa');
    });
  });

  test('Custom path most specific', function(assert) {
    System.paths['bar/bar'] = 'loader/specific-path.js';
    System.import('bar/bar').then(function(m) {
      assert(m.path, true);
    });
  });


  var customLoader = new Loader({
    normalize: function(name, parentName, parentAddress) {
      return new Promise(function(resolve, reject) {
        if (name == 'asdfasdf') {
          return setTimeout(function() {
            resolve('loader/async-norm');
          }, 500);
        }
        
        if (name == 'error1')
          return setTimeout(function(){ reject('error1'); }, 100);

        var normalized = System.normalize(name, parentName, parentAddress);
        resolve(normalized);
      });
    },
    locate: function(load) {
        if (load.name == 'error2')
          return new Promise(function(resolve, reject) {
            setTimeout(function(){ reject('error2'); }, 100);
          });

      if (load.name.substr(0, 5) == 'path/')
        load.name = 'loader/' + load.name.substr(5);
      return System.locate(load);
    },
    fetch: function(load) {
      if (load.name == 'error3')
        throw 'error3';
      if (load.name == 'error4' || load.name == 'error5')
        return 'asdf';
      return System.fetch.apply(this, arguments);
    },
    translate: function(load) {
      if (load.name == 'error4')
        return new Promise(function(resolve, reject) {
          setTimeout(function(){ reject('error4'); }, 100);
        });
      return System.translate.apply(this, arguments);
    },
    instantiate: function(load) {
      if (load.name == 'error5')
        return new Promise(function(resolve, reject) {
          setTimeout(function(){ reject('error5'); }, 100);
        });
      // very bad AMD support
      if (load.source.indexOf('define') == -1)
        return System.instantiate(load);
      
      var factory, deps;
      var define = function(_deps, _factory) {
        deps = _deps;
        factory = _factory;
      }
      eval(load.source);
      return {
        deps: deps,
        execute: function() {
          var deps = [];
          for (var i = 0; i < arguments.length; i++)
            deps.push(customLoader.get(arguments[i]));
          return new Module(factory.apply(null, deps));
        }
      }
    }
  });


  test('Custom loader standard load', function(assert) {
    var p = customLoader.import('loader/test').then(function(m) {
      assert(m.loader, 'custom');
    });
    if (p.catch)
      p.catch(function() {});
  });
  test('Custom loader special rules', function(assert) {
    customLoader.import('path/custom').then(function(m) {
      assert(m.path, true);
    });
  });
  test('Custom loader AMD support', function(assert) {
    customLoader.import('loader/amd').then(function(m) {
      assert(m.format, 'amd');
    });
  });
  test('Custom loader hook - normalize error', function(assert) {
    customLoader.import('loader/error1-parent').then(function(m) {
      console.log('got n');
    }).catch(function(e) {
      assert(e, 'error1');
    });
  });
  test('Custom loader hook - locate error', function(assert) {
    customLoader.import('error2').then(function(m) {}, function(e) {
      assert(e, 'error2');
    });
  });
  test('Custom loader hook - fetch error', function(assert) {
    customLoader.import('error3').then(function(m) {}, function(e) {
      assert(e, 'error3');
    });
  });
  test('Custom loader hook - translate error', function(assert) {
    customLoader.import('error4').then(function(m) {}, function(e) {
      assert(e, 'error4');
    });
  });
  test('Custom loader hook - instantiate error', function(assert) {
    customLoader.import('error5').then(function(m) {}, function(e) {
      assert(e, 'error5');
    });
  });

  test('Async Normalize', function(assert) {
    customLoader.normalize('asdfasdf').then(function(normalized) {
      return customLoader.import(normalized);
    }).then(function(m) {
      assert(m.n, 'n');
    });
  });
}
