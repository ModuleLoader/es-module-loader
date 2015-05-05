//

describe('System', function () {
  describe('#normalize', function () {

    // Normalize tests - identical to https://github.com/google/traceur-compiler/blob/master/test/unit/runtime/System.js

    var originalBaseUrl = System.baseURL;

    var dummyBase = 'http://example.org/';

    beforeEach(function () {
      System.baseURL = dummyBase + 'a/b.html';
    });

    afterEach(function () {
      System.baseURL = originalBaseUrl;
    });

    describe('when having no argument', function () {

      it('should throw with no specified name', function () {
        expect(function () { System.normalize(); }).to.throwException();
      });

    });

    describe('when having one argument', function () {

      it('should allow no referer', function () {
        expect(System.normalize('d/e/f')).to.equal(dummyBase + 'a/d/e/f');
      });

      it('should backtracking below baseURL', function () {
        expect(System.normalize('../e/f')).to.equal('http://example.org/e/f');
      });

      it('should double dotted backtracking', function () {
        expect(System.normalize('./../a.js')).to.equal(dummyBase + 'a.js');
      });

      it('should normalize ./ and plain names to the same base', function () {
        expect(System.normalize('./a.js')).to.equal(dummyBase + 'a/a.js');
      });

    });

    describe('when having two arguments', function () {

      var refererAddress = '/dir/file';

      it('should normalize relative paths against the parent address', function () {
        expect(System.normalize('./d/e/f', null, refererAddress)).to.equal('/dir/d/e/f');
        expect(System.normalize('../e/f', null, refererAddress)).to.equal('/e/f');
      });

    });
  });

  describe('#locate', function () {

    it('should be the identity function', function () {
      expect(System.locate({name: '@some/name'})).to.equal('@some/name');
    });

  });
});
