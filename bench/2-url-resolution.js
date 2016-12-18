import { resolveIfNotPlain } from '../core/resolve.js';

var cases = [
  ['./x', 'https://www.google.com'],
  ['./x', 'https://www.google.com/asdf'],
  ['./x', 'file:///asdf'],
  ['./x', 'https://www.google.com'],
  ['./x', 'https://www.google.com'],
  ['..\\..\\', 'file:///C:/some/path'],
  ['../../asdf', 'data://asdf/asdf/asdf/asdf/asdf/asdf'],
  ['//asdf/asdf', 'file://asdf/asdf/asdf'],
  ['/asdfasd', 'https://www.google.com/rterasdf/asdf/as/dfa/sdf/asdf/asdfadf'],
  ['a:b', 'b:c'],
  ['//asdfasdf', 'b:c']
];

var results = [];
suite.add('Resolve', function() {
  for (var i = 0; i < cases.length; i++)
    results.push(resolveIfNotPlain(cases[i][0], cases[i][1]));
});
