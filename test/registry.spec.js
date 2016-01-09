describe('Registry', function() {

  var moduleName = 'm1';
  var moduleValue = { a: 'b', c: 'd' };

  beforeEach(function() {
    System.registry.set(moduleName, moduleValue);
  });

  afterEach(function() {
    System.registry.delete(moduleName, moduleValue);
  });

  describe('constructor', function() {

    //The constructor always throws because registries cannot be created in user-land

    it('should fail if not called with new', function() {
      expect(Registry).to.throwException();
    });

    it('should fail if called with new', function() {
      expect(function() { new Registry() }).to.throwException();
    });

  });

  describe('entries function', function() {

    it('returns all the entries in the registry in a MapIterator', function() {
      // iterate and get it out
      var entries = System.registry.entries();
      var entry1 = entries.next();
      expect(entry1.value).to.eql([moduleName, moduleValue]);
      var entry2 = entries.next(); //move past the last value
      expect(entry2.done).to.be(true);
    });

    it('throws if not called with a valid registry', function() {
      expect(function() {Registry.prototype.entries.call('not a real registry')})
      .to.throwException(function(e) {
        expect(e).to.be.a(TypeError);
      });
    });

  });

  describe('keys function', function() {

    it('returns an iterator of all of the moduleNames', function() {
      var keys = System.registry.keys();
      var entry1 = keys.next();
      expect(entry1.value).to.equal(moduleName);
    });

    it('throws if not called with a valid registry', function() {
      expect(function() {Registry.prototype.keys.call('not a real registry')})
      .to.throwException(function(e) {
        expect(e).to.be.a(TypeError);
      });
    });

  });

  describe('values function', function() {

    it('returns an iterator of all of the moduleValues', function() {
      var values = System.registry.values();
      var entry1 = values.next();
      expect(entry1.value).to.eql(moduleValue);
      var entry2 = values.next();
      expect(entry2.done).to.be(true);
    });

    it('throws if not called with a valid registry', function() {
      expect(function() {Registry.prototype.values.call('not a real registry')})
      .to.throwException(function(e) {
        expect(e).to.be.a(TypeError);
      });
    });

  });

  describe('get and set functions', function() {

    it('sets a registry entry that can be gotten', function() {
      expect(System.registry.get(moduleName)).to.eql(moduleValue);
    });

    it('returns the registry when you call set', function() {
      expect(System.registry.set(moduleName, 'newValue')).to.eql(System.registry);
    });

    it('throws if the registry is invalid', function() {
      expect(function() {Registry.prototype.set.call('not a real registry', 'm2', 'value m2')})
      .to.throwException(function(e) {
        expect(e).to.be.a(TypeError);
      });

      expect(function() {Registry.prototype.get.call('not a real registry', 'm2')})
      .to.throwException(function(e) {
        expect(e).to.be.a(TypeError);
      });

    });

    describe('has function', function() {

      it('returns a boolean for if the registry contains the module', function() {
        expect(System.registry.has(moduleName)).to.be(true);
        expect(System.registry.has('asdfsaddfasdf')).to.be(false);
      });

      it('throws if the registry is invalid', function() {
        expect(function() {Registry.prototype.has.call('not a real registry', 'm2')})
        .to.throwException(function(e) {
          expect(e).to.be.a(TypeError);
        });
      });

    });

    describe('delete function', function() {

      it('removes a module and returns true', function() {
        expect(System.registry.has(moduleName)).to.be(true);
        expect(System.registry.delete(moduleName)).to.be(true);
        expect(System.registry.has(moduleName)).to.be(false);
      });

      it('returns false if it didn\'t remove the module', function() {
        expect(System.registry.delete('asdfdasfsafddfsafdsadf')).to.be(false);
      });

    });

  });

});

  /* These tests are out of date and need to be adapted to ModuleStatus objects */

  // describe('polyfilled iteration of instances', function() {
  //
  //   it('should iterate over the registryData', function() {
  //     var registry = new Registry({});
  //     registry._registry.registryData.push({ key: 'module1', entry: {} });
  //     registry._registry.registryData.push({ key: 'module2', entry: {} });
  //
  //     var iter = registry[Symbol.iterator]();
  //     var index = 0;
  //     var next;
  //     while ( !(next = iter.next()).done ) {
  //       expect(next.value).to.be(registry._registry.registryData[index++]);
  //     }
  //
  //     expect(index).to.be(registry._registry.registryData.length - 1);
  //
  //   });
  //
  // });
  //
  // describe('install function', function() {
  //
  //   var registry;
  //
  //   beforeEach(function() {
  //     registry = new Registry({});
  //   });
  //
  //   it('should fail if not called on a Registry object', function() {
  //     expect(Registry.prototype.install).to.throwException();
  //   });
  //
  //   it('should fail if a module already exists with the given key', function() {
  //     var key = 'existingKey';
  //     registry._registry.registryData[key] = new ModulePolyfill({});
  //     expect(function() { registry.install(key, new ModulePolyfill({})) }).to.throwException();
  //   });
  //
  //   it('should add a new key value pair to registryData when it succeeds', function(done) {
  //     var registeredModule = new ModulePolyfill({});
  //     registry.install('key', registeredModule);
  //     expect(registry._registry.registryData['key'].key).to.equal('key');
  //     expect(registry._registry.registryData['key'].pipeline.length).to.equal(1);
  //     expect(registry._registry.registryData['key'].metadata).to.be(undefined);
  //     expect(registry._registry.registryData['key'].dependencies).to.be(undefined);
  //     expect(registry._registry.registryData['key'].module).to.be(registeredModule);
  //     expect(registry._registry.registryData['key'].pipeline[0].stage).to.equal('ready');
  //     registry._registry.registryData['key'].pipeline[0].result.then(function(module) {
  //       expect(module).to.equal(registeredModule);
  //       done();
  //     });
  //   });
  //
  // });
  //
  // describe('lookup function', function() {
  //
  //   var registry;
  //
  //   beforeEach(function() {
  //     registry = new Registry({});
  //   });
  //
  //   it('throws if not called on a registry object', function() {
  //     expect(Registry.prototype.lookup).to.throwException();
  //   });
  //
  //   it('returns null if there is no module for the given key', function() {
  //     expect(registry.lookup('key')).to.be(null);
  //   });
  //
  //   it('throws if the registry data is corrupted', function() {
  //     registry._registry.registryData['key'] = "string that's not an entry";
  //     expect(function() { registry.lookup('key') }).to.throwException();
  //   });
  //
  //   it('returns the module if it is in a ready state', function() {
  //     var module = new ModulePolyfill({});
  //     registry.install('key', module);
  //
  //     var registryEntry = registry.lookup('key');
  //     expect(registryEntry.stage).to.equal('ready');
  //     expect(registryEntry.module).to.equal(module);
  //     expect(registryEntry.error).to.be(null);
  //   });
  //
  //   it('returns the entry\'s error if there is one', function() {
  //     var module = new ModulePolyfill({});
  //     registry.install('key', module);
  //
  //     registry._registry.registryData['key'].error = 'this is an error';
  //     registry._registry.registryData['key'].pipeline[0].stage = 'something went wrong';
  //     var registryEntry = registry.lookup('key');
  //     expect(registryEntry.stage).to.equal('something went wrong');
  //     expect(registryEntry.module).to.be(undefined);
  //     expect(registryEntry.error.value).to.equal('this is an error');
  //   });
  //
  // });
  //
  // describe('uninstall function', function() {
  //
  //   var registry;
  //
  //   beforeEach(function() {
  //     registry = new Registry({});
  //   });
  //
  //   it('throws if called on a context that\'s not an object', function() {
  //     expect(function() { Registry.prototype.uninstall('not an object') }).to.throwException();
  //   });
  //
  //   it('throws if there is no such module', function() {
  //     expect(function() { registry.uninstall('non-existent') }).to.throwException();
  //   });
  //
  //   it('throws if the module is still loading', function() {
  //     var registeredModule = new ModulePolyfill({});
  //     registry.install('still-loading', registeredModule);
  //     registry._registry.registryData['still-loading'].pipeline[0].stage = 'fetch';
  //     expect(function() { registry.uninstall('still-loading') }).to.throwException();
  //   });
  //
  //   it('removes the module if the module exists and was loaded', function() {
  //     registry.install('module-name', new ModulePolyfill({}));
  //     registry.uninstall('module-name');
  //     expect(registry._registry.registryData['module-name']).to.be(undefined);
  //   });
  //
  // });
  //
  // describe('cancel function', function() {
  //
  //   var registry;
  //
  //   beforeEach(function() {
  //     registry = new Registry({});
  //   });
  //
  //   it('throws if called on a context that\'s not an object', function() {
  //     expect(function() { Registry.prototype.cancel('not an object') }).to.throwException();
  //   });
  //
  //   it('throws if there is no such module', function() {
  //     expect(function() { registry.cancel('non-existent') }).to.throwException();
  //   });
  //
  //   it('throws if the module isn\'t still loading', function() {
  //     registry.install('already-loaded', new ModulePolyfill({}));
  //     expect(function() { registry.cancel('already-loaded') }).to.throwException();
  //   });
  //
  //   it('removes the module if the module exists and is being loaded', function() {
  //     registry.install('module-name', new ModulePolyfill({}));
  //     registry._registry.registryData['module-name'].pipeline[0].stage = 'fetch';
  //     registry.cancel('module-name');
  //     expect(registry._registry.registryData['module-name']).to.be(undefined);
  //   });
  //
  // });
