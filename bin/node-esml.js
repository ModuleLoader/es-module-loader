#!/usr/bin/env node
var LoaderNodeBabel = require('../dist/loader-node.js');
var path = require('path');

var filename = process.argv[2];

if (!filename)
  throw new Error('No filename argument provided');

var loader = new LoaderNodeBabel(process.cwd());

loader.import(path.resolve(filename))
.catch(function(err) {
  setTimeout(function() {
    throw err;
  });
});