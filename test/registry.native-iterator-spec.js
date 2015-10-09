describe('native iterator tests', function() {

  describe('native iteration of Registry instances', function() {

      it('should be iterate over the registryData', function () {
        var registry = new Registry({});
        registry._registry.registryData.push({ key: 'module1', entry: {} });
        registry._registry.registryData.push({ key: 'module2', entry: {} });

        var index = 0;
        for (var registryEntry of registry) {
          expect(registryEntry).to.be(registry._registry.registryData[index++]);
        }

        expect(index).to.be(registry._registry.registryData.length - 1);
      });

  });

});
