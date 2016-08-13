import assert from 'assert';
import path from 'path';
import SystemRegisterLoader from './fixtures/system-register-loader.js';
import { pathToFileUrl, fileUrlToPath } from '../core/common.js';

describe('System Register Loader', function() {
  var loader = new SystemRegisterLoader(path.resolve('test/fixtures/register-modules') + path.sep);

  describe('Simple tests', function() {

    it('Should be an instance of itself', function() {
      assert(loader instanceof SystemRegisterLoader);
    });

    it('Should import a module', async function() {
      var m = await loader.import('./no-imports.js');
      assert(m);
      assert.equal(m.asdf, 'asdf');
    });

    it('Should import a module cached', async function() {
      var m1 = await loader.import('./no-imports.js');
      var m2 = await loader.import('./no-imports.js');
      assert.equal(m1.asdf, 'asdf');
      assert.equal(m1, m2);
    });

    it('should import an es module with its dependencies', async function() {
      var m = await loader.import('./es6-withdep.js');
      assert.equal(m.p, 'p');
    });

    it('should import without bindings', async function() {
      var m = await loader.import('./direct.js');
      assert(!!m);
    });

    it('should support various es syntax', async function() {
      var m = await loader.import('./es6-file.js');

      assert.equal(typeof m.q, 'function');

      var thrown = false;
      try {
        new m.q().foo();
      }
      catch(e) {
        thrown = true;
        assert.equal(e, 'g');
      }

      if (!thrown)
        throw new Error('Supposed to throw');
    });

    it('should resolve various import syntax', async function() {
      var m = await loader.import('./import.js');
      assert.equal(typeof m.a, 'function');
      assert.equal(m.b, 4);
      assert.equal(m.c, 5);
      assert.equal(m.d, 4);
      assert.equal(typeof m.q, 'object');
      assert.equal(typeof m.q.foo, 'function');
    });

    it('should support __moduleName', async function() {
      var m = await loader.import('./moduleName.js');
      assert.equal(m.name, pathToFileUrl(path.resolve('test/fixtures/register-modules/moduleName.js')));
    });
  });

  describe('Circular dependencies', function() {


    it('should resolve circular dependencies', async function() {
      var m1 = await loader.import('./circular1.js');
      var m2 = await loader.import('./circular2.js');


      assert.equal(m1.variable1, 'test circular 1');
      assert.equal(m2.variable2, 'test circular 2');

      assert.equal(m2.output, 'test circular 1');
      assert.equal(m1.output, 'test circular 2');
      assert.equal(m2.output1, 'test circular 2');
      assert.equal(m1.output2, 'test circular 1');
    });

    // pending https://github.com/babel/babel/pull/3650
    it.skip('should update circular dependencies', async function() {
      var m = await loader.import('./even.js');
      assert.equal(m.counter, 1);
      assert(m.even(10));
      assert.equal(m.counter, 7);
      assert(!m.even(15));
      assert.equal(m.counter, 15);
    });

  });

  describe('Loading order', function() {
    async function assertLoadOrder(module, exports) {
      var m = await loader.import('./' + module);
      exports.forEach(function(name) {
        assert.equal(m[name], name);
      });
    }

    it('should load in order (a)', async function() {
      await assertLoadOrder('a.js', ['a', 'b']);
    });

    it('should load in order (c)', async function() {
      await assertLoadOrder('c.js', ['c', 'a', 'b']);
    });

    it('should load in order (s)', async function() {
      await assertLoadOrder('s.js', ['s', 'c', 'a', 'b']);
    });

    it('should load in order (_a)', async function() {
      await assertLoadOrder('_a.js', ['b', 'd', 'g', 'a']);
    });

    it('should load in order (_e)', async function() {
      await assertLoadOrder('_e.js', ['c', 'e']);
    });

    it('should load in order (_f)', async function() {
      await assertLoadOrder('_f.js', ['g', 'f']);
    });

    it('should load in order (_h)', async function() {
      await assertLoadOrder('_h.js', ['i', 'a', 'h']);
    });
  });

  describe('Export variations', function () {
    it('should resolve different export syntax', async function() {
      var m = await loader.import('./export.js');
      assert.equal(m.p, 5);
      assert.equal(typeof m.foo, 'function');
      assert.equal(typeof m.q, 'object');
      assert.equal(typeof m.default, 'function');
      assert.equal(m.s, 4);
      assert.equal(m.t, 4);
      assert.equal(typeof m.m, 'object');
    });

    it('should resolve "export default"', async function() {
      var m = await loader.import('./export-default.js');
      assert.equal(m.default(), 'test');
    });

    it('should support simple re-exporting', async function() {
      var m = await loader.import('./reexport1.js');
      assert.equal(m.p, 5);
    });

    it('should support re-exporting binding', async function() {
      await loader.import('./reexport-binding.js');
      var m = await loader.import('./rebinding.js');
      assert.equal(m.p, 4);
    });

    it('should support re-exporting with a new name', async function() {
      var m = await loader.import('./reexport2.js');
      assert.equal(m.q, 4);
      assert.equal(m.z, 5);
    });

    it('should support re-exporting', async function() {
      var m = await loader.import('./export-star.js');
      assert.equal(m.foo, 'foo');
      assert.equal(m.bar, 'bar');
    });

    it.skip('should support re-exporting overwriting', async function() {
      var m = await loader.import('./export-star2.js');
      assert.equal(m.bar, 'bar');
      assert.equal(typeof m.foo, 'function');
    });
  });

  describe('Errors', function () {

    var testPath = fileUrlToPath(loader.key);

    async function getImportError(module) {
      try {
        await loader.import(module);
      }
      catch(e) {
        return e.toString();
      }
      throw new Error('Test supposed to fail');
    }

    it('should throw if on syntax error', async function() {
      var err = await getImportError('./main.js');
      assert.equal(err, 'Error: dep error\n\tEvaluating ' + testPath + 'deperror.js\n\tEvaluating ' + testPath + 'main.js\n\tLoading ./main.js');
    });

    it('should throw what the script throws', async function() {
      var err = await getImportError('./deperror.js');
      assert.equal(err, 'Error: dep error\n\tEvaluating ' + testPath + 'deperror.js\n\tLoading ./deperror.js');
    });

    it('404 error', async function() {
      var err = await getImportError('./load-non-existent.js');
      var lines = err.split('\n\t');
      assert(lines[0].startsWith('Error: '));
      assert(lines[0].endsWith('open \'' + testPath + 'non-existent.js\''));
      assert.equal(lines[1], 'Instantiating ' + testPath + 'non-existent.js');
      assert.equal(lines[2], 'Loading ' + testPath + 'load-non-existent.js');
      assert.equal(lines[3], 'Loading ./load-non-existent.js');
    });

  });

});