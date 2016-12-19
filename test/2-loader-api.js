import assert from 'assert';
import { Loader, ModuleNamespace } from '../core/loader-polyfill.js';
import RegisterLoader from '../core/register-loader.js';
import { pathToFileUrl } from '../core/common.js';

describe('Loader Polyfill API', function () {
  var loader = new Loader();

  it('Should be an instance of itself', function () {
    assert(loader instanceof Loader);
  });

  it('Should support the full registry API', function () {
    assert(loader.registry);

    loader.registry.set('asdf', new ModuleNamespace({ asdf: 'asdf' }));
    assert(loader.registry.has('asdf'));
    var m = loader.registry.get('asdf');
    assert(m);
    assert(m instanceof ModuleNamespace);
    assert.equal(m.asdf, 'asdf');

    for (var k of loader.registry.keys())
      assert.equal(k, 'asdf');

    for (var v of loader.registry.values())
      assert.equal(v.asdf, 'asdf');

    for (var v of loader.registry.entries()) {
      assert.equal(v[0], 'asdf');
      assert.equal(v[1].asdf, 'asdf');
    }

    for (var v of loader.registry) {
      assert.equal(v[0], 'asdf');
      assert.equal(v[1].asdf, 'asdf');
    }

    assert.equal(loader.registry.delete('asdf'), true);
    assert.equal(loader.registry.has('asdf'), false);
  });

  it('Should support Module construction, evaluation and mutation', function () {
    //var evaluated = false;
    var mutator = { a: 'asdf' };
    var module = new ModuleNamespace(mutator);/*, function() {
      evaluated = true;
      mutator.a = 'b';
    });*/

    assert.equal(module.a, 'asdf');

    //Module.evaluate(module);
    //assert(evaluated);
    mutator.a = 'b';

    assert.equal(module.a, 'b');
  });

  it('Should throw if instantiate hook doesnt instantiate', function () {
    loader[loader.constructor.resolve] = function (x) {
      return x;
    };

    return loader.import('x')
    .catch(function (e) {
      assert.equal(e.toString().indexOf('Error: Module instantiation did not return a valid namespace object.'), 0);
    });
  });
});


describe('Register Loader API', function () {
  var loader = new RegisterLoader();

  loader[RegisterLoader.resolve] = function (x) {
    return x;
  };

  it('Should throw if instantiate doesnt instantiate', function () {
    return loader.import('x')
    .catch(function (e) {
      assert.equal(e.toString().indexOf('Error: Module instantiation did not call an anonymous or correctly named System.register.'), 0);
    });
  });
});
