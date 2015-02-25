//

describe('Custom Loader', function () {

  describe('#import', function () {

    describe('scripts', function () {

      it('should support AMD scripts', function (done) {
        customLoader.import('base/test/loader/amd.js')
        .then(function (m) {
          expect(m.format).to.be.equal('amd');
        })
        .then(done, done);
      });
    });

    describe('special resolve path rule', function a() {

      it('should support special loading rules', function (done) {
        customLoader.import('path/custom')
        .then(function (m) {
          expect(m.path).to.be.ok();
        })
        .then(done, done);
      });

    });

    describe('errors', function () {

      function supposedToFail() {
        expect(false, 'should not be successful').to.be.ok();
      }

      it('should make the resolve throw', function (done) {
        customLoader.import('base/test/loader/error1-parent.js')
        .then(supposedToFail, function (e) {
          expect(e).to.be('error1\n  Resolving error1.js, http://localhost:9876/base/test/loader/error1-parent.js\n  Instantiating http://localhost:9876/base/test/loader/error1-parent.js');
        })
        .then(done, done);
      });

      it('should make the fetch throw', function (done) {
        customLoader.import('error2')
        .then(supposedToFail, function (e) {
          expect(e).to.be('error2\n  Fetching error2');
        })
        .then(done, done);
      });

      it('should make the translate throw', function (done) {
        customLoader.import('error3')
        .then(supposedToFail, function (e) {
          expect(e).to.be('error3\n  Translating error3');
        })
        .then(done, done);
      });

      it('should make the instantiate throw', function (done) {
        customLoader.import('error4')
        .then(supposedToFail, function (e) {
          expect(e).to.be('error4\n  Instantiating error4');
        })
        .then(done, done);
      });

    });

  });

  describe('#resolve', function () {
    it('should support async resolve', function (done) {
      customLoader.resolve('asdfasdf')
      .then(function (normalized) {
        return customLoader.import(normalized);
      })
      .then(function (m) {
        expect(m.n).to.be.equal('n');
      })
      .then(done, done);
    });
  });
});
