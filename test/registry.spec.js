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

      //doesn't throw
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

});
