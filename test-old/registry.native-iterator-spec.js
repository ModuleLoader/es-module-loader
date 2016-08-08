describe('native iterator tests', function() {
  var modules = [
    {
      name: 'h1',
      value: 'bb8'
    },
    {
      name: 'h2',
      value: 'er3'
    }
  ]

  beforeEach(function() {
    for (var i=0; i<modules.length; i++)
      System.registry.set(modules[i].name, modules[i].value);
  });

  afterEach(function() {
    for (var i=0; i<modules.length; i++)
      System.registry.delete(modules[i].name);
  });

  it('should natively iterate over the registries\' entries', function () {
    var index = 0;
    for (var registryEntry of System.registry) {
      expect(registryEntry[0]).to.eql(modules[index].name);
      expect(registryEntry[1]).to.eql(modules[index].value);
      index++;
    }
  });

  it('should iterate over the registries\' entries after calling the entries function', function () {
    var index = 0;
    for (var registryEntry of System.registry.entries()) {
      expect(registryEntry[0]).to.eql(modules[index].name);
      expect(registryEntry[1]).to.eql(modules[index].value);
      index++;
    }
  });

  it('should iterate over the registries\' keys', function () {
    var index = 0;
    for (var key of System.registry.keys()) {
      expect(key).to.eql(modules[index].name);
      index++;
    }
  });

  it('should iterate over the registries\' values', function () {
    var index = 0;
    for (var value of System.registry.values()) {
      expect(value).to.eql(modules[index].value);
      index++;
    }
  });

});
