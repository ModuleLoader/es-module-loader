//

describe('Custom Loader', function() {

  it('should support standard load', function(done) {
    customLoader.import('test/loader/test')
      .then(function(m) {
        setTimeout(function() {
          expect(m.loader).to.be.equal('custom');
          done();
        });
      }, done)
  });

  it('should support special loading rules', function(done) {
    customLoader.import('path/custom')
      .then(function(m) {
        setTimeout(function() {
          expect(m.path).to.be.true();
          done();
        });
      }, done)
  });

  it('should support AMD', function(done) {
    customLoader.import('test/loader/amd')
      .then(function(m) {
        setTimeout(function() {
          expect(m.format).to.be.equal('amd');
          done();
        });
      }, done)
  });

  describe('hook errors', function() {

    function dummyLoad(file, cb) {
      System.import(file)
        .then(function() {
          setTimeout(function() {
            expect(false, 'should not be successful').to.be.true();
            cb();
          });
        })
        .catch(function(e) {
          setTimeout(function() {
            cb(e);
          });
        })
      ;
    }

    it('should make the normalize throw', function(done) {
      dummyLoad('test/loader/error1-parent', function(e) {
        expect(e).to.be.match(/Error loading "error1" at \S+error1\.js\nError loading "error1" from "test\/loader\/error1-parent"/);
        done();
      });
    });

    it('should make the locate throw', function(done) {
      dummyLoad('test/loader/error2', function(e) {
        expect(e).to.be.match(/Error loading "test\/loader\/error2" at \S+test\/loader\/error2\.js\nNot Found: \S+/);
        done();
      });
    });

    it('should make the fetch throw', function(done) {
      dummyLoad('test/loader/error3', function(e) {
        expect(e).to.be.match(/Error loading "test\/loader\/error3" at \S+test\/loader\/error3\.js/);
        done();
      });
    });

    it('should make the translate throw', function(done) {
      dummyLoad('test/loader/error4', function(e) {
        expect(e).to.be.match(/Error loading "test\/loader\/error4" at \S+test\/loader\/error4\.js/);
        done();
      });
    });

    it('should make the instantiate throw', function(done) {
      dummyLoad('test/loader/error5', function(e) {
        expect(e).to.be.match(/Error loading "test\/loader\/error5" at \S+test\/loader\/error5\.js/);
        done();
      });
    });

  });

});
