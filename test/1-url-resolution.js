import { resolveIfNotPlain } from '../core/resolve.js';
import assert from 'assert';

describe('Simple normalization tests', function () {
  it('Should trim whitespace from URLs', function () {
    assert.equal(resolveIfNotPlain(' c:\\some\\path ', 'file:///c:/adsf/asdf'), 'file:///c:/some/path');
  });
  it('Should resolve relative with protocol', function () {
    assert.equal(resolveIfNotPlain('./x:y', 'https://x.com/y'), 'https://x.com/x:y');
  });
  it('Should convert \ into /', function () {
    assert.equal(resolveIfNotPlain('./a\\b', 'https://x.com/z'), 'https://x.com/a/b')
  });
  it('Should resolve windows paths as file:/// URLs', function () {
    assert.equal(resolveIfNotPlain('c:\\some\\path', 'file:///c:/adsf/asdf'), 'file:///c:/some/path');
  });
  it('Should resolve relative windows paths', function () {
    assert.equal(resolveIfNotPlain('./test.js', 'file:///C:/some/path/'), 'file:///C:/some/path/test.js');
  });
  it('Should resolve unix file paths as file:/// URLs', function () {
    assert.equal(resolveIfNotPlain('/some/file/path.js', 'file:///home/path/to/project'), 'file:///some/file/path.js');
  });
  it('Should be able to resolve to plain names', function () {
    assert.equal(resolveIfNotPlain('../../asdf/./asdf/.asdf/asdf', 'a/b/c/d'), 'a/asdf/asdf/.asdf/asdf');
  });
  it('Should support resolving plain URI forms', function () {
    assert.equal(resolveIfNotPlain('./asdf', 'npm:lodash/'), 'npm:lodash/asdf');
  });
  it('Should not support backtracking below base in plain URI forms', function () {
    var thrown = false;
    try {
      resolveIfNotPlain('../asdf', 'npm:lodash/path');
    }
    catch(e) {
      thrown = true;
    }
    if (!thrown)
      throw new Error('Test should have thrown a RangeError exception');
  });
  it('Should not support backtracking exactly to the base in plain URI forms', function () {
    var thrown = false;
    try {
      resolveIfNotPlain('../', 'npm:lodash/asdf/y');
    }
    catch(e) {
      thrown = true;
    }
    if (thrown)
      throw new Error('Test should not have thrown a RangeError exception');
  });
  it('Should support "." for resolution', function () {
    assert.equal(resolveIfNotPlain('.', 'https://www.google.com/asdf/asdf'), 'https://www.google.com/asdf/');
  });
  it('Should support ".." resolution', function () {
    assert.equal(resolveIfNotPlain('..', 'https://www.google.com/asdf/asdf/asdf'), 'https://www.google.com/asdf/');
  });
  it('Should support "./" for resolution', function () {
    assert.equal(resolveIfNotPlain('./', 'https://www.google.com/asdf/asdf'), 'https://www.google.com/asdf/');
  });
  it('Should support "../" resolution', function () {
    assert.equal(resolveIfNotPlain('../', 'https://www.google.com/asdf/asdf/asdf'), 'https://www.google.com/asdf/');
  });
  it('Should leave a trailing "/"', function () {
    assert.equal(resolveIfNotPlain('./asdf/', 'file:///x/y'), 'file:///x/asdf/');
  });
  it('Should leave a trailing "//"', function () {
    assert.equal(resolveIfNotPlain('./asdf//', 'file:///x/y'), 'file:///x/asdf//');
  });
  it('Should support a trailing ".."', function () {
    assert.equal(resolveIfNotPlain('../..', 'path/to/test/module.js'), 'path/');
  });
});

import fs from 'fs';
var testCases = eval('(' + fs.readFileSync('test/fixtures/url-resolution-cases.json') + ')');

describe('URL resolution selected WhatWG URL spec tests', function () {
  var run = 0;
  testCases.forEach(function (test) {
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

    // we don't fail on the cases that should fail for resolving against package:x/y, as we support and treat this as a plain parent normalization
    if (test.input.indexOf(':') == -1 && test.base.indexOf(':') != -1 && test.base[test.base.indexOf(':') + 1] != '/' && test.failure && test.input.indexOf('/') == -1 && test.input.indexOf('.') == -1)
      return;

    // we don't do whitespace trimming, so handle it here
    test.input = test.input.trim();

    // we don't handle the empty string
    if (test.input == '')
      return;

    it('Should resolve "' + test.input + '" to "' + test.base + '"', function () {
      var failed = false;
      try {
        var resolved = resolveIfNotPlain(test.input, test.base) || resolveIfNotPlain('./' + test.input, test.base);
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
