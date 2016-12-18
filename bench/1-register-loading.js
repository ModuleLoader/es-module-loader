import RegisterLoader from '../core/register-loader.js';

// sync require SystemJS in this scope
import Module from 'module';
import { fileUrlToPath } from '../core/common.js';

var base = fileUrlToPath(__moduleName);
var parentModuleContext = new Module(base);
parentModuleContext.paths = Module._nodeModulePaths(base);
var curSystem = global.System;
var SystemJS = parentModuleContext.require('systemjs');
global.System = curSystem;

function declareBundle(loader) {
  loader.register('_e.js', ['_c.js'], function (_export, _context) {
    "use strict";

    var e;
    return {
      setters: [function (_cJs) {
        var _exportObj = {};
        _exportObj.c = _cJs.c;

        _export(_exportObj);
      }],
      execute: function () {
        _export('e', e = 'e');

        _export('e', e);
      }
    };
  });
  loader.register('_f.js', ['_g.js'], function (_export, _context) {
    "use strict";

    var f;
    return {
      setters: [function (_gJs) {
        var _exportObj = {};
        _exportObj.g = _gJs.g;

        _export(_exportObj);
      }],
      execute: function () {
        _export('f', f = 'f');

        _export('f', f);
      }
    };
  });
  loader.register('_g.js', [], function (_export, _context) {
    "use strict";

    var g;
    return {
      setters: [],
      execute: function () {
        _export('g', g = 'g');

        _export('g', g);
      }
    };
  });
  loader.register('_a.js', ['_b.js', '_d.js', '_g.js'], function (_export, _context) {
    "use strict";

    var a;
    return {
      setters: [function (_bJs) {
        var _exportObj = {};
        _exportObj.b = _bJs.b;

        _export(_exportObj);
      }, function (_dJs) {
        var _exportObj2 = {};
        _exportObj2.d = _dJs.d;

        _export(_exportObj2);
      }, function (_gJs) {
        var _exportObj3 = {};
        _exportObj3.g = _gJs.g;

        _export(_exportObj3);
      }],
      execute: function () {
        _export('a', a = 'a');

        _export('a', a);
      }
    };
  });
  loader.register('_d.js', [], function (_export, _context) {
    "use strict";

    var d;
    return {
      setters: [],
      execute: function () {
        _export('d', d = 'd');

        _export('d', d);
      }
    };
  });
  loader.register('_c.js', ['_d.js'], function (_export, _context) {
    "use strict";

    var c;
    return {
      setters: [function (_dJs) {
        var _exportObj = {};
        _exportObj.d = _dJs.d;

        _export(_exportObj);
      }],
      execute: function () {
        _export('c', c = 'c');

        _export('c', c);
      }
    };
  });
  loader.register('_b.js', ['_c.js'], function (_export, _context) {
    "use strict";

    var b;
    return {
      setters: [function (_cJs) {
        var _exportObj = {};
        _exportObj.c = _cJs.c;

        _export(_exportObj);
      }],
      execute: function () {
        _export('b', b = 'b');

        _export('b', b);
      }
    };
  });
  loader.register('_i.js', ['_b.js'], function (_export, _context) {
    "use strict";

    var i;
    return {
      setters: [function (_bJs) {
        var _exportObj = {};
        _exportObj.b = _bJs.b;

        _export(_exportObj);
      }],
      execute: function () {
        _export('i', i = 'i');

        _export('i', i);
      }
    };
  });
  loader.register('_h.js', ['_a.js', '_i.js'], function (_export, _context) {
    "use strict";

    var h;
    return {
      setters: [function (_aJs) {
        var _exportObj = {};
        _exportObj.a = _aJs.a;

        _export(_exportObj);
      }, function (_iJs) {
        var _exportObj2 = {};
        _exportObj2.i = _iJs.i;

        _export(_exportObj2);
      }],
      execute: function () {
        _export('h', h = 'h');

        _export('h', h);
      }
    };
  });
  loader.register('circular2.js', ['circular1.js'], function (_export, _context) {
    "use strict";

    var fn1, variable1, variable2, output;
    function fn2() {
      _export('output', output = variable1);
    }

    _export('fn2', fn2);

    return {
      setters: [function (_circular1Js) {
        fn1 = _circular1Js.fn1;
        variable1 = _circular1Js.variable1;
        var _exportObj = {};
        _exportObj.output1 = _circular1Js.output;

        _export(_exportObj);
      }],
      execute: function () {
        _export('variable2', variable2 = 'test circular 2');

        _export('variable2', variable2);

        fn1();

        _export('output', output);
      }
    };
  });
  loader.register('circular1.js', ['circular2.js'], function (_export, _context) {
    "use strict";

    var fn2, variable2, variable1, output;
    function fn1() {
      _export('output', output = variable2);
    }

    _export('fn1', fn1);

    return {
      setters: [function (_circular2Js) {
        fn2 = _circular2Js.fn2;
        variable2 = _circular2Js.variable2;
        var _exportObj = {};
        _exportObj.output2 = _circular2Js.output;

        _export(_exportObj);
      }],
      execute: function () {
        _export('variable1', variable1 = 'test circular 1');

        _export('variable1', variable1);

        fn2();

        _export('output', output);
      }
    };
  });
  loader.register("direct.js", ['es6-dep.js'], function (_export, _context) {
    "use strict";

    var p;
    return {
      setters: [function (_es6DepJs) {
        p = _es6DepJs.p;
      }],
      execute: function () {}
    };
  });
  loader.register("test-file.js", [], function (_export, _context) {
    "use strict";

    var s;
    function q() {}

    _export("default", q);

    return {
      setters: [],
      execute: function () {
        _export("s", s = 4);

        _export("s", s);
      }
    };
  });
  loader.register('es6-file.js', ['test-file.js'], function (_export, _context) {
    "use strict";

    var Q, p;
    return {
      setters: [function (_testFileJs) {
        Q = _testFileJs;
      }],
      execute: function () {
        class q {
          foo() {
            throw 'g';
            console.log('class method');
          }
        }

        _export('q', q);

        _export('default', 4);

        p = 5;
      }
    };
  });
  loader.register('es6-dep.js', [], function (_export, _context) {
    "use strict";

    var p;
    return {
      setters: [],
      execute: function () {
        _export('p', p = 'p');

        _export('p', p);
      }
    };
  });
  loader.register("es6-withdep.js", ['es6-dep.js'], function (_export, _context) {
    "use strict";

    return {
      setters: [function (_es6DepJs) {
        var _exportObj = {};
        _exportObj.p = _es6DepJs.p;

        _export(_exportObj);
      }],
      execute: function () {}
    };
  });
  loader.register('es6.js', [], function (_export, _context) {
    "use strict";

    var p;
    return {
      setters: [],
      execute: function () {
        _export('p', p = 'p');

        _export('p', p);
      }
    };
  });
  loader.register('odd.js', ['even.js'], function (_export, _context) {
    "use strict";

    var even;
    function odd(n) {
      return n != 0 && even(n - 1);
    }

    _export('odd', odd);

    return {
      setters: [function (_evenJs) {
        even = _evenJs.even;
      }],
      execute: function () {}
    };
  });
  loader.register('even.js', ['odd.js'], function (_export, _context) {
    "use strict";

    var odd, counter;
    function even(n) {
      _export('counter', counter++);
      return n == 0 || odd(n - 1);
    }

    _export('even', even);

    return {
      setters: [function (_oddJs) {
        odd = _oddJs.odd;
      }],
      execute: function () {
        _export('counter', counter = 0);

        _export('counter', counter);

        odd(1);
      }
    };
  });
  loader.register('export-default.js', [], function (_export, _context) {
    "use strict";

    _export('default', function () {
      return 'test';
    });

    return {
      setters: [],
      execute: function () {}
    };
  });
  loader.register('star-dep.js', [], function (_export, _context) {
    "use strict";

    var foo;
    return {
      setters: [],
      execute: function () {
        _export('foo', foo = 'foo');

        _export('foo', foo);
      }
    };
  });
  loader.register("export-star.js", ['star-dep.js'], function (_export, _context) {
    "use strict";

    var bar;
    return {
      setters: [function (_starDepJs) {
        var _exportObj = {};

        for (var _key in _starDepJs) {
          if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _starDepJs[_key];
        }

        _export(_exportObj);
      }],
      execute: function () {
        _export('bar', bar = 'bar');

        _export('bar', bar);
      }
    };
  });
  loader.register('export-star2.js', ['export-star.js'], function (_export, _context) {
    "use strict";

    function foo() {}

    _export('foo', foo);

    return {
      setters: [function (_exportStarJs) {
        var _exportObj = {};

        for (var _key in _exportStarJs) {
          if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _exportStarJs[_key];
        }

        _export(_exportObj);
      }],
      execute: function () {}
    };
  });
  loader.register("reexport1.js", ['export.js'], function (_export, _context) {
    "use strict";

    return {
      setters: [function (_exportJs) {
        var _exportObj = {};

        for (var _key in _exportJs) {
          if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _exportJs[_key];
        }

        _export(_exportObj);
      }],
      execute: function () {}
    };
  });
  loader.register("export.js", [], function (_export, _context) {
    "use strict";

    var p, q, s;
    function foo() {}
    _export("foo", foo);

    function bar() {}
    _export("default", bar);

    return {
      setters: [],
      execute: function () {
        _export("p", p = 5);

        _export("p", p);

        ;

        _export("m", _export("q", q = {}));

        _export("q", q);

        ;

        _export("t", _export("s", s = 4));

        _export("s", s);

        _export("t", s);

        _export("m", q);
      }
    };
  });
  loader.register('reexport2.js', ['export.js'], function (_export, _context) {
    "use strict";

    return {
      setters: [function (_exportJs) {
        var _exportObj = {};
        _exportObj.q = _exportJs.t;
        _exportObj.z = _exportJs.p;

        _export(_exportObj);
      }],
      execute: function () {
        _export('default', 4);
      }
    };
  });
  loader.register('import.js', ['export.js', 'reexport1.js', 'reexport2.js'], function (_export, _context) {
    "use strict";

    var d, p, z, r, q;
    return {
      setters: [function (_exportJs) {
        d = _exportJs.default;
      }, function (_reexport1Js) {
        p = _reexport1Js.s;
        q = _reexport1Js;
      }, function (_reexport2Js) {
        z = _reexport2Js.z;
        r = _reexport2Js.q;
      }],
      execute: function () {
        _export('a', d);

        _export('b', p);

        _export('c', z);

        _export('d', r);

        _export('q', q);
      }
    };
  });
  loader.register("moduleName.js", [], function (_export, _context) {
    "use strict";

    var name;
    return {
      setters: [],
      execute: function () {
        _export("name", name = _context.id);

        _export("name", name);
      }
    };
  });
  loader.register('no-imports.js', [], function (_export, _context) {
    "use strict";

    var asdf;
    return {
      setters: [],
      execute: function () {
        _export('asdf', asdf = 'asdf');

        _export('asdf', asdf);
      }
    };
  });
  loader.register("rebinding.js", [], function (_export, _context) {
    "use strict";

    var p;
    return {
      setters: [],
      execute: function () {
        _export("p", p = 4);

        _export("p", p);
      }
    };
  });
  loader.register("reexport-binding.js", ['rebinding.js'], function (_export, _context) {
    "use strict";

    return {
      setters: [function (_rebindingJs) {
        var _exportObj = {};
        _exportObj.p = _rebindingJs.p;

        _export(_exportObj);
      }],
      execute: function () {}
    };
  });
  loader.register('c.js', ['a.js'], function (_export, _context) {
    "use strict";

    var c;
    return {
      setters: [function (_aJs) {
        var _exportObj = {};
        _exportObj.a = _aJs.a;
        _exportObj.b = _aJs.b;

        _export(_exportObj);
      }],
      execute: function () {
        _export('c', c = 'c');

        _export('c', c);
      }
    };
  });
  loader.register('b.js', [], function (_export, _context) {
    "use strict";

    var b;
    return {
      setters: [],
      execute: function () {
        _export('b', b = 'b');

        _export('b', b);
      }
    };
  });
  loader.register('a.js', ['b.js'], function (_export, _context) {
    "use strict";

    var a;
    return {
      setters: [function (_bJs) {
        var _exportObj = {};
        _exportObj.b = _bJs.b;

        _export(_exportObj);
      }],
      execute: function () {
        _export('a', a = 'a');

        _export('a', a);
      }
    };
  });
  loader.register('s.js', ['c.js', 'a.js'], function (_export, _context) {
    "use strict";

    var s;
    return {
      setters: [function (_cJs) {
        var _exportObj = {};
        _exportObj.b = _cJs.b;
        _exportObj.c = _cJs.c;

        _export(_exportObj);
      }, function (_aJs) {
        var _exportObj2 = {};
        _exportObj2.a = _aJs.a;

        _export(_exportObj2);
      }],
      execute: function () {
        _export('s', s = 's');

        _export('s', s);
      }
    };
  });
}

function declaredSystemJSLoader() {
  var sjsLoader = new SystemJS.constructor();
  declareBundle(sjsLoader);
  return sjsLoader;
}
RegisterLoader.prototype[RegisterLoader.resolve] = function(key) {
  return key;
};
function declaredRegisterLoader() {
  var loader = new RegisterLoader();
  declareBundle(loader);
  return loader;
}

suite.add('Importing multiple trees at the same time with RegisterLoader', {
  defer: true,
  fn: async function(deferred) {
    var loader = declaredRegisterLoader();
    await Promise.all(allModules.map(m => loader.import(m)));
    deferred.resolve();
  }
});

suite.add('Importing a deep tree of modules with RegisterLoader', {
  defer: true,
  fn: async function(deferred) {
    var loader = declaredRegisterLoader();
    await loader.import('_a.js');
    deferred.resolve();
  }
});

suite.add('Importing a module with deps with RegisterLoader', {
  defer: true,
  fn: async function(deferred) {
    var loader = declaredRegisterLoader();
    await loader.import('es6-withdep.js');
    deferred.resolve();
  }
});

suite.add('Importing a single registered module with RegisterLoader', {
  defer: true,
  fn: async function(deferred) {
    var loader = declaredRegisterLoader();
    await loader.import('no-imports.js');
    deferred.resolve();
  }
});

var allModules = [
  'no-imports.js',
  'es6-withdep.js',
  'direct.js',
  'es6-file.js',
  'import.js',
  'moduleName.js',
  'circular1.js',
  'circular2.js',
  'even.js',
  'a.js',
  'c.js',
  's.js',
  '_a.js',
  '_e.js',
  '_f.js',
  '_h.js',
  'export.js',
  'export-default.js',
  'reexport1.js',
  'reexport-binding.js',
  'rebinding.js',
  'reexport2.js',
  'export-star.js',
  'export-star2.js'
];

/*suite.add('Importing multiple trees at the same time with SystemJS', {
  defer: true,
  fn: async function(deferred) {
    var loader = declaredSystemJSLoader();
    await Promise.all(allModules.map(m => loader.import(m)));
    deferred.resolve();
  }
});

suite.add('Importing a deep tree of modules with SystemJS', {
  defer: true,
  fn: async function(deferred) {
    var loader = declaredSystemJSLoader();
    await loader.import('_a.js');
    deferred.resolve();
  }
});

suite.add('Importing a module with deps with SystemJS', {
  defer: true,
  fn: async function(deferred) {
    var loader = declaredSystemJSLoader();
    await loader.import('es6-withdep.js');
    deferred.resolve();
  }
});

suite.add('Importing a single registered module with SystemJS', {
  defer: true,
  fn: async function(deferred) {
    var loader = declaredSystemJSLoader();
    await loader.import('no-imports.js');
    deferred.resolve();
  }
});*/
