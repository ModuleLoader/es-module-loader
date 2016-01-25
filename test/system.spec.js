//

describe('System', function () {

  describe('prerequisite', function () {

    it('should be a instance of Loader', function () {
      expect(System).to.be.a(Reflect.Loader);
    });

  });

  describe('#import', function () {

    describe('an ES5 script', function () {

      it('should import a ES5 script', function (done) {
        System.import(base + 'test/syntax/script.js')
        .then(function (m) {
          expect(!!m).to.be.ok();
        })
        .then(done, done);
      });

      it('should import a ES5 script once loaded', function (done) {
        System.import(base + 'test/syntax/script.js')
        .then(function () {
          return System.import(base + 'test/syntax/script.js').
            then(function (m) {
              expect(!!m).to.be.ok();
            });
        })
        .then(done, done);
      });

    });

    describe('an ES6 script', function () {

      it('should import an ES6 script', function (done) {
        System.import(base + 'test/syntax/es6.js')
        .then(function (m) {
          expect(m.p).to.equal('p');
        })
        .then(done, done);
      });

      it('should import an ES6 script with its dependencies', function (done) {
        System.import(base + 'test/syntax/es6-withdep.js')
        .then(function (m) {
          expect(m.p).to.equal('p');
        })
        .then(done, done);
      });

      (ie ? it.skip : it)('should import an ES6 script with a generator', function (done) {
        System.import(base + 'test/syntax/es6-generator.js')
        .then(function (m) {
          expect(!!m.generator).to.be.ok();
        })
        .then(done, done);
      });

      it('should import without bindings', function (done) {
        System.import(base + 'test/syntax/direct.js')
        .then(function (m) {
          expect(!!m).to.be.ok();
        })
        .then(done, done);
      });

      it('should support es6 various syntax', function (done) {
        System.import(base + 'test/syntax/es6-file.js')
        .then(function (m) {

          expect(m.q).to.be.a('function');

          expect(function () { (new m.q()).foo(); })
            .to.throwException(function (e) {
              expect(e).to.equal('g');
            });

        })
        .then(done, done);
      });

    });

    describe('with circular dependencies', function () {

      (System.transpiler == 'traceur' ? it : it.skip)('should resolve circular dependencies', function (done) {
        System.import(base + 'test/syntax/circular1.js')
        .then(function (m1) {
          return System.import(base + 'test/syntax/circular2.js').then(function (m2) {
            expect(m1.variable1).to.equal('test circular 1');
            expect(m2.variable2).to.equal('test circular 2');

            expect(m2.output, 'The module 2 output is the module 1 variable')
              .to.equal('test circular 1');
            expect(m1.output, 'The module 1 output is the module 2 variable')
              .to.equal('test circular 2');
            expect(m2.output1, 'The module 2 output1 is the module 1 output')
              .to.equal('test circular 2');
            expect(m1.output2, 'The module 1 output2 is the module 2 output')
              .to.equal('test circular 1');
          });
        })
        .then(done, done);
      });


      it('should update circular dependencies', function (done) {
        System.import(base + 'test/syntax/even.js')
        .then(function (m) {
          expect(m.counter, 'Counter initially at 1').to.be.equal(1);
          expect(m.even(10), 'Must be an even number').to.be.ok();
          expect(m.counter, 'Counter sould now be at 7').to.be.equal(7);
          expect(m.even(15), 'Must be an odd number').to.not.be.ok();
          expect(m.counter, 'Counter sould now be at 15').to.be.equal(15);
        })
        .then(done, done);
      });

    });

    describe('loading order', function () {

      function expectedOrder(file, order, done) {
        System.import(base + 'test/loads/' + file)
        .then(function (m) {
          order.forEach(function (letter) {
            expect(m[letter], 'The "' + letter + '" file wasn\'t loaded')
              .to.equal(letter);
          });

        })
        .then(done, done);
      }

      it('should load in order (a)', function (done) {
        expectedOrder('a.js', ['a', 'b'], done)
      });

      it('should load in order (c)', function (done) {
        expectedOrder('c.js', ['c', 'a', 'b'], done)
      });

      it('should load in order (s)', function (done) {
        expectedOrder('s.js', ['s', 'c', 'a', 'b'], done)
      });

      it('should load in order (_a)', function (done) {
        expectedOrder('_a.js', ['b', 'd', 'g', 'a'], done)
      });

      it('should load in order (_e)', function (done) {
        expectedOrder('_e.js', ['c', 'e'], done)
      });

      it('should load in order (_f)', function (done) {
        expectedOrder('_f.js', ['g', 'f'], done)
      });

      it('should load in order (_h)', function (done) {
        expectedOrder('_h.js', ['i', 'a', 'h'], done)
      });

    });


    describe('errors', function () {

      function supposedToFail() {
        expect(false, 'should not be successful').to.be.ok();
      }

      it('should throw if on syntax error', function (done) {
        System.import(base + 'test/loads/main.js')
        .then(supposedToFail)
        .catch(function(e) {
          expect(e)
            .to.be.equal('dep error\n\tError evaluating ' + base + 'test/loads/deperror.js\n\tError evaluating ' + base + 'test/loads/main.js');
        })
        .then(done, done);
      });

      it('should throw what the script throws', function (done) {
        System.import(base + 'test/loads/deperror.js')
        .then(supposedToFail)
        .catch(function(e) {
          expect(e)
            .to.be.equal('dep error\n\tError evaluating ' + base + 'test/loads/deperror.js');
        })
        .then(done, done);
      });


      it('404 error', function (done) {
        System.import(base + 'test/loads/load-non-existent.js')
        .then(supposedToFail)
        .catch(function (e) {
          var b = typeof window == 'undefined' ? base.substr(7) : base;
          var e;
          if (typeof window == 'undefined') {
            e = e.toString().substr(14);
            if (e.substr(26, 1) == ',')
              e = e.substr(27);
          }
          expect(e.toString())
            .to.be.equal((typeof window == 'undefined' ? ' open \'' : 'Error: GET ') + b + 'test/loads/non-existent.js' + (typeof window == 'undefined' ? '\'' : ' 404 (Not Found)') + '\n\tFetching ' + base + 'test/loads/non-existent.js\n\tLoading ' + base + 'test/loads/load-non-existent.js');
        })
        .then(done, done);
      });

    });

    describe('es6 export syntax overview', function () {
      it('should resolve different export syntax', function (done) {
        System.import(base + 'test/syntax/export.js')
        .then(function (m) {
          expect(m.p, 'should export a number').to.be.equal(5);
          expect(m.foo, 'should export a function').to.be.a('function');
          expect(m.q, 'should export an object').to.be.an('object');
          expect(m.default, 'should export a default function')
            .to.be.a('function');
          expect(m.s, 'should export a set of variable').to.be.equal(4);
          expect(m.t, 'should export a specifier number').to.be.equal(4);
          expect(m.m, 'should export a specifier object ').to.be.an('object');
        })
        .then(done, done);
      });
    });

    describe('es6 export default syntax', function () {
      it('should resolve "export default"', function (done) {
        System.import(base + 'test/syntax/export-default.js')
        .then(function (m) {
          expect(m.default()).to.be.equal('test');
        })
        .then(done, done);
      });
    });

    describe('es6 export re-exporting', function () {
      it('should support simple re-exporting', function (done) {
        System.import(base + 'test/syntax/reexport1.js')
        .then(function (m) {
          expect(m.p, 'should export 5 from the "./export"').to.be.equal(5);
        })
        .then(done, done);
      });

      it('should support re-exporting binding', function (done) {
        System.import(base + 'test/syntax/reexport-binding.js')
        .then(function () {
          return System.import(base + 'test/syntax/rebinding.js').then(function (m) {
            expect(m.p, 'should export "p" from the "./rebinding"')
              .to.be.equal(4);
          });
        })
        .then(done, done);
      });

      it('should support re-exporting with a new name', function (done) {
        System.import(base + 'test/syntax/reexport2.js')
        .then(function (m) {
          expect(m.q, 'should export "t" as "q" from the "./export"')
            .to.be.equal(4);
          expect(m.z, 'should export "q" as "z" from the "./export"')
            .to.be.equal(5);
        })
        .then(done, done);
      });

      it('should support re-exporting', function (done) {
        System.import(base + 'test/syntax/export-star.js')
        .then(function (m) {
          expect(m.foo, 'should export a function').to.be.equal('foo');
          expect(m.bar, 'should re-export export-star bar variable')
            .to.be.equal('bar');
        })
        .then(done, done);
      });

      (System.transpiler != 'traceur' ? it.skip : it)('should support re-exporting overwriting', function (done) {
        System.import(base + 'test/syntax/export-star2.js')
        .then(function (m) {
          expect(m.bar, 'should re-export "./export-star" bar variable')
            .to.be.equal('bar');
          expect(m.foo, 'should overwrite "./star-dep" foo variable with a function')
            .to.be.a('function');
        })
        .then(done, done);
      });
    });

    //

    describe('es6 import syntax overview', function () {
      it('should resolve different import syntax', function (done) {
        System.import(base + 'test/syntax/import.js')
        .then(function (m) {
          expect(m.a, 'should export "d" as "a" from the "./export"')
            .to.be.a('function');
          expect(m.b, 'should export "p" as "b" for "s" as "p" from "./reexport1"')
            .to.be.equal(4);
          expect(m.c, 'should export "z" as "c" with "z" from "./reexport2"')
            .to.be.equal(5);
          expect(m.d, 'should export "r" as "d" for "q" as "r" from the "./reexport2"')
            .to.be.equal(4);
          expect(m.q, 'should export "q" as "*" from the "./reexport1"')
            .to.be.an('object');
          expect(m.q.foo, 'should access the "foo" function of "./reexport1" through "q" ad "*" ')
            .to.be.a('function');
        })
        .then(done, done);
      });
    });

    //

    describe('a script with metas', function () {
      // NB module name meta
      it.skip('should support module name meta', function (done) {
        System.import(base + 'test/loader/moduleName.js')
        .then(function (m) {
          expect(m.name).to.be.equal('test/loader/moduleName');
          expect(m.address)
            .to.be.equal(System.baseURL + 'test/loader/moduleName.js');
        })
        .then(done, done);
      });
    });

  });
  
  describe('#System.provide', function () {

    it('System.provide source', function(done) {
      var oldResolve = System.hook('resolve');
      System.hook('resolve', function(url) {
        if (url == 'slave') {
          return new Promise(function(resolve, reject) {
            System.provide('slave', 'fetch', 'export var p = 5;');
            setTimeout(function() {
              resolve('slave');
            }, 1);
          });
        }
        return oldResolve.apply(this, arguments);
      });

      System.import(base + 'test/loader/master.js').then(function(m) {
        expect(m.p).to.be.equal(5);
      }).then(reset, reset);

      function reset() {
        done.apply(this, arguments);
        System.hook('resolve', oldResolve);
      }
    });

  });

  describe('get Loader.prototype.registry', function () {
      it('returns the registry object', function () {
          expect(System.registry).to.be.an('object');
      });

      describeIf(typeof window != 'undefined' && !!window.strictCorrectness, 'strict correctness', function () {
        it('throws with an invalid registry', function () {
          var oldRegistry = System.registry;
          System._loader.newRegistry = 'invalid registry';
          expect(function() {
            return System.registry;
          }).to.throwException(function(ex) {
              expect(ex).to.be.a(TypeError);
          });

          System._loader.newRegistry = oldRegistry;
        });
      });
  });

  describeIf(
    typeof window != 'undefined' && window.Worker && !ie,
    'with Web Worker', function () {
      it('should loading inside of a Web Worker', function (done) {
        var worker = new Worker(base + 'test/worker/worker-' + System.transpiler + '.js');
        worker.onmessage = function (e) {
          expect(e.data).to.be.equal('p');
          done();
        };
      });
    });

  describeIf(
    typeof window != 'undefined',
    'with script type "module"', function () {
      it('should load the module on the document "load" event', function (done) {
        setTimeout(function(){ // wait for script processing first
          expect(window.anon).to.be.a('function');
          done();
        }, 0);
      });

    });
});
