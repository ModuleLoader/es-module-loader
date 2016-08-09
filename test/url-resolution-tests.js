import { resolveUrlToParentIfNotPlain } from '../core/resolve.js';

var assert = require('assert');

describe('Simple normalization tests', function() {
  it('Should resolve windows paths as file:/// URLs', function() {
    assert.equal(resolveUrlToParentIfNotPlain('c:\\some\\path', 'file:///c:/adsf/asdf'), 'file:///c:/some/path');
  });
  it('Should resolve unix file paths as file:/// URLs', function() {
    assert.equal(resolveUrlToParentIfNotPlain('/some/file/path.js', 'file:///home/path/to/project'), 'file:///some/file/path.js');
  });
  it('Should be able to resolve to plain names', function() {
    assert.equal(resolveUrlToParentIfNotPlain('../../asdf/./asdf/.asdf/asdf', 'a/b/c/d'), 'a/asdf/asdf/.asdf/asdf');
  });
});

var fs = require('fs');
var testCases = eval('(' + fs.readFileSync('test/fixtures/url-resolution-cases.json') + ')');

describe('URL resolution selected WhatWG URL spec tests', function() {  
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

    // we don't give special handling to names starting with "?"
    if (test.input[0] == '?')
      return;

    // we don't convert backslashes to forward slashes in general
    if (test.input.indexOf('\\') != -1)
      return;

    // we don't support automatically adding "/" to the end of protocol URLs
    if (!test.failure && test.href.endsWith('/') && !test.input.endsWith('/') && test.input[0] !== '.')
      return;

    // we don't support automatically working out that file URLs always need to be ///
    if (test.input == '//' && !test.failure && test.base.startsWith('file:///'))
      return;

    // we don't do whitespace trimming, so handle it here
    test.input = test.input.trim();

    // we don't handle the empty string
    if (test.input == '')
      return;

    it('Should resolve "' + test.input + '" to "' + test.base + '"', function() {
      var failed = false;
      try {
        var resolved = resolveUrlToParentIfNotPlain(test.input, test.base) || resolveUrlToParentIfNotPlain('./' + test.input, test.base);
      }
      catch(e) {
        failed = true;
        if (!test.failure)
          throw new Error('Resolution failure, should have been "' + test.href + '"');
      }
      if (test.failure && !failed)
        throw new Error('Should have failed resolution');
      if (!test.failure)
        assert.equal(resolved, test.href);
    });
  });
});