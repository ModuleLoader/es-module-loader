import { resolveUrlToParentIfNotPlain } from '../core/resolve.js';

var fs = require('fs');
var testCases = eval('(' + fs.readFileSync('test/fixtures/url-resolution-cases.json') + ')');

describe('URL resolution', function() {  
  var run = 0;
  testCases.forEach(function(test) {
    if (typeof test == 'string')
      return;

    // ignore cases where input contains newlines
    if (test.input.match(/[\n]/) || test.base.match(/[\n]/))
      return;

    // if its a protocol input case that should fail or alter through validation, we obviously don't do that
    if (test.input.indexOf(':') != -1 && (test.failure || test.input !== test.href))
      return;

    // we don't handle hashes
    if (test.input.indexOf('#') != -1)
      return;

    // we don't handle C| automatically converting into file:///c:/
    if (test.input.indexOf('C|') != -1)
      return;

    // we don't handle percent encoding
    if (test.href && test.href.indexOf('%') != -1 && test.input.indexOf('%') == -1)
      return;

    // we don't do whitespace trimming, so handle it here
    test.input = test.input.trim();

    it('Should resolve "' + test.input + '" to "' + test.base + '"', function() {
      var failed = false;
      try {
        var resolved = resolveUrlToParentIfNotPlain(test.input, test.base) || resolveUrlToParentIfNotPlain('./' + test.input, test.base);
      }
      catch(e) {
        failed = true;
        if (!test.failure)
          throw new Error('Resolution failure');
      }
      if (test.failure && !failed)
        throw new Error('Should have failed resolution');
      if (!test.failure && resolved !== test.href)
        throw new Error('Resolution did not equal "' + test.href + '"');
    });
  });
});