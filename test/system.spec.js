//

// Change base url to the karma "base"
System.trace = true;
System.baseURL += 'base/';

//

describe('System', function() {

  var originBaseUrl = System.baseURL;

  afterEach(function() {
    System.baseURL = originBaseUrl;
  });

  it('should be a instance of Loader', function() {
    expect(System).to.be.an.instanceof(Reflect.Loader);
  });

  describe('#normalize', function() {

    var refererName = 'dir/file';

    function normalizeWrapper() {
      return System.normalize.bind.apply(System.normalize, [null].concat(Array.prototype.slice.call(arguments)));
    }

    //

    beforeEach(function() {
      System.baseURL = 'http://example.org/a/b.html';
    });

    // no arguments

    it('should throw with no specified name', function() {
      expect(normalizeWrapper()).to.throw(TypeError, /Module name must be a string/);
    });

    // one argument

    it('should not referer', function() {
      expect(System.normalize('d/e/f')).to.equal('d/e/f');
    });

    it('should be backwards compat', function() {
      expect(System.normalize('./a.js')).to.equal('a.js');
    });

    // wrong one argument

    it('should throw with an url as name', function() {
      expect(normalizeWrapper('http://example.org/a/b.html')).to.throw(TypeError, /Illegal module name "\S+"/);
    });

    it('should throw with embedded path', function() {
      [
        'a/b/../c',
        'a/../c'
      ].forEach(function(dummyPath) {
          expect(normalizeWrapper(dummyPath)).to.throw(TypeError, /Illegal module name "\S+"/);
        });
    });

    // two arguments

    it('should support relative path', function() {
      expect(System.normalize('./d/e/f', refererName)).to.equal('dir/d/e/f');
      expect(System.normalize('../e/f', refererName)).to.equal('e/f');
    });

    it('should resolve the path with relative parent', function() {
      expect(System.normalize('./a/b', 'c')).to.equal('a/b');
      expect(System.normalize('./a/b', 'c/d')).to.equal('c/a/b');
      expect(System.normalize('./a/b', '../c/d')).to.equal('../c/a/b');
      expect(System.normalize('./a/b', '../../c/d')).to.equal('../../c/a/b');
    });

  });

  describe('#locate', function() {

    beforeEach(function() {
      System.baseURL = 'http://example.org/a/';
    });
    it('should be a instance of Loader', function() {
      expect(System).to.be.an.instanceof(Reflect.Loader);
    });

    //

    it('should resolve paths', function() {
      expect(System.locate({name: '@abc/def'})).to.equal('http://example.org/a/@abc/def.js');
      expect(System.locate({name: ' abc/def'})).to.equal('http://example.org/a/abc/def.js');
    });

    it('should resolve paths with the existing config', function() {
      System.paths['path/*'] = '/test/*.js';
      expect(System.locate({name: 'path/test'})).to.equal('http://example.org/test/test.js');
    });

  });

  describe('#import', function() {

    it('should import a script', function(done) {
      System.import('test/syntax/script').then(function() {
        System.import('test/syntax/script').then(function(m) {
          setTimeout(function() {
            expect(!!m).to.be.true();
            done();
          }, 0);
        }, done);
      }, done);
    });

    it('should import an ES6 script', function(done) {
      System.import('test/syntax/es6').then(function(m) {
        setTimeout(function() {
          expect(m.p).to.equal('p');
          done();
        }, 0);
      }, done);
    });

    it('should import an ES6 script with its dependencies', function(done) {
      System.import('test/syntax/es6-withdep').then(function(m) {
        setTimeout(function() {
          expect(m.p).to.equal('p');
          done();
        }, 0);
      }, done);
    });

    it('should import an ES6 script with a generator', function(done) {
      System.import('test/syntax/es6-generator').then(function(m) {
        setTimeout(function() {
          expect(!!m.generator).to.be.true();
          done();
        }, 0);
      }, done);
    });

    it('should import without bindings', function(done) {
      System.import('test/syntax/direct').then(function(m) {
        setTimeout(function() {
          expect(!!m).to.be.true();
          done();
        }, 0);
      }, done);
    });

    it('should direct import without bindings', function(done) {
      System.import('test/syntax/direct').then(function(m) {
        setTimeout(function() {
          expect(!!m).to.be.true();
          done();
        }, 0);
      }, done);
    });

    it('should resolve circular dependencies', function(done) {
      System.import('test/syntax/circular1').then(function(m1) {
        System.import('test/syntax/circular2').then(function(m2) {
          setTimeout(function() {
            expect(m1.variable1).to.equal('test circular 1');
            expect(m2.variable2).to.equal('test circular 2');

            expect(m2.output, 'The module 2 output is the module 1 variable').to.equal('test circular 1');
            expect(m1.output, 'The module 1 output is the module 2 variable').to.equal('test circular 2');
            expect(m2.output1, 'The module 2 output1 is the module 1 output').to.equal('test circular 2');
            expect(m1.output2, 'The module 1 output2 is the module 2 output').to.equal('test circular 1');
            done();
          }, 0);
        }, done);
      }, done);
    });

    it('should update circular dependencies', function(done) {
      System.import('test/syntax/even').then(function(m) {
        setTimeout(function() {
          expect(m.counter, 'Counter initially at 1').to.be.equal(1);
          expect(m.even(10), 'Must be an even number').to.be.true();
          expect(m.counter, 'Counter sould now be at 7').to.be.equal(7);
          expect(m.even(15), 'Must be an odd number').to.be.false();
          expect(m.counter, 'Counter sould now be at 15').to.be.equal(15);
          done();
        }, 0);
      }, done);
    });

    //

    describe('loading order', function() {

      function expectedOrder(file, order, done) {
        System.import('test/loads/' + file).then(function(m) {
          setTimeout(function() {

            order.forEach(function(letter) {
              expect(m[letter], 'The "' + letter + '" file wasn\'t loaded').to.equal(letter);
            });

            done();
          }, 0);
        }, done);
      }

      it('should load in order (a)', function(done) {
        expectedOrder('a', ['a', 'b'], done)
      });

      it('should load in order (c)', function(done) {
        expectedOrder('c', ['c', 'a', 'b'], done)
      });

      it('should load in order (s)', function(done) {
        expectedOrder('s', ['s', 'c', 'a', 'b'], done)
      });

      it('should load in order (_a)', function(done) {
        expectedOrder('_a', ['b', 'd', 'g', 'a'], done)
      });

      it('should load in order (_e)', function(done) {
        expectedOrder('_e', ['c', 'e'], done)
      });

      it('should load in order (_f)', function(done) {
        expectedOrder('_f', ['g', 'f'], done)
      });

      it('should load in order (_h)', function(done) {
        expectedOrder('_h', ['i', 'a', 'h'], done)
      });

    });

    //

    describe('errors', function() {

      it('should direct import without bindings', function(done) {
        System.import('test/loads/main').then(function() {
          setTimeout(function() {
            expect(false, 'should not be successful').to.be.true();
            done();
          }, 0);
        }, function(e) {
          setTimeout(function() {
            expect(e).to.be.equal('Error evaluating test/loads/deperror\ndep error');
            done();
          }, 0);
        });
      });


      it('Unhandled rejection test', function(done) {
        function dummyLoad(cb) {
          System.import('test/loads/load-non-existet')
            .catch(function(e) {
              setTimeout(function() {
                cb(e);
              });
            })
          ;
        }

        dummyLoad(function(e) {
          expect(e).to.be.match(/Error loading "\S+" at \S+\nNot Found: \S+/);
          done();
        });

      });

    });

    //

    it('should resolve "export default"', function(done) {
      System.import('test/syntax/export-default').then(function(m) {
        setTimeout(function() {
          expect(m.default()).to.be.equal('test');
          done();
        });
      }, done);
    });

    it('should resolve different export syntax', function(done) {
      System.import('test/syntax/export').then(function(m) {
        setTimeout(function() {
          expect(m.p, 'should export a number').to.be.equal(5);
          expect(m.foo, 'should export a function').to.be.a('function');
          expect(m.q, 'should export an object').to.be.an('object');
          expect(m.default, 'should export a default function').to.be.a('function');
          expect(m.s, 'should export a set of variable').to.be.equal(4);
          expect(m.t, 'should export a specifier number').to.be.equal(4);
          expect(m.m, 'should export a specifier object ').to.be.an('object');
          done();
        });
      }, done);
    });

    it('should support simple re-exporting', function(done) {
      System.import('test/syntax/reexport1').then(function(m) {
        setTimeout(function() {
          expect(m.p, 'should export 5 from the "./export"').to.be.equal(5);
          done();
        });
      }, done);
    });

    it('should support re-exporting binding', function(done) {
      System.import('test/syntax/reexport-binding').then(function() {
        System.import('test/syntax/rebinding').then(function(m) {
          setTimeout(function() {
            expect(m.p, 'should export "p" from the "./rebinding"').to.be.equal(4);
            done();
          });
        }, done);
      }, done);
    });

    it('should support re-exporting with a new name', function(done) {
      System.import('test/syntax/reexport2').then(function(m) {
        setTimeout(function() {
          expect(m.q, 'should export "t" as "q" from the "./export"').to.be.equal(4);
          expect(m.z, 'should export "q" as "z" from the "./export"').to.be.equal(5);
          done();
        });
      }, done);
    });

    it('should support re-exporting', function(done) {
      System.import('test/syntax/export-star').then(function(m) {
        setTimeout(function() {
          expect(m.foo, 'should export a function').to.be.equal('foo');
          expect(m.bar, 'should re-export export-star bar variable').to.be.equal('bar');
          done();
        });
      }, done);
    });

    it('should support re-exporting overwriting', function(done) {
      System.import('test/syntax/export-star2').then(function(m) {
        setTimeout(function() {
          expect(m.bar, 'should re-export "./export-star" bar variable').to.be.equal('bar');
          expect(m.foo, 'should overwrite "./star-dep" foo variable with a function').to.be.a('function');
          done();
        });
      }, done);
    });

    //

    it('should resolve different import syntax', function(done) {
      System.import('test/syntax/import').then(function(m) {
        setTimeout(function() {
          expect(m.a, 'should export "d" as "a" from the "./export"').to.be.a('function');
          expect(m.b, 'should export "p" as "b" for "s" as "p" from "./reexport1"').to.be.equal(4);
          expect(m.c, 'should export "z" as "c" with "z" from "./reexport2"').to.be.equal(5);
          expect(m.d, 'should export "r" as "d" for "q" as "r" from the "./reexport2"').to.be.equal(4);
          expect(m.q, 'should export "q" as "*" from the "./reexport1"').to.be.an('object');
          expect(m.q.foo, 'should access the "foo" function of "./reexport1" through "q" ad "*" ').to.be.a('function');
          done();
        });
      }, done);
    });

    //

    it('should support es6 various syntax', function(done) {
      System.import('test/syntax/es6-file').then(function(m) {
        setTimeout(function() {

          expect(m.q).to.be.a('function');
          expect((new m.q()).foo).to.throw('g');

          done();
        });
      }, done);
    });

    //

    it('should support module name meta', function(done) {
      System.import('test/loader/moduleName').then(function(m) {
        setTimeout(function() {

          expect(m.name).to.be.equal('test/loader/moduleName');
          expect(m.address).to.be.equal(System.baseURL + 'test/loader/moduleName.js');

          done();
        });
      }, done);
    });


  });

  describe('#paths', function() {

    it('should support custom paths', function(done) {
      System.paths['bar'] = 'test/loader/custom-path.js';
      System.import('bar').then(function(m) {
        setTimeout(function() {
          expect(m.bar).to.be.equal('bar');
          delete System.paths['bar'];
          done();
        }, 0);
      }, done)
    });


    it('should support path wildcard', function(done) {
      System.paths['bar/*'] = 'test/loader/custom-folder/*.js';
      System.import('bar/path').then(function(m) {
        setTimeout(function() {
          expect(m.bar).to.be.equal('baa');
          delete System.paths['bar/*'];
          done();
        }, 0);
      }, done)
    });

    it('should support most specific paths', function(done) {
      System.paths['bar/bar'] = 'test/loader/specific-path.js';
      System.paths['bar/*'] = 'test/loader/custom-folder/*.js';
      System.import('bar/bar').then(function(m) {
        setTimeout(function() {
          expect(m.path).to.be.true();
          delete System.paths['bar/bar'];
          delete System.paths['bar/*'];
          done();
        }, 0);
      }, done)
    });

  });

  if (window.Worker) {
    it('should loading inside of a Web Worker', function(done) {
      var worker = new Worker(System.baseURL + 'test/worker/worker.js');

      worker.onmessage = function(e) {
        setTimeout(function() {
          expect(e.data).to.be.equal('p');
          done();
        }, 0);
      };
    });
  }
});
