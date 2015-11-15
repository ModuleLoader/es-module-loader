describe('Registry', function () {

  describe('constructor', function () {

    it('should fail if not called with new', function () {
      expect(Registry).to.throwException();
    });

    it('should fail if not called with a loader object', function() {
      expect(function() { new Registry(undefined) }).to.throwException();
      expect(function() { new Registry('string') }).to.throwException();
      expect(function() { new Registry(0) }).to.throwException();
      expect(function() { new Registry(function(){}) }).to.throwException();
    });

    it('should succeed if called with a loader object', function() {
      new Registry({});
    });

  });

  describe('polyfilled iteration of instances', function() {

    it('should iterate over the registryData', function () {
      var registry = new Registry({});
      registry._registry.registryData.push({ key: 'module1', entry: {} });
      registry._registry.registryData.push({ key: 'module2', entry: {} });

      var iter = registry[Symbol.iterator]();
      var index = 0;
      var next;
      while ( !(next = iter.next()).done ) {
        expect(next.value).to.be(registry._registry.registryData[index++]);
      }

      expect(index).to.be(registry._registry.registryData.length - 1);

    });

  });

  describe('install function', function() {

    var registry;

    beforeEach(function() {
      registry = new Registry({});
    });

    it('should fail if not called on a Registry object', function() {
      expect(Registry.prototype.install).to.throwException();
    });

    it('should fail if a module already exists with the given key', function() {
      var key = 'existingKey';
      registry._registry.registryData[key] = new ModulePolyfill({});
      expect(function() { registry.install(key, new ModulePolyfill({})) }).to.throwException();
    });

    it('should add a new key value pair to registryData when it succeeds', function(done) {
      var registeredModule = new ModulePolyfill({});
      registry.install('key', registeredModule);
      expect(registry._registry.registryData['key'].key).to.equal('key');
      expect(registry._registry.registryData['key'].pipeline.length).to.equal(1);
      expect(registry._registry.registryData['key'].metadata).to.be(undefined);
      expect(registry._registry.registryData['key'].dependencies).to.be(undefined);
      expect(registry._registry.registryData['key'].module).to.be(registeredModule);
      expect(registry._registry.registryData['key'].pipeline[0].stage).to.equal('ready');
      registry._registry.registryData['key'].pipeline[0].result.then(function(module) {
        expect(module).to.equal(registeredModule);
        done();
      });
    });

  });

  describe('lookup function', function() {

    var registry;

    beforeEach(function() {
      registry = new Registry({});
    });

    it('throws if not called on a registry object', function() {
      expect(Registry.prototype.lookup).to.throwException();
    });

    it('returns null if there is no module for the given key', function() {
      expect(registry.lookup('key')).to.be(null);
    });

    it('throws if the registry data is corrupted', function() {
      registry._registry.registryData['key'] = "string that's not an entry";
      expect(function() { registry.lookup('key') }).to.throwException();
    });

    it('returns the module if it is in a ready state', function() {
      var module = new ModulePolyfill({});
      registry.install('key', module);

      var registryEntry = registry.lookup('key');
      expect(registryEntry.stage).to.equal('ready');
      expect(registryEntry.module).to.equal(module);
      expect(registryEntry.error).to.be(null);
    });

    it('returns the entry\'s error if there is one', function() {
      var module = new ModulePolyfill({});
      registry.install('key', module);

      registry._registry.registryData['key'].error = 'this is an error';
      registry._registry.registryData['key'].pipeline[0].stage = 'something went wrong';
      var registryEntry = registry.lookup('key');
      expect(registryEntry.stage).to.equal('something went wrong');
      expect(registryEntry.module).to.be(undefined);
      expect(registryEntry.error.value).to.equal('this is an error');
    });

  });

  describe('uninstall function', function() {

    var registry;

    beforeEach(function() {
      registry = new Registry({});
    });

    it('throws if called on a context that\'s not an object', function() {
      expect(function() { Registry.prototype.uninstall('not an object') }).to.throwException();
    });

    it('throws if there is no such module', function() {
      expect(function() { registry.uninstall('non-existent') }).to.throwException();
    });

    it('throws if the module is still loading', function() {
      var registeredModule = new ModulePolyfill({});
      registry.install('still-loading', registeredModule);
      registry._registry.registryData['still-loading'].pipeline[0].stage = 'fetch';
      expect(function() { registry.uninstall('still-loading') }).to.throwException();
    });

    it('removes the module if the module exists and was loaded', function() {
      registry.install('module-name', new ModulePolyfill({}));
      registry.uninstall('module-name');
      expect(registry._registry.registryData['module-name']).to.be(undefined);
    });

  });

  describe('cancel function', function() {

    var registry;

    beforeEach(function() {
      registry = new Registry({});
    });

    it('throws if called on a context that\'s not an object', function() {
      expect(function() { Registry.prototype.cancel('not an object') }).to.throwException();
    });

    it('throws if there is no such module', function() {
      expect(function() { registry.cancel('non-existent') }).to.throwException();
    });

    it('throws if the module isn\'t still loading', function() {
      registry.install('already-loaded', new ModulePolyfill({}));
      expect(function() { registry.cancel('already-loaded') }).to.throwException();
    });

    it('removes the module if the module exists and is being loaded', function() {
      registry.install('module-name', new ModulePolyfill({}));
      registry._registry.registryData['module-name'].pipeline[0].stage = 'fetch';
      registry.cancel('module-name');
      expect(registry._registry.registryData['module-name']).to.be(undefined);
    });

  });

});
