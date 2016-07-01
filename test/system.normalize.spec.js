//
(function() {
var base, origin;
if (typeof window != 'undefined') {
  base = window.location.href.substr(0, window.location.href.lastIndexOf('/') + 1);
  origin = window.location.origin + '/';
}
else {
  base = 'file://' + (process.platform.match(/^win/) ? '/' : '') + process.cwd() + '/';
  origin = 'file:///';
}

describe('System', function () {
  
  describe('#resolve', function () {

    describe('when having no arguments', function () {

      it('should throw', function () {
        expect(function () { System.loader.resolve() })
          .to.throwException(function (e) {
            expect(e).to.be.a(TypeError);
            expect(e.message).to.match(/URL must be a string/);
          });
      });

    });

    describe('when having one argument', function () {

      it('should normalize to base', function () {
        expect(System.loader.resolve('d/e/f')).to.equal(base + 'd/e/f');
      });

      it.skip('should "below baseURL"', function () {
        expect(System.loader.resolve('../../../../e/f')).to.equal(base + 'e/f');
      });

      it('should be backwards compat', function () {
        expect(System.loader.resolve('./a.js')).to.equal(base + 'a.js');
      });

      it('shouldn\'t change an absolute URL', function () {
        expect(System.loader.resolve('file:///example.org/a/b.html')).to.equal('file:///example.org/a/b.html');
      });

      it('should resolve an embedded path', function () {
        expect(System.loader.resolve('a/b/../c')).to.equal(base + 'a/c');
      });

    });

    describe('when having two arguments', function () {

      var referrer = base + 'dir/path';

      it('should support relative path', function () {
        expect(System.loader.resolve('d/e/f', referrer)).to.equal(base + 'dir/d/e/f');
        expect(System.loader.resolve('./d/e/f', referrer)).to.equal(base + 'dir/d/e/f');
        expect(System.loader.resolve('../e/f', referrer)).to.equal(base + 'e/f');
      });

      it('should resolve the path with relative parent', function () {
        expect(System.loader.resolve('./a/b', base + 'c')).to.equal(base + 'a/b');
        expect(System.loader.resolve('./a/b', base + 'c/d')).to.equal(base + 'c/a/b');
      });

    });
  });

  describe('#sites', function () {

    it('should resolve exact site matches', function () {
      System.loader.site({
        jquery: '/jquery.js'
      });

      expect(System.loader.resolve('jquery')).to.equal(origin + 'jquery.js');
      expect(System.loader.resolve('jquery/nomatch')).to.equal(base + 'jquery/nomatch');
    });

    it('sites table items can be added, checked and removed', function () {
      
      System.loader.site.set('jquery', 'custom-jquery');

      expect(System.loader.site.has('jquery')).to.be.ok();

      expect(System.loader.site.get('jquery')).to.equal('custom-jquery');
      
      expect(System.loader.resolve('jquery')).to.equal(base + 'custom-jquery');
      
      System.loader.site['delete']('jquery');
      
      expect(System.loader.resolve('jquery')).to.equal(base + 'jquery');

      expect(!System.loader.site.has('jquery')).to.be.ok();

    });

    it('should resolve wildcard site matches', function() {

      System.loader.site['delete']('jquery');
      System.loader.site({
        'jquery/*': '/path/to/jquery/*.js'
      });

      expect(System.loader.resolve('jquery')).to.equal(base + 'jquery');
      expect(System.loader.resolve('jquery/sub')).to.equal(origin + 'path/to/jquery/sub.js');
      expect(System.loader.resolve('jquery/sub/path')).to.equal(origin + 'path/to/jquery/sub/path.js');

    });

  });
});
})();
