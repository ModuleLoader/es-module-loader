import assert from 'assert';
import path from 'path';
import Module from 'module';
import SystemRegisterLoader from './fixtures/system-register-loader.js';
import { pathToFileUrl, fileUrlToPath } from '../core/common.js';

describe('System Register Loader', function() {
  var loader = new SystemRegisterLoader(path.resolve('test/fixtures') + path.sep);

  describe('Simple tests', function() {

    it('Should be an instance of itself', function() {
      assert(loader instanceof SystemRegisterLoader);
    });

    it('Should import a module', async function () {
      var m = await loader.import('./register-modules/no-imports.js');
      assert(m);
      assert.equal(m.asdf, 'asdf');
    });

    it('Should import a module cached', async function () {
      var m1 = await loader.import('./register-modules/no-imports.js');
      var m2 = await loader.import('./register-modules/no-imports.js');
      assert.equal(m1.asdf, 'asdf');
      assert.equal(m1, m2);
    });

    it('should import an es module with its dependencies', async function () {
      var m = await loader.import('./register-modules/es6-withdep.js');
      assert.equal(m.p, 'p');
    });

    it('should import without bindings', async function () {
      var m = await loader.import('./register-modules/direct.js');
      assert(!!m);
    });

    it('should support various es syntax', async function () {
      var m = await loader.import('./register-modules/es6-file.js');

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

    it('should resolve various import syntax', async function () {
      var m = await loader.import('./register-modules/import.js');
      assert.equal(typeof m.a, 'function');
      assert.equal(m.b, 4);
      assert.equal(m.c, 5);
      assert.equal(m.d, 4);
      assert.equal(typeof m.q, 'object');
      assert.equal(typeof m.q.foo, 'function');
    });

    it('should support __moduleName', async function () {
      var m = await loader.import('./register-modules/moduleName.js');
      assert.equal(m.name, pathToFileUrl(path.resolve('test/fixtures/register-modules/moduleName.js')));
    });
  });

  describe('Circular dependencies', function() {


    it('should resolve circular dependencies', async function () {
      var m1 = await loader.import('./register-modules/circular1.js');
      var m2 = await loader.import('./register-modules/circular2.js');

      assert.equal(m1.variable1, 'test circular 1');
      assert.equal(m2.variable2, 'test circular 2');

      assert.equal(m2.output, 'test circular 1');
      assert.equal(m1.output, 'test circular 2');
      assert.equal(m2.output1, 'test circular 2');
      assert.equal(m1.output2, 'test circular 1');

      assert.equal(m1.output1, 'test circular 2');
      assert.equal(m2.output2, 'test circular 1');
    });

    it('should update circular dependencies', async function () {
      var m = await loader.import('./register-modules/even.js');
      assert.equal(m.counter, 1);
      assert(m.even(10));
      assert.equal(m.counter, 7);
      assert(!m.even(15));
      assert.equal(m.counter, 15);
    });

  });

  describe('Loading order', function() {
    async function assertLoadOrder(module, exports) {
      var m = await loader.import('./register-modules/' + module);
      exports.forEach(function(name) {
        assert.equal(m[name], name);
      });
    }

    it('should load in order (a)', async function () {
      await assertLoadOrder('a.js', ['a', 'b']);
    });

    it('should load in order (c)', async function () {
      await assertLoadOrder('c.js', ['c', 'a', 'b']);
    });

    it('should load in order (s)', async function () {
      await assertLoadOrder('s.js', ['s', 'c', 'a', 'b']);
    });

    it('should load in order (_a)', async function () {
      await assertLoadOrder('_a.js', ['b', 'd', 'g', 'a']);
    });

    it('should load in order (_e)', async function () {
      await assertLoadOrder('_e.js', ['c', 'e']);
    });

    it('should load in order (_f)', async function () {
      await assertLoadOrder('_f.js', ['g', 'f']);
    });

    it('should load in order (_h)', async function () {
      await assertLoadOrder('_h.js', ['i', 'a', 'h']);
    });
  });

  describe('Export variations', function () {
    it('should resolve different export syntax', async function () {
      var m = await loader.import('./register-modules/export.js');
      assert.equal(m.p, 5);
      assert.equal(typeof m.foo, 'function');
      assert.equal(typeof m.q, 'object');
      assert.equal(typeof m.default, 'function');
      assert.equal(m.s, 4);
      assert.equal(m.t, 4);
      assert.equal(typeof m.m, 'object');
    });

    it('should resolve "export default"', async function () {
      var m = await loader.import('./register-modules/export-default.js');
      assert.equal(m.default(), 'test');
    });

    it('should support simple re-exporting', async function () {
      var m = await loader.import('./register-modules/reexport1.js');
      assert.equal(m.p, 5);
    });

    it('should support re-exporting binding', async function () {
      await loader.import('./register-modules/reexport-binding.js');
      var m = await loader.import('./register-modules/rebinding.js');
      assert.equal(m.p, 4);
    });

    it('should support re-exporting with a new name', async function () {
      var m = await loader.import('./register-modules/reexport2.js');
      assert.equal(m.q, 4);
      assert.equal(m.z, 5);
    });

    it('should support re-exporting', async function () {
      var m = await loader.import('./register-modules/export-star.js');
      assert.equal(m.foo, 'foo');
      assert.equal(m.bar, 'bar');
    });

    it.skip('should support re-exporting overwriting', async function () {
      var m = await loader.import('./register-modules/export-star2.js');
      assert.equal(m.bar, 'bar');
      assert.equal(typeof m.foo, 'function');
    });
  });

  describe('Errors', function () {

    var testPath = fileUrlToPath(loader.baseKey) + 'register-modules/';

    async function getImportError(module) {
      try {
        await loader.import(module);
      }
      catch(e) {
        return e.toString();
      }
      throw new Error('Test supposed to fail');
    }

    it('should give a plain name error', async function () {
      var err = await getImportError('plain-name');
      assert.equal(err, 'Error: No resolution found.\n  Resolving plain-name\n  Loading plain-name');
    });

    it('should throw if on syntax error', async function () {
      var err = await getImportError('./register-modules/main.js');
      assert.equal(err, 'Error: dep error\n  Evaluating ' + testPath + 'deperror.js\n  Evaluating ' + testPath + 'main.js\n  Loading ./register-modules/main.js');
    });

    it('should throw what the script throws', async function () {
      var err = await getImportError('./register-modules/deperror.js');
      assert.equal(err, 'Error: dep error\n  Evaluating ' + testPath + 'deperror.js\n  Loading ./register-modules/deperror.js');
    });

    it('404 error', async function () {
      var err = await getImportError('./register-modules/load-non-existent.js');
      var lines = err.split('\n  ');
      assert(lines[0].startsWith('Error: '));
      assert(lines[0].endsWith('open \'' + testPath.replace(/\//g, path.sep) + 'non-existent.js\''));
      assert.equal(lines[1], 'Instantiating ' + testPath + 'non-existent.js');
      assert.equal(lines[2], 'Loading ' + testPath + 'load-non-existent.js');
      assert.equal(lines[3], 'Loading ./register-modules/load-non-existent.js');
    });

  });

  describe('Register dynamic', function () {
    it('should load a System.registerDynamic module', async function () {
      var m = await loader.import('./dynamic-modules/basic-exports.js');
      assert.equal(m.default(), 'ok');
      assert.equal(m.default.named, 'name!');
    });

    it('should load mixed bundles of register and registerDynamic', async function () {
      loader.trace = true;
      new Module().require(path.resolve(fileUrlToPath(loader.baseKey), 'dynamic-modules/mixed-bundle.js'));
      var m = await loader.import('tree/first');
      assert.equal(JSON.stringify(loader.loads['tree/first'].depMap), '{"./second":"tree/second","./amd":"tree/amd"}');
      assert.equal(m.p, 5);
      assert.equal(m.q, 4);
      assert.equal(m.a.is, 'amd');
    });
  });

});
